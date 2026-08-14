import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'
import { saveModelProfile, saveProviderConnection, getProviderSnapshot } from './provider-config'
import { setCredential } from './secrets-store'
import { normalizeProviderError, streamProviderChat, testProviderConnection } from './provider-router'

const userData = app.getPath('userData')

function cleanup(): void {
  rmSync(join(userData, 'provider-config.json'), { force: true })
  rmSync(join(userData, 'credentials'), { recursive: true, force: true })
  rmSync(join(userData, 'deepseek-api-key.bin'), { force: true })
}

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

describe('provider-router', () => {
  beforeEach(cleanup)
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('should route an OpenAI-compatible model to its connection and key', async () => {
    saveProviderConnection({
      id: 'router-company',
      providerType: 'openai-compatible',
      displayName: '路由公司',
      baseUrl: 'https://router.example.com',
      credentialId: 'router-key'
    })
    saveModelProfile({
      id: 'router-model',
      connectionId: 'router-company',
      modelId: 'router-chat',
      displayName: '路由模型'
    })
    setCredential('router-key', 'sk-router-key')
    const snapshot = getProviderSnapshot('router-model')!
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
        'data: [DONE]\n'
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const full = await streamProviderChat({
      snapshot,
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(full).toBe('ok')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://router.example.com/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-router-key' }),
        body: expect.stringContaining('router-chat')
      })
    )
  })

  it('should not use another connection key when the selected credential is missing', async () => {
    saveProviderConnection({
      id: 'missing-company',
      providerType: 'openai-compatible',
      displayName: '缺失公司',
      baseUrl: 'https://missing.example.com',
      credentialId: 'missing-key'
    })
    saveModelProfile({
      id: 'missing-model',
      connectionId: 'missing-company',
      modelId: 'missing-chat',
      displayName: '缺失模型'
    })
    const snapshot = getProviderSnapshot('missing-model')!
    await expect(
      streamProviderChat({ snapshot, messages: [] })
    ).rejects.toMatchObject({ code: 'missing_credential' })
  })

  it('should map provider errors without exposing authorization values', () => {
    const mapped = normalizeProviderError(
      new Error('Authorization: Bearer sk-secret-token')
    )
    expect(mapped.code).toBe('provider_unavailable')
    expect(mapped.message).not.toContain('sk-secret-token')
  })

  it('should test a selected provider with a supplied key without persisting it', async () => {
    const snapshot = getProviderSnapshot('deepseek-default')!
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await testProviderConnection({ snapshot, apiKey: 'sk-one-time' })
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-one-time')
  })
})
