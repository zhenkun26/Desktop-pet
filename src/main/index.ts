import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  screen,
  Tray
} from 'electron'
import { join } from 'path'
import { resolveAppIcon, resolveTrayIcon } from './icons'
import {
  consumePendingChatOptions,
  disposeChatWindow,
  broadcastToChat,
  openChatWindow
} from './chat'
import {
  chatClearApiKey,
  chatCreateConversation,
  chatDeleteConversation,
  chatGetApiKeyStatus,
  chatGetConversationResponseLanguage,
  chatGetMessages,
  chatGetPersonaProfile,
  chatListConversations,
  chatRenameConversation,
  chatSetApiKey,
  chatTestApiKey,
  chatUpdateConversationResponseLanguage,
  chatUpdatePersonaProfile,
  disposeChatService,
  onBusinessEvent,
  sendChatMessage,
  stopChatGeneration
} from './services/chat/chat-service'
import { closeChatDb, getChatDb } from './services/chat/chat-db'
import { TimerService } from './services/timer/timer-service'
import { getPet, listPets } from './services/pet/pet-registry'
import { loadConfig, saveConfig } from './store'
import { migrateLegacyUserData } from './user-data-migration'
import {
  DEFAULT_CONFIG,
  normalizeChatLanguage,
  type OpenChatOptions,
  type PetConfig,
  type PetId,
  type SendChatMessageInput,
  type TimerConfig,
  type UpdatePersonaInput
} from '../shared/types'

const WINDOW_WIDTH = 200
const WINDOW_HEIGHT = 300

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let config: PetConfig = { ...DEFAULT_CONFIG }

const timerService = new TimerService()

const isDev = !app.isPackaged

/** IPC 入口统一校验 petId：未注册角色直接抛错，调用方不得静默回退。 */
function resolveRegisteredPetId(petId: unknown): PetId {
  if (typeof petId !== 'string') {
    throw new Error('petId 必须是字符串')
  }
  return getPet(petId as PetId).petId
}

function broadcastConfig(): void {
  mainWindow?.webContents.send('config-changed', config)
}

function persist(): void {
  saveConfig(config)
  broadcastConfig()
}

function setDefaultResponseLanguage(value: unknown): PetConfig {
  config.defaultResponseLanguage = normalizeChatLanguage(value)
  persist()
  return config
}

function resolveConversationId(conversationId: unknown): string {
  if (typeof conversationId !== 'string' || !conversationId.trim()) {
    throw new Error('conversationId 必须是非空字符串')
  }
  return conversationId
}

/**
 * 边界策略（与参考项目一致）：仅在窗口创建/显示时回收完全出屏的窗口；
 * 拖拽过程中不钳制，保留拖出屏的自由
 */
function clampToVisibleWorkArea(
  x: number,
  y: number
): { x: number; y: number } {
  const displays = screen.getAllDisplays()
  const onScreen = displays.some((d) => {
    const a = d.workArea
    return (
      x + WINDOW_WIDTH > a.x &&
      x < a.x + a.width &&
      y + WINDOW_HEIGHT > a.y &&
      y < a.y + a.height
    )
  })
  if (onScreen) return { x, y }

  const primary = screen.getPrimaryDisplay().workArea
  return {
    x: primary.x + primary.width - WINDOW_WIDTH - 24,
    y: primary.y + 80
  }
}

function createWindow(): void {
  const display = screen.getPrimaryDisplay().workArea
  const defaultX = display.x + display.width - WINDOW_WIDTH - 24
  const defaultY = display.y + 80
  const clamped = clampToVisibleWorkArea(
    config.windowX ?? defaultX,
    config.windowY ?? defaultY
  )
  config.windowX = clamped.x
  config.windowY = clamped.y

  const appIcon = resolveAppIcon()
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: clamped.x,
    y: clamped.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: config.alwaysOnTop,
    show: false,
    backgroundColor: '#00000000',
    ...(appIcon.isEmpty() ? {} : { icon: appIcon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  mainWindow.setAlwaysOnTop(config.alwaysOnTop, 'screen-saver')

  mainWindow.once('ready-to-show', () => {
    showPet()
  })

  mainWindow.on('moved', () => {
    if (!mainWindow) return
    const [wx, wy] = mainWindow.getPosition()
    config.windowX = wx
    config.windowY = wy
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showPet(): void {
  if (!mainWindow) {
    createWindow()
  }
  if (!mainWindow) return
  const [wx, wy] = mainWindow.getPosition()
  const clamped = clampToVisibleWorkArea(wx, wy)
  if (clamped.x !== wx || clamped.y !== wy) {
    mainWindow.setPosition(clamped.x, clamped.y)
    config.windowX = clamped.x
    config.windowY = clamped.y
  }
  config.visible = true
  mainWindow.show()
  mainWindow.focus()
  persist()
  rebuildTrayMenu()
}

function hidePet(): void {
  if (!mainWindow) return
  config.visible = false
  mainWindow.hide()
  persist()
  rebuildTrayMenu()
}

function toggleVisible(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible() && config.visible) {
    hidePet()
  } else {
    showPet()
  }
}

function setAlwaysOnTop(value: boolean): void {
  config.alwaysOnTop = value
  mainWindow?.setAlwaysOnTop(value, 'screen-saver')
  persist()
  rebuildTrayMenu()
}

function showAppContextMenu(): void {
  if (!mainWindow) return
  const menu = Menu.buildFromTemplate([
    {
      label: '和我聊天',
      click: () => openChatWindow({ view: 'chat', petId: config.petId })
    },
    {
      label: '角色设定',
      click: () => openChatWindow({ view: 'persona', petId: config.petId })
    },
    {
      label: '番茄钟',
      click: () => openChatWindow({ view: 'timer', petId: config.petId })
    },
    { type: 'separator' },
    {
      label: config.alwaysOnTop ? '取消置顶' : '始终置顶',
      click: () => setAlwaysOnTop(!config.alwaysOnTop)
    },
    {
      label: config.visible ? '隐藏宠物' : '显示宠物',
      click: () => toggleVisible()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ])
  menu.popup({ window: mainWindow })
}

function createTray(): void {
  tray = new Tray(resolveTrayIcon())
  tray.setToolTip('二次元桌宠')
  rebuildTrayMenu()
  tray.on('click', () => {
    if (!mainWindow || !mainWindow.isVisible() || !config.visible) {
      showPet()
      return
    }
    mainWindow.focus()
  })
  tray.on('right-click', () => {
    tray?.popUpContextMenu()
  })
}

function rebuildTrayMenu(): void {
  if (!tray) return
  tray.setToolTip(
    config.visible ? '二次元桌宠' : '二次元桌宠（已隐藏，点击显示）'
  )
  const menu = Menu.buildFromTemplate([
    {
      label: config.visible ? '隐藏宠物' : '显示宠物',
      click: () => toggleVisible()
    },
    {
      label: '和我聊天',
      click: () => openChatWindow({ view: 'chat', petId: config.petId })
    },
    {
      label: '番茄钟',
      click: () => openChatWindow({ view: 'timer', petId: config.petId })
    },
    { type: 'separator' },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: config.alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked)
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(menu)
}

function registerIpc(): void {
  ipcMain.handle('get-config', () => config)
  ipcMain.handle('get-default-response-language', () => config.defaultResponseLanguage)
  ipcMain.handle('set-default-response-language', (_event, language: unknown) =>
    setDefaultResponseLanguage(language)
  )

  ipcMain.handle('list-pets', () => listPets())

  ipcMain.handle('get-pet', (_event, petId: unknown) =>
    getPet(resolveRegisteredPetId(petId))
  )

  ipcMain.handle('set-always-on-top', (_event, value: boolean) => {
    setAlwaysOnTop(value)
    return config
  })

  ipcMain.handle('move-window', (_event, dx: number, dy: number) => {
    if (!mainWindow) return
    const [x, y] = mainWindow.getPosition()
    // 拖拽中不钳制（与参考项目一致），创建/显示时才回收出屏窗口
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
  })

  ipcMain.handle('save-position', () => {
    if (!mainWindow) return
    const [x, y] = mainWindow.getPosition()
    config.windowX = x
    config.windowY = y
    persist()
  })

  ipcMain.handle('show-context-menu', () => {
    showAppContextMenu()
  })

  ipcMain.handle('open-chat', (_event, options?: OpenChatOptions) => {
    openChatWindow({
      view: options?.view ?? 'chat',
      conversationId: options?.conversationId,
      petId: options?.petId ?? config.petId
    })
  })

  ipcMain.handle('get-chat-open-options', () => consumePendingChatOptions())

  ipcMain.handle('show-pet', () => showPet())
  ipcMain.handle('hide-pet', () => hidePet())
  ipcMain.handle('toggle-visible', () => toggleVisible())
  ipcMain.handle('quit-app', () => app.quit())

  ipcMain.handle('get-api-key-status', () => chatGetApiKeyStatus())
  ipcMain.handle('set-api-key', (_event, apiKey: string) =>
    chatSetApiKey(apiKey)
  )
  ipcMain.handle('clear-api-key', () => chatClearApiKey())
  ipcMain.handle('test-api-key', (_event, apiKey?: string) =>
    chatTestApiKey(apiKey)
  )

  ipcMain.handle('get-persona-profile', (_event, petId: unknown) =>
    chatGetPersonaProfile(resolveRegisteredPetId(petId))
  )
  ipcMain.handle('update-persona-profile', (_event, input: UpdatePersonaInput) => {
    if (!input || typeof input !== 'object' || !input.fields) {
      throw new Error('人设更新参数不合法')
    }
    return chatUpdatePersonaProfile(
      resolveRegisteredPetId(input.petId),
      input.fields
    )
  })

  ipcMain.handle('list-conversations', (_event, petId: unknown) =>
    chatListConversations(resolveRegisteredPetId(petId))
  )
  ipcMain.handle('create-conversation', (_event, petId: unknown, title?: string) =>
    chatCreateConversation(
      resolveRegisteredPetId(petId),
      title,
      config.defaultResponseLanguage
    )
  )
  ipcMain.handle('get-conversation-response-language', (_event, conversationId: unknown) =>
    chatGetConversationResponseLanguage(resolveConversationId(conversationId))
  )
  ipcMain.handle(
    'set-conversation-response-language',
    (_event, conversationId: unknown, language: unknown) =>
      chatUpdateConversationResponseLanguage(
        resolveConversationId(conversationId),
        normalizeChatLanguage(language)
      )
  )
  ipcMain.handle('rename-conversation', (_event, conversationId: unknown, title: string) =>
    chatRenameConversation(resolveConversationId(conversationId), title)
  )
  ipcMain.handle('delete-conversation', (_event, conversationId: unknown) =>
    chatDeleteConversation(resolveConversationId(conversationId))
  )
  ipcMain.handle('get-conversation-messages', (_event, conversationId: unknown) =>
    chatGetMessages(resolveConversationId(conversationId))
  )
  ipcMain.handle('send-chat-message', (_event, input: SendChatMessageInput) =>
    sendChatMessage(input)
  )
  ipcMain.handle('stop-chat-generation', (_event, conversationId?: string) =>
    stopChatGeneration(conversationId)
  )

  ipcMain.handle('get-timer-status', () => timerService.getStatus())
  ipcMain.handle('update-timer-config', (_event, config: TimerConfig) => {
    timerService.updateConfig(config)
  })
  ipcMain.handle('start-pomodoro', () => {
    timerService.startPomodoro()
  })
  ipcMain.handle('stop-pomodoro', () => {
    timerService.stopPomodoro()
  })
  ipcMain.handle('reset-rest-timer', () => {
    timerService.resetRestTimer()
  })
}

function wireBusinessEvents(): void {
  // AI 生成状态 → 桌宠 busy/idle（仅投递桌宠窗口）
  onBusinessEvent((event) => {
    mainWindow?.webContents.send('business-event', event)
  })

  // 计时器事件 → 桌宠 + 聊天窗口都投递
  timerService.start(
    (channel, payload) => {
      mainWindow?.webContents.send(channel, payload)
      broadcastToChat(channel, payload)
    },
    () => config.visible
  )
}

app.whenReady().then(() => {
  // 产品更名迁移：旧 userData（胡桃桌宠）→ 新 userData，仅首次执行
  migrateLegacyUserData()
  config = loadConfig()
  // 启动时强制可见，清掉上次「隐藏」导致的无法恢复状态
  config.visible = true

  const appIcon = resolveAppIcon()
  if (!appIcon.isEmpty() && process.platform === 'darwin') {
    app.dock?.setIcon(appIcon)
  }

  registerIpc()
  // 预热数据库与旧数据迁移：在窗口显示前完成，避免首次聊天时冻结主进程
  getChatDb()
  createWindow()
  createTray()
  wireBusinessEvents()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
    showPet()
  })
})

app.on('window-all-closed', () => {
  if (!tray) {
    app.quit()
  }
})

app.on('before-quit', () => {
  timerService.stop()
  disposeChatService()
  disposeChatWindow()
  closeChatDb()
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition()
    config.windowX = x
    config.windowY = y
    saveConfig(config)
  }
})
