import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildChatCompletionBody,
  DEEPSEEK_MODEL,
  STREAM_IDLE_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  streamChatCompletion,
  testApiKeyConnection,
  DeepSeekApiError
} from './deepseek-client'

describe('buildChatCompletionBody', () => {
  it('should build a streaming chat completion request', () => {
    const body = buildChatCompletionBody([
      { role: 'user', content: '你好' }
    ])
    expect(body).toMatchObject({
      model: DEEPSEEK_MODEL,
      stream: true,
      max_tokens: 1024,
      temperature: 0.9,
      thinking: { type: 'disabled' }
    })
    expect(body.messages).toEqual([{ role: 'user', content: '你好' }])
  })
})

describe('timeout configuration', () => {
  it('should enforce sane non-zero timeouts', () => {
    expect(STREAM_IDLE_TIMEOUT_MS).toBeGreaterThan(0)
    expect(TEST_TIMEOUT_MS).toBeGreaterThan(0)
    expect(TEST_TIMEOUT_MS).toBeLessThan(STREAM_IDLE_TIMEOUT_MS)
  })
})

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
  return new Response(body, { status })
}

describe('streamChatCompletion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should assemble deltas from an SSE response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n',
          'data: [DONE]\n'
        ])
      )
    )
    const deltas: string[] = []
    const full = await streamChatCompletion({
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      onDelta: (delta) => deltas.push(delta)
    })
    expect(full).toBe('你好')
    expect(deltas).toEqual(['你', '好'])
  })

  it('should map 401 to invalid_api_key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    )
    await expect(
      streamChatCompletion({
        apiKey: 'sk-bad',
        messages: [{ role: 'user', content: 'hi' }]
      })
    ).rejects.toMatchObject({ code: 'invalid_api_key' })
  })

  it('should map 429 to rate_limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('slow down', { status: 429 }))
    )
    await expect(
      streamChatCompletion({
        apiKey: 'sk-test',
        messages: [{ role: 'user', content: 'hi' }]
      })
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('should map network failures to network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    )
    await expect(
      streamChatCompletion({
        apiKey: 'sk-test',
        messages: [{ role: 'user', content: 'hi' }]
      })
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('should propagate a caller abort as aborted', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        controller.abort()
        return Promise.reject(
          Object.assign(new Error('Aborted'), { name: 'AbortError' })
        )
      })
    )
    await expect(
      streamChatCompletion({
        apiKey: 'sk-test',
        messages: [{ role: 'user', content: 'hi' }],
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'aborted' })
  })
})

describe('testApiKeyConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return ok for a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
    )
    await expect(testApiKeyConnection('sk-test')).resolves.toMatchObject({
      ok: true
    })
  })

  it('should return a friendly message for a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('no', { status: 401 }))
    )
    const result = await testApiKeyConnection('sk-bad')
    expect(result.ok).toBe(false)
    expect(result.message).toContain('无效')
  })
})

describe('DeepSeekApiError', () => {
  it('should carry code and status', () => {
    const error = new DeepSeekApiError('timeout', '超时', 408)
    expect(error).toMatchObject({ code: 'timeout', status: 408 })
    expect(error.name).toBe('DeepSeekApiError')
  })
})
