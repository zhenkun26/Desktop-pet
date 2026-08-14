import { randomUUID } from 'crypto'
import {
  DEFAULT_CHAT_LANGUAGE,
  normalizeChatLanguage,
  type ChatErrorCode,
  type ChatLanguage,
  type ChatStreamEvent,
  type PetBusinessEvent,
  type PetId,
  type ProviderChatMessage,
  type SendChatMessageInput
} from '../../../shared/types'
import {
  createConversation,
  deleteConversation,
  getConversation,
  getConversationModelProfile,
  getConversationResponseLanguage,
  getConversationMessages,
  getPersonaProfile,
  getRecentContextMessages,
  insertMessage,
  listConversations,
  renameConversation,
  updateConversationResponseLanguage,
  updateConversationModelProfile,
  updateMessage,
  updatePersonaProfile
} from './chat-db'
import { buildSystemPrompt } from './prompt-builder'
import {
  clearApiKey,
  getApiKeyStatus,
  setApiKey,
  validateApiKeyFormat
} from './secrets-store'
import {
  clearCredential,
  getCredential,
  getCredentialStatuses,
  setCredential
} from './secrets-store'
import {
  confirmProviderPrivacy,
  deleteModelProfile,
  deleteProviderConnection,
  getModelProfile,
  getProviderConfig,
  getProviderSnapshot,
  saveModelProfile,
  saveProviderConnection
} from './provider-config'
import { normalizeProviderError, streamProviderChat, testProviderConnection } from './provider-router'
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
  const snapshot = getProviderSnapshot('deepseek-default')
  if (!snapshot) return { ok: false, message: 'DeepSeek 模型配置不存在' }
  return testProviderConnection({
    snapshot,
    apiKey:
      apiKey != null && apiKey.trim()
        ? validateApiKeyFormat(apiKey)
        : undefined
  })
}

export function chatGetProviderConfig() {
  return getProviderConfig()
}

export function chatSaveProviderConnection(
  ...args: Parameters<typeof saveProviderConnection>
) {
  return saveProviderConnection(...args)
}

export function chatDeleteProviderConnection(connectionId: string) {
  return { ok: deleteProviderConnection(connectionId) }
}

export function chatSaveModelProfile(
  ...args: Parameters<typeof saveModelProfile>
) {
  return saveModelProfile(...args)
}

export function chatDeleteModelProfile(modelProfileId: string) {
  return { ok: deleteModelProfile(modelProfileId) }
}

export function chatGetCredentialStatuses() {
  const config = getProviderConfig()
  return getCredentialStatuses(
    config.connections.map((connection) => connection.credentialId)
  )
}

export function chatSetCredential(credentialId: string, apiKey: string) {
  return setCredential(credentialId, apiKey)
}

export function chatClearCredential(credentialId: string) {
  return clearCredential(credentialId)
}

export async function chatTestCredential(
  credentialId: string,
  modelProfileId?: string
) {
  const providerConfig = getProviderConfig()
  const selectedProfile =
    modelProfileId ??
    providerConfig.models.find((model) => {
      const connection = providerConfig.connections.find(
        (item) => item.id === model.connectionId
      )
      return connection?.credentialId === credentialId
    })?.id ??
    'deepseek-default'
  const snapshot = getProviderSnapshot(selectedProfile)
  if (!snapshot || snapshot.credentialId !== credentialId) {
    return { ok: false, message: '凭据与模型配置不匹配' }
  }
  return testProviderConnection({ snapshot })
}

export function chatConfirmProviderPrivacy(connectionId: string) {
  return confirmProviderPrivacy(connectionId)
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
  petId: PetId,
  title?: string,
  responseLanguage: ChatLanguage = DEFAULT_CHAT_LANGUAGE,
  modelProfileId: string | null = null
) {
  return createConversation(
    petId,
    title,
    normalizeChatLanguage(responseLanguage),
    modelProfileId
  )
}

export function chatGetConversationResponseLanguage(conversationId: string) {
  return getConversationResponseLanguage(conversationId)
}

export function chatUpdateConversationResponseLanguage(
  conversationId: string,
  responseLanguage: ChatLanguage
) {
  return updateConversationResponseLanguage(
    conversationId,
    normalizeChatLanguage(responseLanguage)
  )
}

export function chatGetConversationModelProfile(conversationId: string) {
  return getConversationModelProfile(conversationId)
}

export function chatUpdateConversationModelProfile(
  conversationId: string,
  modelProfileId: string | null
) {
  if (modelProfileId != null && !getModelProfile(modelProfileId)) {
    throw new Error('模型配置不存在')
  }
  return updateConversationModelProfile(conversationId, modelProfileId)
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

  const snapshot = getProviderSnapshot(conversation.modelProfileId)
  if (!snapshot) {
    return {
      ok: false,
      error: '没有可用的模型配置，请先在设置中配置供应商和模型',
      code: 'missing_credential'
    }
  }
  const providerConfig = getProviderConfig()
  const model = providerConfig.models.find(
    (item) => item.id === snapshot.modelProfileId
  )
  const connection = providerConfig.connections.find(
    (item) => item.id === snapshot.providerConnectionId
  )
  if (!model || !connection || !model.enabled || !connection.enabled) {
    return {
      ok: false,
      error: '当前模型已停用，请在设置中选择可用模型',
      code: 'model_not_supported'
    }
  }
  if (!connection.privacyConfirmed) {
    return {
      ok: false,
      error: `请先确认消息将发送到${connection.displayName}`,
      code: 'provider_unavailable'
    }
  }
  try {
    const credential = getCredential(snapshot.credentialId)
    if (!credential) {
      return {
        ok: false,
        error: `请先在设置中配置${snapshot.providerName} API Key`,
        code:
          snapshot.credentialId === 'deepseek-default'
            ? 'missing_api_key'
            : 'missing_credential'
      }
    }
  } catch {
    return {
      ok: false,
      error: '系统加密不可用，无法读取 API Key',
      code: 'missing_api_key'
    }
  }

  const userMessage = insertMessage({
    conversationId: conversation.id,
    role: 'user',
    content,
    status: 'complete',
    modelProfileId: snapshot.modelProfileId,
    providerConnectionId: snapshot.providerConnectionId,
    providerName: snapshot.providerName,
    modelId: snapshot.modelId,
    modelName: snapshot.modelName
  })
  const assistantMessageId = randomUUID()
  insertMessage({
    id: assistantMessageId,
    conversationId: conversation.id,
    role: 'assistant',
    content: '',
    status: 'streaming',
    modelProfileId: snapshot.modelProfileId,
    providerConnectionId: snapshot.providerConnectionId,
    providerName: snapshot.providerName,
    modelId: snapshot.modelId,
    modelName: snapshot.modelName
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
  const responseLanguage = normalizeChatLanguage(conversation.responseLanguage)
  const systemPrompt = buildSystemPrompt(
    conversation.petId,
    profile,
    responseLanguage
  )
  const history = getRecentContextMessages(conversation.id, 20)
  const messages: ProviderChatMessage[] = [
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
    assembled = await streamProviderChat({
      snapshot,
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
  return normalizeProviderError(error)
}

export function disposeChatService(): void {
  stopChatGeneration()
  streamListeners.clear()
  businessListeners.clear()
  clearListenerErrorHandlers()
}
