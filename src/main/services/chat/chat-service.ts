import { randomUUID } from 'crypto'
import type {
  ChatErrorCode,
  ChatStreamEvent,
  PetBusinessEvent,
  PetId,
  SendChatMessageInput
} from '../../../shared/types'
import {
  createConversation,
  deleteConversation,
  getConversation,
  getConversationMessages,
  getPersonaProfile,
  getRecentContextMessages,
  insertMessage,
  listConversations,
  renameConversation,
  updateMessage,
  updatePersonaProfile
} from './chat-db'
import {
  DeepSeekApiError,
  streamChatCompletion,
  testApiKeyConnection,
  type DeepSeekChatMessage
} from './deepseek-client'
import { buildSystemPrompt } from './prompt-builder'
import {
  clearApiKey,
  getApiKey,
  getApiKeyStatus,
  setApiKey,
  validateApiKeyFormat
} from './secrets-store'
import {
  clearListenerErrorHandlers,
  onListenerError,
  safeEmit
} from './event-emitter'
import { validateChatContent } from './chat-input'

export { onListenerError }

/** 流式 delta 落库节流间隔（毫秒）：避免每个 token 一次同步写库。 */
const DB_FLUSH_INTERVAL_MS = 120

type StreamListener = (event: ChatStreamEvent) => void
type BusinessListener = (event: PetBusinessEvent) => void

const activeControllers = new Map<string, AbortController>()
const streamListeners = new Set<StreamListener>()
const businessListeners = new Set<BusinessListener>()

export function onChatStream(listener: StreamListener): () => void {
  streamListeners.add(listener)
  return () => {
    streamListeners.delete(listener)
  }
}

export function onBusinessEvent(listener: BusinessListener): () => void {
  businessListeners.add(listener)
  return () => {
    businessListeners.delete(listener)
  }
}

export function chatGetApiKeyStatus() {
  return getApiKeyStatus()
}

export function chatSetApiKey(apiKey: string) {
  return setApiKey(apiKey)
}

export function chatClearApiKey() {
  return clearApiKey()
}

export async function chatTestApiKey(apiKey?: string) {
  const key =
    apiKey != null && apiKey.trim()
      ? validateApiKeyFormat(apiKey)
      : getApiKey()
  if (!key) {
    return { ok: false, message: '尚未配置 API Key' }
  }
  return testApiKeyConnection(key)
}

export function chatGetPersonaProfile(petId: PetId) {
  return getPersonaProfile(petId)
}

export function chatUpdatePersonaProfile(
  ...args: Parameters<typeof updatePersonaProfile>
) {
  return updatePersonaProfile(...args)
}

export function chatListConversations(
  ...args: Parameters<typeof listConversations>
) {
  return listConversations(...args)
}

export function chatCreateConversation(
  ...args: Parameters<typeof createConversation>
) {
  return createConversation(...args)
}

export function chatRenameConversation(
  ...args: Parameters<typeof renameConversation>
) {
  return renameConversation(...args)
}

export function chatDeleteConversation(conversationId: string) {
  stopChatGeneration(conversationId)
  return { ok: deleteConversation(conversationId) }
}

export function chatGetMessages(conversationId: string) {
  return getConversationMessages(conversationId)
}

export function stopChatGeneration(conversationId?: string): { ok: boolean } {
  if (conversationId) {
    const controller = activeControllers.get(conversationId)
    if (controller) {
      controller.abort()
      activeControllers.delete(conversationId)
      return { ok: true }
    }
    return { ok: false }
  }
  for (const [id, controller] of activeControllers) {
    controller.abort()
    activeControllers.delete(id)
  }
  return { ok: true }
}

/**
 * 发送聊天消息。
 *
 * 关键设计（v2 架构）：
 * - assistant 消息在 start 时即落库（status='streaming'），每个 delta 实时更新该行，
 *   数据库始终是单一事实来源 —— 渲染层任何时候都能重载恢复
 * - 本函数（IPC invoke）直到生成终结才返回 —— 完成信号不依赖事件通道，
 *   chat-stream 事件只是增量优化，即使全部丢失 UI 也不会卡死
 */
export async function sendChatMessage(
  input: SendChatMessageInput
): Promise<{ ok: boolean; error?: string; code?: ChatErrorCode }> {
  const validation = validateChatContent(input?.content)
  if (!validation.ok) {
    return { ok: false, error: validation.error, code: validation.code }
  }
  const content = validation.content

  const conversation = getConversation(input.conversationId)
  if (!conversation) {
    return { ok: false, error: '会话不存在', code: 'unknown' }
  }

  if (activeControllers.has(conversation.id)) {
    return { ok: false, error: '正在生成中，请先停止', code: 'unknown' }
  }

  let apiKey: string | null
  try {
    apiKey = getApiKey()
  } catch {
    return {
      ok: false,
      error: '系统加密不可用，无法读取 API Key',
      code: 'missing_api_key'
    }
  }
  if (!apiKey) {
    return {
      ok: false,
      error: '请先在设置中配置 DeepSeek API Key',
      code: 'missing_api_key'
    }
  }

  const userMessage = insertMessage({
    conversationId: conversation.id,
    role: 'user',
    content,
    status: 'complete'
  })
  const assistantMessageId = randomUUID()
  insertMessage({
    id: assistantMessageId,
    conversationId: conversation.id,
    role: 'assistant',
    content: '',
    status: 'streaming'
  })

  console.log(`[chat] 阶段: 开始生成 — assistant 行已前置落库 (${assistantMessageId.slice(0, 8)}…)，进入流式输出`)
  safeEmit('chat-stream', streamListeners, {
    type: 'start',
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    assistantMessageId
  })
  safeEmit('business-event', businessListeners, { type: 'busy' })

  const controller = new AbortController()
  activeControllers.set(conversation.id, controller)

  const profile = getPersonaProfile(conversation.petId)
  const systemPrompt = buildSystemPrompt(conversation.petId, profile)
  const history = getRecentContextMessages(conversation.id, 20)
  const messages: DeepSeekChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history
      .filter((m) => m.id !== assistantMessageId)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
  ]

  let assembled = ''
  let firstDelta = true
  let dbFlushTimer: NodeJS.Timeout | null = null
  const scheduleDbFlush = (): void => {
    if (dbFlushTimer) return
    dbFlushTimer = setTimeout(() => {
      dbFlushTimer = null
      try {
        updateMessage(assistantMessageId, {
          content: assembled,
          status: 'streaming'
        })
      } catch (error) {
        console.error('[chat] 流式内容落库失败:', error)
      }
    }, DB_FLUSH_INTERVAL_MS)
  }
  const cancelDbFlush = (): void => {
    if (dbFlushTimer) {
      clearTimeout(dbFlushTimer)
      dbFlushTimer = null
    }
  }
  try {
    assembled = await streamChatCompletion({
      apiKey,
      messages,
      signal: controller.signal,
      onDelta: (delta) => {
        assembled += delta
        if (firstDelta) {
          console.log('[chat] 阶段: 首个 delta 到达 — 前端从思考气泡切换为流式正文')
          firstDelta = false
        }
        scheduleDbFlush()
        safeEmit('chat-stream', streamListeners, {
          type: 'delta',
          conversationId: conversation.id,
          assistantMessageId,
          delta
        })
      }
    })

    cancelDbFlush()
    updateMessage(assistantMessageId, {
      content: assembled,
      status: 'complete',
      errorCode: null
    })
    console.log('[chat] 阶段: 生成完成 — 消息已落库为 complete，invoke 即将返回')
    safeEmit('chat-stream', streamListeners, {
      type: 'done',
      conversationId: conversation.id,
      assistantMessageId,
      content: assembled
    })
    return { ok: true }
  } catch (error) {
    const mapped = mapError(error)
    if (mapped.code === 'aborted') {
      cancelDbFlush()
      updateMessage(assistantMessageId, {
        content: assembled,
        status: 'cancelled',
        errorCode: 'aborted'
      })
      safeEmit('chat-stream', streamListeners, {
        type: 'cancelled',
        conversationId: conversation.id,
        assistantMessageId
      })
      return { ok: false, error: mapped.message, code: mapped.code }
    }

    cancelDbFlush()
    updateMessage(assistantMessageId, {
      content: assembled || mapped.message,
      status: 'error',
      errorCode: mapped.code
    })
    console.log(`[chat] 阶段: 生成失败 — code=${mapped.code}, message=${mapped.message}`)
    safeEmit('chat-stream', streamListeners, {
      type: 'error',
      conversationId: conversation.id,
      assistantMessageId,
      code: mapped.code,
      message: mapped.message
    })
    return { ok: false, error: mapped.message, code: mapped.code }
  } finally {
    activeControllers.delete(conversation.id)
    safeEmit('business-event', businessListeners, { type: 'idle' })
  }
}

function mapError(error: unknown): { code: ChatErrorCode; message: string } {
  if (error instanceof DeepSeekApiError) {
    return { code: error.code, message: error.message }
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return { code: 'aborted', message: '已停止生成' }
  }
  return { code: 'unknown', message: '生成失败，请稍后重试' }
}

export function disposeChatService(): void {
  stopChatGeneration()
  streamListeners.clear()
  businessListeners.clear()
  clearListenerErrorHandlers()
}
