import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hutaoAvatarUrl from './assets/hutao.png'
import type {
  ApiKeyStatus,
  ChatLanguage,
  ChatMessageRecord,
  ChatStreamEvent,
  ConversationRecord,
  PetConfig,
  PetDescriptor,
  PetId,
  PersonaProfile,
  TimerStatus
} from '../shared/types'
import { CHAT_LANGUAGE_LABELS, CHAT_LANGUAGES } from '../shared/types'
import { resolvePetAssetUrl } from './pet-assets'
import {
  updateCurrentLanguage,
  updateDefaultLanguage
} from './language-settings'

marked.setOptions({ breaks: true, gfm: true })

type ViewName = 'chat' | 'persona' | 'timer' | 'settings'

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

/** 思考轮播文案（每 3s 轮换） */
const THINKING_LINES = [
  '胡桃正在认真思考…',
  '本堂主马上就想好了…',
  '灵感灵感快快来…',
  '正在组织绝妙的发言…',
  '嘿嘿，这个问题有意思…'
]

// ===== 应用状态 =====
const state = {
  currentView: 'chat' as ViewName,
  conversations: [] as ConversationRecord[],
  currentConversationId: null as string | null,
  messages: [] as ChatMessageRecord[],
  // 流式状态（UI 层；数据库才是事实来源，结束后统一重载）
  streaming: false,
  streamingConvId: null as string | null,
  streamingContent: '',
  finalized: true,
  config: null as PetConfig | null,
  persona: null as PersonaProfile | null,
  apiKeyStatus: null as ApiKeyStatus | null,
  timerStatus: null as TimerStatus | null,
  currentPet: null as PetDescriptor | null
}

function getCurrentPet(): PetDescriptor {
  if (!state.currentPet) {
    throw new Error('当前角色尚未加载')
  }
  return state.currentPet
}

function petAvatarUrl(): string {
  return resolvePetAssetUrl(getCurrentPet().assetFileName) ?? hutaoAvatarUrl
}

/** 把当前角色上下文应用到聊天窗口 UI（头像、名称、标题、输入框占位）。 */
function applyPetContext(): void {
  const pet = state.currentPet
  if (!pet) return
  document.title = `${pet.displayName} · 二次元桌宠 - 聊天`
  const avatar = document.querySelector<HTMLImageElement>('.header-avatar')
  if (avatar) avatar.src = petAvatarUrl()
  const nameEl = document.querySelector<HTMLElement>('.header-name')
  if (nameEl) nameEl.textContent = pet.displayName
  ;($('message-input') as HTMLTextAreaElement).placeholder =
    `和${pet.displayName}说点什么吧…`
}

async function loadPetContext(petId: PetId): Promise<void> {
  state.currentPet = await window.desktopPet.getPet(petId)
  applyPetContext()
}

// 思考气泡轮播/计时
let thinkingLineTimer: ReturnType<typeof setInterval> | null = null
let thinkingElapsedTimer: ReturnType<typeof setInterval> | null = null
// 计时器视图轮询
let timerPollTimer: ReturnType<typeof setInterval> | null = null
// 流式渲染帧合并（每帧至多解析/渲染一次，避免每个 delta 全文重解析）
let streamRenderFrame: number | null = null

function scheduleStreamRender(): void {
  if (streamRenderFrame != null) return
  streamRenderFrame = requestAnimationFrame(() => {
    streamRenderFrame = null
    renderStreamingBubble()
  })
}

function cancelStreamRender(): void {
  if (streamRenderFrame != null) {
    cancelAnimationFrame(streamRenderFrame)
    streamRenderFrame = null
  }
}

function $(id: string): HTMLElement {
  return document.getElementById(id)!
}

// ===== 视图切换 =====
function switchView(view: ViewName): void {
  state.currentView = view
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'))
  document.querySelector(`.tab[data-view="${view}"]`)?.classList.add('active')
  $(`view-${view}`)?.classList.add('active')
  if (view === 'timer') void loadTimerStatus()
}

// ===== 会话抽屉 =====
function openDrawer(): void {
  $('drawer').classList.add('open')
  $('drawer-mask').classList.add('open')
}

function closeDrawer(): void {
  $('drawer').classList.remove('open')
  $('drawer-mask').classList.remove('open')
}

async function refreshConversations(): Promise<void> {
  state.conversations = await window.desktopPet.listConversations(
    getCurrentPet().petId
  )
  renderConversationList()
  renderLanguageSettings()
}

async function loadLanguageSettings(): Promise<void> {
  state.config = await window.desktopPet.getConfig()
  renderLanguageSettings()
}

function renderLanguageSettings(): void {
  const defaultSelect = $('default-language-select') as HTMLSelectElement | null
  const currentSelect = $('current-language-select') as HTMLSelectElement | null
  const currentHint = $('current-language-hint')
  if (!defaultSelect || !currentSelect || !currentHint) return

  defaultSelect.value = state.config?.defaultResponseLanguage ?? 'zh-CN'
  const currentConversation = state.conversations.find(
    (conversation) => conversation.id === state.currentConversationId
  )
  const hasCurrentConversation = Boolean(currentConversation)
  currentSelect.disabled = !hasCurrentConversation
  currentSelect.value =
    currentConversation?.responseLanguage ??
    state.config?.defaultResponseLanguage ??
    'zh-CN'
  currentHint.textContent = hasCurrentConversation
    ? '仅影响下一条发送的消息；历史消息不会被翻译。'
    : '当前没有打开的会话，修改后将作为新会话默认语言。'
}

function populateLanguageOptions(): void {
  const options = CHAT_LANGUAGES.map(
    (language) =>
      `<option value="${language}">${CHAT_LANGUAGE_LABELS[language]}</option>`
  ).join('')
  for (const id of ['default-language-select', 'current-language-select']) {
    const select = $(id) as HTMLSelectElement
    select.innerHTML = options
  }
}

function renderConversationList(): void {
  const list = $('conv-list')
  list.innerHTML = ''

  if (state.conversations.length === 0) {
    list.innerHTML =
      `<div class="conv-empty">还没有陪伴记录哦<br />快来和${getCurrentPet().displayName}说第一句话吧～</div>`
    return
  }

  for (const conv of state.conversations) {
    const item = document.createElement('div')
    item.className = 'conv-item'
    if (conv.id === state.currentConversationId) item.classList.add('active')

    const time = new Date(conv.updatedAt).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    item.innerHTML = `
      <div class="conv-main">
        <div class="conv-title">${escapeHtml(conv.title)}</div>
        <div class="conv-preview">${escapeHtml(conv.lastMessagePreview || '…')}</div>
        <div class="conv-time">${time}</div>
      </div>
      <div class="conv-actions">
        <span class="conv-action" data-action="rename" title="重命名">✎</span>
        <span class="conv-action" data-action="delete" title="删除">×</span>
      </div>
    `

    item.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).dataset.action
      if (action === 'delete') {
        e.stopPropagation()
        if (window.confirm('确定删除这个会话吗？删除后无法恢复。')) {
          void deleteConversation(conv.id)
        }
      } else if (action === 'rename') {
        e.stopPropagation()
        startRenameConversation(conv.id, conv.title, item)
      } else {
        void selectConversation(conv.id)
        closeDrawer()
      }
    })

    list.appendChild(item)
  }
}

function startRenameConversation(
  convId: string,
  currentTitle: string,
  item: HTMLElement
): void {
  const titleEl = item.querySelector('.conv-title') as HTMLElement | null
  if (!titleEl) return

  const input = document.createElement('input')
  input.type = 'text'
  input.value = currentTitle
  input.className = 'conv-rename-input'
  titleEl.replaceWith(input)
  input.focus()
  input.select()

  const save = async (): Promise<void> => {
    const newTitle = input.value.trim()
    if (newTitle && newTitle !== currentTitle) {
      await window.desktopPet.renameConversation(convId, newTitle)
      await refreshConversations()
    } else {
      renderConversationList()
    }
  }

  input.addEventListener('blur', () => void save())
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      input.blur()
    } else if (e.key === 'Escape') {
      renderConversationList()
    }
  })
}

async function createNewConversation(): Promise<void> {
  const conv = await window.desktopPet.createConversation(getCurrentPet().petId)
  state.currentConversationId = conv.id
  state.messages = []
  await refreshConversations()
  renderMessages()
}

async function deleteConversation(convId: string): Promise<void> {
  await window.desktopPet.deleteConversation(convId)
  if (state.currentConversationId === convId) {
    state.currentConversationId = null
    state.messages = []
    renderMessages()
  }
  await refreshConversations()
}

async function selectConversation(convId: string): Promise<void> {
  state.currentConversationId = convId
  state.messages = await window.desktopPet.getConversationMessages(convId)
  renderConversationList()
  renderMessages()
  // 如果该会话仍在生成中，恢复流式气泡
  if (state.streaming && state.streamingConvId === convId) {
    renderStreamingBubble()
  }
}

// ===== 消息渲染 =====
function renderMessages(): void {
  const listEl = $('message-list')
  listEl.innerHTML = ''

  const visible = state.messages.filter((m) => m.role !== 'system')

  if (visible.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    const pet = getCurrentPet()
    empty.innerHTML = `
      <img class="empty-avatar" src="${petAvatarUrl()}" alt="${pet.displayName}" />
      <div class="empty-text">嗷～${pet.displayName}终于来找我啦！<br />今天想聊点什么？</div>
      <button class="empty-btn" id="empty-new-btn">开始聊天</button>
    `
    empty.querySelector('#empty-new-btn')?.addEventListener('click', () => {
      ;($('message-input') as HTMLTextAreaElement).focus()
    })
    listEl.appendChild(empty)
  } else {
    for (const msg of visible) {
      const rendered = renderMessage(msg)
      if (rendered) listEl.appendChild(rendered)
    }
  }

  scrollToBottom()
}

function renderMessage(msg: ChatMessageRecord): HTMLElement | null {
  if (msg.status === 'error') {
    const div = document.createElement('div')
    div.className = 'message error'
    div.textContent = `⚠ ${msg.content || '生成失败，请稍后再试'}`
    return div
  }

  if (msg.status === 'cancelled') {
    const div = document.createElement('div')
    div.className = 'message cancelled'
    div.textContent = msg.content
      ? `${msg.content}（已停止）`
      : '（已停止生成）'
    return div
  }

  const row = document.createElement('div')
  row.className = `msg-row ${msg.role}`

  const bubble = document.createElement('div')
  bubble.className = `message ${msg.role}`

  if (msg.role === 'assistant') {
    const rawHtml = marked.parse(msg.content || '…') as string
    bubble.innerHTML = DOMPurify.sanitize(rawHtml)
    const avatar = document.createElement('img')
    avatar.className = 'msg-avatar'
    avatar.src = petAvatarUrl()
    avatar.alt = getCurrentPet().displayName
    row.append(avatar, bubble)
  } else {
    bubble.textContent = msg.content
    row.appendChild(bubble)
  }

  return row
}

function scrollToBottom(): void {
  const area = $('message-area')
  area.scrollTop = area.scrollHeight
}

// ===== 思考气泡（轮播文案 + 灰色计时） =====
function showThinkingBubble(): void {
  const container = $('stream-container')
  container.innerHTML = ''

  const row = document.createElement('div')
  row.className = 'msg-row assistant'
  row.id = 'thinking-row'

  const avatar = document.createElement('img')
  avatar.className = 'msg-avatar'
  avatar.src = petAvatarUrl()
  avatar.alt = getCurrentPet().displayName

  const bubble = document.createElement('div')
  bubble.className = 'message assistant thinking-bubble'
  bubble.innerHTML = `
    <div class="thinking-status" id="thinking-status">${THINKING_LINES[0]}</div>
    <div class="thinking-timer" id="thinking-timer">已思考 0s</div>
  `

  row.append(avatar, bubble)
  container.appendChild(row)
  scrollToBottom()

  const startedAt = Date.now()
  let lineIndex = 0
  clearThinkingTimers()
  thinkingLineTimer = setInterval(() => {
    lineIndex = (lineIndex + 1) % THINKING_LINES.length
    const el = document.getElementById('thinking-status')
    if (el) el.textContent = THINKING_LINES[lineIndex]
  }, 3000)
  thinkingElapsedTimer = setInterval(() => {
    const el = document.getElementById('thinking-timer')
    if (el) el.textContent = `已思考 ${Math.floor((Date.now() - startedAt) / 1000)}s`
  }, 1000)

  setHeaderThinking(true)
}

function clearThinkingTimers(): void {
  if (thinkingLineTimer) {
    clearInterval(thinkingLineTimer)
    thinkingLineTimer = null
  }
  if (thinkingElapsedTimer) {
    clearInterval(thinkingElapsedTimer)
    thinkingElapsedTimer = null
  }
}

function renderStreamingBubble(): void {
  cancelStreamRender()
  const container = $('stream-container')
  // 首个 delta 到达：思考气泡换成正文气泡
  if (!document.getElementById('stream-bubble')) {
    clearThinkingTimers()
    container.innerHTML = ''
    const row = document.createElement('div')
    row.className = 'msg-row assistant'
    const avatar = document.createElement('img')
    avatar.className = 'msg-avatar'
    avatar.src = petAvatarUrl()
    avatar.alt = getCurrentPet().displayName
    const bubble = document.createElement('div')
    bubble.className = 'message assistant'
    bubble.id = 'stream-bubble'
    row.append(avatar, bubble)
    container.appendChild(row)
  }
  const bubble = document.getElementById('stream-bubble')!
  const rawHtml = marked.parse(state.streamingContent || '…') as string
  bubble.innerHTML =
    DOMPurify.sanitize(rawHtml) + '<span class="stream-caret"></span>'
  scrollToBottom()
}

function clearStreamContainer(): void {
  $('stream-container').innerHTML = ''
}

function setHeaderThinking(thinking: boolean): void {
  const el = $('header-status')
  el.textContent = thinking ? '正在思考…' : '在线'
  el.classList.toggle('thinking', thinking)
}

// ===== 发送 / 流式 =====
function setStreamingUI(streaming: boolean): void {
  const sendBtn = $('send-btn') as HTMLButtonElement
  const input = $('message-input') as HTMLTextAreaElement
  if (streaming) {
    sendBtn.textContent = '■'
    sendBtn.title = '停止生成'
    sendBtn.classList.add('stop')
    sendBtn.disabled = false
  } else {
    sendBtn.textContent = '➤'
    sendBtn.title = '发送'
    sendBtn.classList.remove('stop')
    sendBtn.disabled = input.value.trim().length === 0
    setHeaderThinking(false)
  }
}

async function sendMessage(): Promise<void> {
  const input = $('message-input') as HTMLTextAreaElement
  const content = input.value.trim()
  if (!content) return

  if (state.streaming) {
    // 按钮此时是「停止」
    void window.desktopPet.stopChatGeneration(state.streamingConvId ?? undefined)
    return
  }

  if (!state.currentConversationId) {
    await createNewConversation()
    if (!state.currentConversationId) return
  }
  const convId = state.currentConversationId

  // 清空输入
  input.value = ''
  input.style.height = 'auto'
  ;($('send-btn') as HTMLButtonElement).disabled = true

  // 乐观渲染 user 消息
  state.messages.push({
    id: 'temp-' + Date.now(),
    conversationId: convId,
    role: 'user',
    content,
    createdAt: Date.now(),
    status: 'complete',
    errorCode: null
  })
  renderMessages()

  // 思考气泡 + 流式 UI
  state.streaming = true
  state.streamingConvId = convId
  state.streamingContent = ''
  state.finalized = false
  showThinkingBubble()
  setStreamingUI(true)

  try {
    // invoke 挂到生成终结才返回：完成信号不依赖事件通道（三重保障核心）
    const result = await window.desktopPet.sendChatMessage({
      conversationId: convId,
      content
    })
    if (!result.ok && state.streamingConvId === convId && !state.finalized) {
      await finalizeStream(convId, result.error)
    }
  } catch (error) {
    console.error('send chat invoke error:', error)
    if (!state.finalized) {
      await finalizeStream(convId, '发送失败，请检查网络或 API 设置')
    }
  }
}

/**
 * 生成终结（done / error / cancelled / invoke 返回都会走到这里，幂等）：
 * 数据库是单一事实来源 —— 重载消息，清空流式 UI，恢复输入区。
 */
async function finalizeStream(convId: string, errorText?: string): Promise<void> {
  if (state.finalized) return
  state.finalized = true

  clearThinkingTimers()
  cancelStreamRender()
  state.streaming = false
  state.streamingContent = ''
  const wasCurrent = state.streamingConvId === state.currentConversationId
  state.streamingConvId = null

  if (wasCurrent) {
    clearStreamContainer()
    state.messages = await window.desktopPet.getConversationMessages(convId)
    renderMessages()
    if (errorText) {
      const div = document.createElement('div')
      div.className = 'message error'
      div.textContent = `⚠ ${errorText}`
      $('message-list').appendChild(div)
      scrollToBottom()
    }
  }
  setStreamingUI(false)
  void refreshConversations()
}

function handleStreamEvent(event: ChatStreamEvent): void {
  switch (event.type) {
    case 'start':
      // assistant 消息此时已落库（status=streaming）
      state.streaming = true
      state.streamingConvId = event.conversationId
      state.streamingContent = ''
      state.finalized = false
      if (event.conversationId === state.currentConversationId) {
        if (!document.getElementById('thinking-row') && !document.getElementById('stream-bubble')) {
          showThinkingBubble()
        }
        setStreamingUI(true)
      }
      break

    case 'delta':
      if (event.conversationId !== state.streamingConvId) break
      state.streamingContent += event.delta
      if (event.conversationId === state.currentConversationId) {
        scheduleStreamRender()
      }
      break

    case 'done':
    case 'cancelled':
      void finalizeStream(event.conversationId)
      break

    case 'error':
      void finalizeStream(event.conversationId, event.message)
      break
  }
}

// ===== 角色设定 =====
async function loadPersona(): Promise<void> {
  try {
    state.persona = await window.desktopPet.getPersonaProfile(
      getCurrentPet().petId
    )
    renderPersonaForm()
  } catch (e) {
    console.error('加载人设失败:', e)
  }
}

function renderPersonaForm(): void {
  const pet = getCurrentPet()
  $('core-identity').textContent = pet.coreIdentity
  $('speech-style').textContent = pet.speechStyle

  if (!state.persona) return
  const p = state.persona
  ;($('f-userCallName') as HTMLInputElement).value = p.userCallName
  ;($('f-relationship') as HTMLInputElement).value = p.relationship
  ;($('f-personalityBias') as HTMLSelectElement).value = p.personalityBias
  ;($('f-tonePreference') as HTMLSelectElement).value = p.tonePreference
  ;($('f-extraNotes') as HTMLTextAreaElement).value = p.extraNotes
}

async function savePersona(): Promise<void> {
  const btn = $('save-persona-btn') as HTMLButtonElement
  btn.disabled = true
  btn.textContent = '保存中…'
  try {
    state.persona = await window.desktopPet.updatePersonaProfile({
      petId: getCurrentPet().petId,
      fields: {
        userCallName: ($('f-userCallName') as HTMLInputElement).value,
        relationship: ($('f-relationship') as HTMLInputElement).value,
        personalityBias: ($('f-personalityBias') as HTMLSelectElement)
          .value as PersonaProfile['personalityBias'],
        tonePreference: ($('f-tonePreference') as HTMLSelectElement)
          .value as PersonaProfile['tonePreference'],
        extraNotes: ($('f-extraNotes') as HTMLTextAreaElement).value
      }
    })
    renderPersonaForm()
    btn.textContent = '已保存 ✓'
  } catch (e) {
    console.error(e)
    btn.textContent = '保存失败'
  } finally {
    setTimeout(() => {
      btn.textContent = '保存设置'
      btn.disabled = false
    }, 1500)
  }
}

// ===== 计时器视图 =====
function fmtSecs(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60)
  const s = Math.floor(totalSecs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function setRing(ringId: string, fraction: number): void {
  const ring = $(ringId) as unknown as SVGCircleElement
  const clamped = Math.max(0, Math.min(1, fraction))
  ring.style.strokeDasharray = `${RING_C}`
  ring.style.strokeDashoffset = `${RING_C * (1 - clamped)}`
}

async function loadTimerStatus(): Promise<void> {
  try {
    state.timerStatus = await window.desktopPet.getTimerStatus()
    renderTimerStatus()
  } catch (e) {
    console.error('加载计时器状态失败:', e)
  }
}

function renderTimerStatus(): void {
  const status = state.timerStatus
  if (!status) return

  // 休息提醒环：剩余时间
  const restRemaining = Math.max(0, status.restIntervalSecs - status.activeSecs)
  setRing('rest-ring', status.activeSecs / Math.max(1, status.restIntervalSecs))
  $('rest-ring-text').textContent = fmtSecs(restRemaining)
  $('rest-label').textContent = `本次已陪伴 ${Math.floor(status.activeSecs / 60)} 分钟`

  // 番茄钟环
  const pomoRing = $('pomodoro-ring')
  if (status.pomodoroActive) {
    const remaining = Math.max(0, status.pomodoroTotal - status.pomodoroElapsed)
    setRing('pomodoro-ring', status.pomodoroElapsed / Math.max(1, status.pomodoroTotal))
    $('pomodoro-ring-text').textContent = fmtSecs(remaining)
    $('pomodoro-label').textContent =
      status.pomodoroPhase === 'working' ? '专注中，加油！' : '休息一下吧～'
    pomoRing.classList.toggle('work', status.pomodoroPhase === 'working')
    pomoRing.classList.toggle('break', status.pomodoroPhase === 'break')
    ;($('start-pomodoro-btn') as HTMLButtonElement).disabled = true
    ;($('stop-pomodoro-btn') as HTMLButtonElement).disabled = false
  } else {
    setRing('pomodoro-ring', 0)
    $('pomodoro-ring-text').textContent = '--:--'
    $('pomodoro-label').textContent = '未开始'
    ;($('start-pomodoro-btn') as HTMLButtonElement).disabled = false
    ;($('stop-pomodoro-btn') as HTMLButtonElement).disabled = true
  }

  // 配置回填（仅未聚焦时，避免打断输入）
  const restInput = $('rest-interval-input') as HTMLInputElement
  const workInput = $('work-mins-input') as HTMLInputElement
  const breakInput = $('break-mins-input') as HTMLInputElement
  if (document.activeElement !== restInput) {
    restInput.value = String(Math.round(status.config.restIntervalSecs / 60))
  }
  if (document.activeElement !== workInput) {
    workInput.value = String(Math.round(status.config.workSecs / 60))
  }
  if (document.activeElement !== breakInput) {
    breakInput.value = String(Math.round(status.config.breakSecs / 60))
  }
}

async function applyTimerConfig(): Promise<void> {
  const restMins = Number(($('rest-interval-input') as HTMLInputElement).value)
  const workMins = Number(($('work-mins-input') as HTMLInputElement).value)
  const breakMins = Number(($('break-mins-input') as HTMLInputElement).value)
  const clamp = (v: number, min: number, max: number, fallback: number): number =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback

  const config = {
    restIntervalSecs: clamp(restMins, 10, 120, 45) * 60,
    workSecs: clamp(workMins, 5, 90, 25) * 60,
    breakSecs: clamp(breakMins, 3, 30, 5) * 60
  }
  await window.desktopPet.updateTimerConfig(config)
  await loadTimerStatus()
}

// ===== API 设置 =====
async function loadApiKeyStatus(): Promise<void> {
  try {
    state.apiKeyStatus = await window.desktopPet.getApiKeyStatus()
    renderApiKeyStatus()
  } catch (e) {
    console.error('加载 API Key 状态失败:', e)
  }
}

function renderApiKeyStatus(): void {
  const el = $('api-status')
  if (!state.apiKeyStatus) {
    el.textContent = '加载中…'
    return
  }
  if (state.apiKeyStatus.configured) {
    el.textContent = state.apiKeyStatus.masked ?? '已配置'
    el.className = 'status-value configured'
  } else {
    el.textContent = '未配置'
    el.className = 'status-value not-configured'
  }
}

async function saveApiKey(): Promise<void> {
  const input = $('api-key-input') as HTMLInputElement
  const key = input.value.trim()
  if (!key) return
  const btn = $('save-key-btn') as HTMLButtonElement
  btn.disabled = true
  try {
    await window.desktopPet.setApiKey(key)
    input.value = ''
    await loadApiKeyStatus()
    btn.textContent = '已保存 ✓'
  } catch (e) {
    console.error(e)
    btn.textContent = '保存失败'
  } finally {
    setTimeout(() => {
      btn.textContent = '保存'
      btn.disabled = false
    }, 1500)
  }
}

async function deleteApiKey(): Promise<void> {
  const btn = $('delete-key-btn') as HTMLButtonElement
  btn.disabled = true
  try {
    await window.desktopPet.clearApiKey()
    await loadApiKeyStatus()
    btn.textContent = '已删除 ✓'
  } catch (e) {
    console.error(e)
    btn.textContent = '删除失败'
  } finally {
    setTimeout(() => {
      btn.textContent = '删除'
      btn.disabled = false
    }, 1500)
  }
}

async function testApiKey(): Promise<void> {
  const btn = $('test-key-btn') as HTMLButtonElement
  const resultDiv = $('test-result')
  btn.disabled = true
  btn.textContent = '测试中…'
  resultDiv.textContent = ''

  const input = $('api-key-input') as HTMLInputElement
  const key = input.value.trim() || undefined

  try {
    const { ok, message } = await window.desktopPet.testApiKey(key)
    resultDiv.className = 'test-result ' + (ok ? 'ok' : 'fail')
    resultDiv.textContent = message
  } catch (e) {
    resultDiv.className = 'test-result fail'
    resultDiv.textContent = '测试失败: ' + (e as Error).message
  } finally {
    btn.textContent = '测试连接'
    btn.disabled = false
  }
}

// ===== 对话语言设置 =====
async function saveDefaultResponseLanguage(): Promise<void> {
  const select = $('default-language-select') as HTMLSelectElement
  try {
    state.config = await updateDefaultLanguage(
      window.desktopPet,
      select.value as ChatLanguage
    )
    renderLanguageSettings()
  } catch (error) {
    console.error('保存默认对话语言失败:', error)
    renderLanguageSettings()
  }
}

async function saveCurrentResponseLanguage(): Promise<void> {
  const select = $('current-language-select') as HTMLSelectElement
  try {
    const updated = await updateCurrentLanguage(
      window.desktopPet,
      state.currentConversationId,
      select.value as ChatLanguage
    )
    if (updated) {
      state.conversations = state.conversations.map((conversation) =>
        conversation.id === updated.id ? updated : conversation
      )
    } else {
      state.config = await window.desktopPet.getConfig()
    }
    renderConversationList()
    renderLanguageSettings()
  } catch (error) {
    console.error('保存当前会话语言失败:', error)
    renderLanguageSettings()
  }
}

// ===== 工具 =====
function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

// ===== 启动 =====
async function bootstrap(): Promise<void> {
  // 先注册事件监听，确保不丢事件
  window.desktopPet.onChatStream(handleStreamEvent)
  window.desktopPet.onChatOpenOptions((options) => {
    if (options.petId && options.petId !== state.currentPet?.petId) {
      state.currentConversationId = null
      state.messages = []
      void loadPetContext(options.petId)
        .then(() => Promise.all([refreshConversations(), loadPersona()]))
        .then(() => renderMessages())
    }
    if (options.view) switchView(options.view)
    if (options.conversationId) void selectConversation(options.conversationId)
  })
  window.desktopPet.onPomodoroTick(() => {
    if (state.currentView === 'timer') void loadTimerStatus()
  })
  window.desktopPet.onPomodoroDone(() => {
    if (state.currentView === 'timer') void loadTimerStatus()
  })

  // Tab 切换
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      switchView((tab as HTMLElement).dataset.view as ViewName)
    })
  })

  // 抽屉
  $('drawer-toggle').addEventListener('click', () => {
    void refreshConversations()
    openDrawer()
  })
  $('drawer-mask').addEventListener('click', closeDrawer)
  $('new-chat-btn').addEventListener('click', () => {
    void createNewConversation()
    closeDrawer()
  })

  // 输入区
  const input = $('message-input') as HTMLTextAreaElement
  const sendBtn = $('send-btn') as HTMLButtonElement
  input.addEventListener('input', () => {
    if (!state.streaming) sendBtn.disabled = input.value.trim().length === 0
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 96) + 'px'
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  })
  sendBtn.addEventListener('click', () => void sendMessage())

  // 面板按钮
  $('save-persona-btn').addEventListener('click', () => void savePersona())
  $('save-key-btn').addEventListener('click', () => void saveApiKey())
  $('delete-key-btn').addEventListener('click', () => void deleteApiKey())
  $('test-key-btn').addEventListener('click', () => void testApiKey())
  $('default-language-select').addEventListener('change', () => {
    void saveDefaultResponseLanguage()
  })
  $('current-language-select').addEventListener('change', () => {
    void saveCurrentResponseLanguage()
  })
  $('apply-rest-btn').addEventListener('click', () => void applyTimerConfig())
  $('work-mins-input').addEventListener('change', () => void applyTimerConfig())
  $('break-mins-input').addEventListener('change', () => void applyTimerConfig())
  $('reset-rest-btn').addEventListener('click', () => {
    void window.desktopPet.resetRestTimer().then(loadTimerStatus)
  })
  $('start-pomodoro-btn').addEventListener('click', () => {
    void applyTimerConfig()
      .then(() => window.desktopPet.startPomodoro())
      .then(loadTimerStatus)
  })
  $('stop-pomodoro-btn').addEventListener('click', () => {
    void window.desktopPet.stopPomodoro().then(loadTimerStatus)
  })

  // 加载角色上下文（默认胡桃，托盘/菜单可指定）
  const pending = await window.desktopPet.getChatOpenOptions()
  await loadPetContext(pending?.petId ?? 'hutao')
  populateLanguageOptions()

  // 加载数据
  await Promise.all([
    loadLanguageSettings(),
    refreshConversations(),
    loadPersona(),
    loadApiKeyStatus()
  ])
  await loadTimerStatus()

  // 应用打开参数（托盘/菜单指定视图或会话）
  if (pending?.view) switchView(pending.view)
  if (pending?.conversationId) {
    await selectConversation(pending.conversationId)
  }

  renderMessages()

  // 计时器视图轮询（休息提醒环）
  timerPollTimer = setInterval(() => {
    if (state.currentView === 'timer' && !state.timerStatus?.pomodoroActive) {
      void loadTimerStatus()
    } else if (state.currentView === 'timer') {
      void loadTimerStatus()
    }
  }, 5000)
  void timerPollTimer
}

void bootstrap()
