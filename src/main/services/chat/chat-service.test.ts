import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { closeChatDb, getChatDb, getConversationMessages } from './chat-db'
import {
  chatCreateConversation,
  chatGetPersonaProfile,
  chatUpdateConversationResponseLanguage,
  chatUpdateConversationModelProfile,
  disposeChatService,
  onBusinessEvent,
  onChatStream,
  sendChatMessage
} from './chat-service'
import { DeepSeekApiError, streamChatCompletion } from './deepseek-client'
import { clearApiKey, setApiKey } from './secrets-store'
import {
  confirmProviderPrivacy,
  saveModelProfile,
  saveProviderConnection
} from './provider-config'
import { setCredential } from './secrets-store'
import { providerConsentKey } from '../../../shared/model-routing'
import { getProviderConnection, getProviderSnapshot } from './provider-config'
import { stopChatGeneration } from './chat-service'

vi.mock('./deepseek-client', () => {
  class DeepSeekApiError extends Error {
    readonly code: string
    readonly status?: number

    constructor(code: string, message: string, status?: number) {
      super(message)
      this.name = 'DeepSeekApiError'
      this.code = code
      this.status = status
    }
  }

  return {
    DeepSeekApiError,
    streamChatCompletion: vi.fn(),
    testApiKeyConnection: vi.fn(),
    buildChatCompletionBody: vi.fn((messages: unknown[]) => ({ messages }))
  }
})

describe('chat-service', () => {
  let conversationId: string

  beforeEach(() => {
    closeChatDb()
    clearApiKey()
    rmSync(join(app.getPath('userData'), 'provider-config.json'), { force: true })
    rmSync(join(app.getPath('userData'), 'credentials'), {
      recursive: true,
      force: true
    })
    vi.mocked(streamChatCompletion).mockReset()
    conversationId = chatCreateConversation('hutao').id
  })

  afterEach(() => {
    disposeChatService()
    closeChatDb()
    clearApiKey()
    rmSync(join(app.getPath('userData'), 'provider-config.json'), { force: true })
    rmSync(join(app.getPath('userData'), 'credentials'), {
      recursive: true,
      force: true
    })
    vi.restoreAllMocks()
  })

  it('should reject empty or over-long content', async () => {
    const empty = await sendChatMessage({ conversationId, content: '  ' })
    expect(empty).toMatchObject({ ok: false, code: 'unknown' })
    const long = await sendChatMessage({
      conversationId,
      content: 'x'.repeat(4001)
    })
    expect(long).toMatchObject({ ok: false, code: 'unknown' })
  })

  it('should reject unknown conversations', async () => {
    const result = await sendChatMessage({
      conversationId: 'missing-conversation',
      content: '你好'
    })
    expect(result).toMatchObject({ ok: false })
  })

  it('should require a configured API key', async () => {
    const result = await sendChatMessage({
      conversationId,
      content: '你好'
    })
    expect(result).toMatchObject({ ok: false, code: 'missing_api_key' })
  })

  it('should stream a successful reply and persist both messages', async () => {
    setApiKey('sk-test-key')
    vi.mocked(streamChatCompletion).mockImplementation(
      async ({ onDelta }) => {
        onDelta?.('你')
        onDelta?.('好')
        return '你好'
      }
    )

    const events: string[] = []
    const business: string[] = []
    onChatStream((event) => events.push(event.type))
    onBusinessEvent((event) => business.push(event.type))

    const result = await sendChatMessage({
      conversationId,
      content: '在吗'
    })

    expect(result).toMatchObject({ ok: true })
    expect(events).toEqual(['start', 'delta', 'delta', 'done'])
    expect(business).toEqual(['busy', 'idle'])
  })

  it('should snapshot the conversation language before generation continues', async () => {
    closeChatDb()
    const snapshotConversationId = chatCreateConversation(
      'hutao',
      undefined,
      'zh-CN'
    ).id
    setApiKey('sk-test-key')
    let prompt = ''
    vi.mocked(streamChatCompletion).mockImplementation(
      async ({ messages, onDelta }) => {
        prompt = messages[0]?.content ?? ''
        chatUpdateConversationResponseLanguage(snapshotConversationId, 'en-US')
        onDelta?.('你好')
        return '你好'
      }
    )

    const result = await sendChatMessage({
      conversationId: snapshotConversationId,
      content: '快回答'
    })

    expect(result).toMatchObject({ ok: true })
    expect(prompt).toContain('主要使用中文回复用户')
    expect(prompt).not.toContain('主要使用English回复用户')
  })

  it('should normalize an invalid persisted language before building the prompt', async () => {
    setApiKey('sk-test-key')
    getChatDb()
      .prepare('UPDATE conversations SET response_language = ? WHERE id = ?')
      .run('ko-KR', conversationId)
    let prompt = ''
    vi.mocked(streamChatCompletion).mockImplementation(async ({ messages }) => {
      prompt = messages[0]?.content ?? ''
      return '中文回复'
    })

    const result = await sendChatMessage({
      conversationId,
      content: '无效语言测试'
    })

    expect(result).toMatchObject({ ok: true })
    expect(prompt).toContain('主要使用中文回复用户')
    expect(prompt).not.toContain('ko-KR')
  })

  it('should mark the assistant message as cancelled on abort', async () => {
    setApiKey('sk-test-key')
    vi.mocked(streamChatCompletion).mockImplementation(async ({ onDelta }) => {
      onDelta?.('半截')
      throw new DeepSeekApiError('aborted', '已停止生成')
    })

    const result = await sendChatMessage({
      conversationId,
      content: '停下'
    })
    expect(result).toMatchObject({ ok: false, code: 'aborted' })
  })

  it('should mark the assistant message as error on API failure', async () => {
    setApiKey('sk-test-key')
    vi.mocked(streamChatCompletion).mockRejectedValue(
      new DeepSeekApiError('invalid_api_key', 'API Key 无效')
    )

    const result = await sendChatMessage({
      conversationId,
      content: '测试'
    })
    expect(result).toMatchObject({ ok: false, code: 'invalid_api_key' })
  })

  it('should isolate a throwing stream listener without breaking generation', async () => {
    setApiKey('sk-test-key')
    vi.mocked(streamChatCompletion).mockImplementation(
      async ({ onDelta }) => {
        onDelta?.('正常输出')
        return '正常输出'
      }
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const received: string[] = []
    onChatStream(() => {
      throw new Error('listener boom')
    })
    onChatStream((event) => received.push(event.type))

    const result = await sendChatMessage({
      conversationId,
      content: '隔离测试'
    })
    expect(result).toMatchObject({ ok: true })
    expect(received).toContain('done')
  })

  it('should route subsequent messages to a newly selected model and persist snapshots', async () => {
    saveProviderConnection({
      id: 'company-b',
      providerType: 'openai-compatible',
      displayName: '公司 B',
      baseUrl: 'https://company-b.example.com',
      credentialId: 'company-b-key'
    })
    saveModelProfile({
      id: 'company-b-model',
      connectionId: 'company-b',
      modelId: 'company-b-chat',
      displayName: '公司 B 模型'
    })
    setCredential('company-b-key', 'sk-company-b')
    confirmProviderPrivacy('company-b', providerConsentKey(getProviderConnection('company-b')!))
    setApiKey('sk-default-key')
    const models: string[] = []
    vi.mocked(streamChatCompletion).mockImplementation(
      async ({ model, onDelta }) => {
        models.push(model ?? 'missing')
        onDelta?.('答复')
        return '答复'
      }
    )

    await expect(
      sendChatMessage({ conversationId, content: '第一条' })
    ).resolves.toMatchObject({ ok: true })
    chatUpdateConversationModelProfile(conversationId, 'company-b-model')
    await expect(
      sendChatMessage({ conversationId, content: '第二条' })
    ).resolves.toMatchObject({ ok: true })

    expect(models).toEqual(['deepseek-v4-flash', 'company-b-chat'])
    const messages = getConversationMessages(conversationId)
    expect(messages.filter((message) => message.role === 'assistant').map((message) => message.modelId)).toEqual([
      'deepseek-v4-flash',
      'company-b-chat'
    ])
  })

  it('should expose the persona profile per pet', () => {
    expect(chatGetPersonaProfile('hutao').petId).toBe('hutao')
  })

  it('should reject a stale displayed route before persisting messages or contacting a provider', async () => {
    setApiKey('test-placeholder-key')
    const expectedRoute = getProviderSnapshot(null)!
    saveProviderConnection({
      id: expectedRoute.providerConnectionId, providerType: expectedRoute.providerType,
      displayName: expectedRoute.providerName, baseUrl: 'https://changed.example.test',
      credentialId: expectedRoute.credentialId
    })
    const result = await sendChatMessage({ conversationId, content: 'Review route', expectedRoute })
    expect(result).toMatchObject({ ok: false, code: 'model_not_supported' })
    expect(getConversationMessages(conversationId)).toEqual([])
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('should reject an unconfirmed current endpoint even when the displayed route matches', async () => {
    setApiKey('test-placeholder-key')
    saveProviderConnection({ id: 'deepseek-default', providerType: 'openai-compatible',
      displayName: 'Changed', baseUrl: 'https://changed.example.test', credentialId: 'deepseek-default' })
    const result = await sendChatMessage({ conversationId, content: 'Review consent', expectedRoute: getProviderSnapshot(null)! })
    expect(result).toMatchObject({ ok: false, code: 'provider_unavailable' })
    expect(getConversationMessages(conversationId)).toEqual([])
    expect(streamChatCompletion).not.toHaveBeenCalled()
  })

  it('should correlate stream events with the submitting request', async () => {
    setApiKey('test-placeholder-key')
    vi.mocked(streamChatCompletion).mockImplementation(async ({ onDelta }) => { onDelta?.('Reply'); return 'Reply' })
    const identities: string[] = []
    onChatStream((event) => identities.push(event.requestId))
    const result = await sendChatMessage({ conversationId, content: 'Question', requestId: 'request-one', expectedRoute: getProviderSnapshot(null)! })
    expect(result.ok).toBe(true)
    expect(identities).toEqual(['request-one', 'request-one', 'request-one'])
  })

  it('should reject overlapping sends until cancellation settles and keep the next request cancellable', async () => {
    setApiKey('test-placeholder-key')
    const pending: Array<{ signal?: AbortSignal; reject: (error: Error) => void }> = []
    vi.mocked(streamChatCompletion).mockImplementation(({ signal }) => new Promise((_resolve, reject) => pending.push({ signal, reject })))
    const first = sendChatMessage({ conversationId, content: 'First' })
    expect(stopChatGeneration(conversationId).ok).toBe(true)
    expect(pending[0].signal?.aborted).toBe(true)
    expect((await sendChatMessage({ conversationId, content: 'Too early' })).ok).toBe(false)
    expect(pending).toHaveLength(1)
    pending[0].reject(new DeepSeekApiError('aborted', 'Stopped'))
    expect((await first).code).toBe('aborted')
    const second = sendChatMessage({ conversationId, content: 'Second' })
    expect(stopChatGeneration(conversationId).ok).toBe(true)
    expect(pending[1].signal?.aborted).toBe(true)
    pending[1].reject(new DeepSeekApiError('aborted', 'Stopped'))
    expect((await second).code).toBe('aborted')
    expect(stopChatGeneration(conversationId).ok).toBe(false)
  })

  it('should persist cancellation even if a provider resolves after being stopped', async () => {
    setApiKey('test-placeholder-key')
    let finish!: (reply: string) => void
    vi.mocked(streamChatCompletion).mockImplementation(({ onDelta }) => {
      onDelta?.('Partial')
      return new Promise((resolve) => { finish = resolve })
    })
    const request = sendChatMessage({ conversationId, content: 'Question' })
    stopChatGeneration(conversationId)
    finish('Late completion')
    expect((await request).code).toBe('aborted')
    expect(getConversationMessages(conversationId).find((message) => message.role === 'assistant'))
      .toMatchObject({ status: 'cancelled', errorCode: 'aborted' })
  })

  it('should keep the pet busy while another conversation is generating', async () => {
    setApiKey('test-placeholder-key')
    const otherId = chatCreateConversation('hutao').id
    const finish: Array<(reply: string) => void> = []
    vi.mocked(streamChatCompletion).mockImplementation(() => new Promise((resolve) => finish.push(resolve)))
    const business: string[] = []
    onBusinessEvent((event) => business.push(event.type))
    const first = sendChatMessage({ conversationId, content: 'First' })
    const second = sendChatMessage({ conversationId: otherId, content: 'Second' })
    finish[0]('First reply'); await first
    expect(business).not.toContain('idle')
    finish[1]('Second reply'); await second
    expect(business.at(-1)).toBe('idle')
  })

  it('should persist cancellation when the provider rejects with a network error after stop', async () => {
    setApiKey('test-placeholder-key')
    let fail!: (error: Error) => void
    vi.mocked(streamChatCompletion).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject }))
    const request = sendChatMessage({ conversationId, content: 'Question' })
    stopChatGeneration(conversationId)
    fail(new Error('Synthetic network rejection'))
    expect((await request).code).toBe('aborted')
    expect(getConversationMessages(conversationId).find((message) => message.role === 'assistant')?.status).toBe('cancelled')
  })

  it('should retain the captured route while subsequent messages use an updated route', async () => {
    setApiKey('test-placeholder-key')
    const original = getProviderSnapshot(null)!
    const nextEndpoint = 'https://next.example.test'
    vi.mocked(streamChatCompletion).mockImplementation(async ({ baseUrl }) => {
      const changed = saveProviderConnection({ id: original.providerConnectionId,
        providerType: original.providerType, displayName: 'Next endpoint', baseUrl: nextEndpoint,
        credentialId: original.credentialId })
      confirmProviderPrivacy(changed.id, providerConsentKey(changed))
      return baseUrl ?? ''
    })
    expect((await sendChatMessage({ conversationId, content: 'Before edit', expectedRoute: original })).ok).toBe(true)
    expect(vi.mocked(streamChatCompletion).mock.calls[0][0].baseUrl).toBe(original.baseUrl)
    const next = getProviderSnapshot(null)!
    expect((await sendChatMessage({ conversationId, content: 'After edit', expectedRoute: next })).ok).toBe(true)
    expect(vi.mocked(streamChatCompletion).mock.calls[1][0].baseUrl).toBe(nextEndpoint)
  })

})
