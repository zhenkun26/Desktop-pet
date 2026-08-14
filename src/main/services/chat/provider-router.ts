import type {
  ChatErrorCode,
  ProviderChatMessage,
  ProviderConfigSnapshot,
  ProviderType
} from '../../../shared/types'
import {
  DeepSeekApiError,
  streamChatCompletion,
  testApiKeyConnection
} from './deepseek-client'
import { getCredential } from './secrets-store'
import { redactErrorMessage } from './redaction'

export interface ProviderAdapterRequest {
  snapshot: ProviderConfigSnapshot
  messages: ProviderChatMessage[]
  apiKey: string
  signal?: AbortSignal
  onDelta?: (delta: string) => void
}

export interface ProviderAdapter {
  readonly type: ProviderType
  stream: (request: ProviderAdapterRequest) => Promise<string>
  test: (
    snapshot: ProviderConfigSnapshot,
    apiKey: string
  ) => Promise<{ ok: boolean; message: string }>
}

const openAiCompatibleAdapter: ProviderAdapter = {
  type: 'openai-compatible',
  stream: async (request) =>
    streamChatCompletion({
      apiKey: request.apiKey,
      baseUrl: request.snapshot.baseUrl,
      model: request.snapshot.modelId,
      messages: request.messages,
      signal: request.signal,
      onDelta: request.onDelta
    }),
  test: (snapshot, apiKey) =>
    testApiKeyConnection(apiKey, {
      baseUrl: snapshot.baseUrl,
      model: snapshot.modelId,
      providerName: snapshot.providerName
    })
}

const adapters = new Map<ProviderType, ProviderAdapter>([
  ['openai-compatible', openAiCompatibleAdapter]
])

export function getProviderAdapter(type: ProviderType): ProviderAdapter {
  const adapter = adapters.get(type)
  if (!adapter) {
    throw new DeepSeekApiError(
      'provider_unavailable',
      `暂不支持供应商协议：${type}`
    )
  }
  return adapter
}

export async function streamProviderChat(request: {
  snapshot: ProviderConfigSnapshot
  messages: ProviderChatMessage[]
  signal?: AbortSignal
  onDelta?: (delta: string) => void
}): Promise<string> {
  const apiKey = getCredential(request.snapshot.credentialId)
  if (!apiKey) {
    throw new DeepSeekApiError(
      'missing_credential',
      `请先配置${request.snapshot.providerName} API Key`
    )
  }
  const adapter = getProviderAdapter(request.snapshot.providerType)
  return adapter.stream({
    ...request,
    apiKey
  })
}

export async function testProviderConnection(request: {
  snapshot: ProviderConfigSnapshot
  apiKey?: string
}): Promise<{ ok: boolean; message: string }> {
  const apiKey = request.apiKey?.trim() || getCredential(request.snapshot.credentialId)
  if (!apiKey) {
    return { ok: false, message: '尚未配置 API Key' }
  }
  return getProviderAdapter(request.snapshot.providerType).test(
    request.snapshot,
    apiKey
  )
}

export function normalizeProviderError(error: unknown): {
  code: ChatErrorCode
  message: string
} {
  if (error instanceof DeepSeekApiError) {
    return { code: error.code, message: redactErrorMessage(error, '供应商请求失败') }
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return { code: 'aborted', message: '已停止生成' }
  }
  return { code: 'provider_unavailable', message: '供应商暂时不可用，请稍后重试' }
}
