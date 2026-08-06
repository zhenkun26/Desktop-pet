import { BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import type { OpenChatOptions } from '../shared/types'
import { resolveAppIcon } from './icons'
import { onChatStream, stopChatGeneration } from './services/chat/chat-service'

const CHAT_WIDTH = 480
const CHAT_HEIGHT = 640

let chatWindow: BrowserWindow | null = null
let pendingOptions: OpenChatOptions | null = null
let unsubscribeStream: (() => void) | null = null

const isDev = !app.isPackaged

export function getChatWindow(): BrowserWindow | null {
  return chatWindow
}

export function consumePendingChatOptions(): OpenChatOptions | null {
  const options = pendingOptions
  pendingOptions = null
  return options
}

export function openChatWindow(options: OpenChatOptions = {}): void {
  pendingOptions = options

  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.isMinimized()) chatWindow.restore()
    chatWindow.show()
    chatWindow.focus()
    chatWindow.webContents.send('chat-open-options', options)
    pendingOptions = null
    return
  }

  const appIcon = resolveAppIcon()
  chatWindow = new BrowserWindow({
    width: CHAT_WIDTH,
    height: CHAT_HEIGHT,
    minWidth: 380,
    minHeight: 480,
    title: `二次元桌宠 v${app.getVersion()} - 聊天`,
    show: false,
    backgroundColor: '#fdf6f0',
    autoHideMenuBar: true,
    ...(appIcon.isEmpty() ? {} : { icon: appIcon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // 流式事件定向投递：订阅一次服务事件，转发到聊天窗口（不用全局广播）
  if (!unsubscribeStream) {
    unsubscribeStream = onChatStream((event) => {
      broadcastToChat('chat-stream', event)
    })
  }

  chatWindow.once('ready-to-show', () => {
    chatWindow?.show()
  })

  chatWindow.webContents.on('did-finish-load', () => {
    if (pendingOptions) {
      chatWindow?.webContents.send('chat-open-options', pendingOptions)
    }
  })

  chatWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  chatWindow.on('closed', () => {
    // 关闭聊天窗口时停止进行中的生成（DB 中已有 streaming 部分内容，
    // 重开窗口时可直接恢复查看）
    stopChatGeneration()
    chatWindow = null
    pendingOptions = null
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
    void chatWindow.loadURL(`${base}/chat.html`)
  } else {
    void chatWindow.loadFile(join(__dirname, '../renderer/chat.html'))
  }
}

export function broadcastToChat(channel: string, payload: unknown): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send(channel, payload)
  }
}

export function disposeChatWindow(): void {
  stopChatGeneration()
  unsubscribeStream?.()
  unsubscribeStream = null
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.destroy()
  }
  chatWindow = null
  pendingOptions = null
}
