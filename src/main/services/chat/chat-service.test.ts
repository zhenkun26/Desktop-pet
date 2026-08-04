import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeChatDb } from './chat-db'
import {
  chatCreateConversation,
  chatGetPersonaProfile,
  onBusinessEvent,
  onChatStream,
  sendChatMessage
} from './chat-service'
import { DeepSeekApiError, streamChatCompletion } from './deepseek-client'
import { clearApiKey, setApiKey } from './secrets-store'

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
    vi.mocked(streamChatCompletion).mockReset()
    conversationId = chatCreateConversation('hutao').id
  })

  afterEach(() => {
    closeChatDb()
    clearApiKey()
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

  it('should expose the persona profile per pet', () => {
    expect(chatGetPersonaProfile('hutao').petId).toBe('hutao')
  })
})
