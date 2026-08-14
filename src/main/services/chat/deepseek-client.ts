import type { ChatErrorCode, ChatMessageRole } from '../../../shared/types'
import { parseSseContentDeltas } from './sse'

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DEEPSEEK_MODEL = 'deepseek-v4-flash'
/** 流式响应无数据超时（毫秒）：超过则视为连接悬挂。 */
export const STREAM_IDLE_TIMEOUT_MS = 60_000
/** API Key 连通性测试超时（毫秒）。 */
export const TEST_TIMEOUT_MS = 15_000

/** 合并调用方信号与内部超时信号：任一触发即中止。 */
function mergeSignals(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal
): AbortSignal {
  return callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal
}

export interface DeepSeekChatMessage {
  role: ChatMessageRole
  content: string
}

export interface DeepSeekStreamOptions {
  apiKey: string
  messages: DeepSeekChatMessage[]
  baseUrl?: string
  model?: string
  signal?: AbortSignal
  onDelta?: (delta: string) => void
}

export class DeepSeekApiError extends Error {
  readonly code: ChatErrorCode
  readonly status?: number

  constructor(code: ChatErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'DeepSeekApiError'
    this.code = code
    this.status = status
  }
}

export function buildChatCompletionBody(
  messages: DeepSeekChatMessage[],
  model = DEEPSEEK_MODEL
): Record<string, unknown> {
  return {
    model,
    messages,
    stream: true,
    max_tokens: 1024,
    temperature: 0.9,
    thinking: { type: 'disabled' }
  }
}

function mapHttpError(
  status: number,
  bodyText: string,
  providerName = 'DeepSeek'
): DeepSeekApiError {
  if (status === 401 || status === 403) {
    return new DeepSeekApiError(
      'invalid_api_key',
      'API Key 无效或已失效，请重新配置',
      status
    )
  }
  if (status === 429) {
    return new DeepSeekApiError(
      'rate_limited',
      '请求过于频繁，请稍后再试',
      status
    )
  }
  if (bodyText.includes('content_filter')) {
    return new DeepSeekApiError(
      'content_filter',
      '回复被内容安全策略过滤',
      status
    )
  }
  if (bodyText.includes('insufficient_system_resource')) {
    return new DeepSeekApiError(
      'insufficient_resource',
      '模型服务资源不足，请稍后重试',
      status
    )
  }
  return new DeepSeekApiError(
    'unknown',
    `${providerName} 请求失败（${status}）`,
    status
  )
}

export async function streamChatCompletion(
  options: DeepSeekStreamOptions
): Promise<string> {
  const baseUrl = (options.baseUrl ?? DEEPSEEK_BASE_URL).replace(/\/$/, '')
  const body = buildChatCompletionBody(options.messages, options.model)
  const idleController = new AbortController()
  let idleTimer = setTimeout(
    () => idleController.abort(),
    STREAM_IDLE_TIMEOUT_MS
  )
  const mergedSignal = mergeSignals(options.signal, idleController.signal)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`
      },
      body: JSON.stringify(body),
      signal: mergedSignal
    })
  } catch (error) {
    clearTimeout(idleTimer)
    if (idleController.signal.aborted) {
      throw new DeepSeekApiError('timeout', '请求超时，请检查网络后重试')
    }
    if (
      options.signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new DeepSeekApiError('aborted', '已停止生成')
    }
    throw new DeepSeekApiError('network', '网络连接失败，请检查网络后重试')
  }

  if (!response.ok) {
    clearTimeout(idleTimer)
    const text = await response.text().catch(() => '')
    throw mapHttpError(response.status, text)
  }

  let full = ''
  try {
    for await (const delta of parseSseContentDeltas(
      response.body,
      mergedSignal
    )) {
      full += delta
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => idleController.abort(), STREAM_IDLE_TIMEOUT_MS)
      options.onDelta?.(delta)
    }
    clearTimeout(idleTimer)
  } catch (error) {
    if (idleController.signal.aborted) {
      throw new DeepSeekApiError('timeout', '请求超时，请检查网络后重试')
    }
    if (
      options.signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new DeepSeekApiError('aborted', '已停止生成')
    }
    if (error instanceof DeepSeekApiError) throw error
    throw new DeepSeekApiError('network', '读取回复时中断，请重试')
  }

  return full
}

/** 用极短非流式请求验证 Key（仅主进程）。 */
export async function testApiKeyConnection(
  apiKey: string,
  options?: { baseUrl?: string; model?: string; providerName?: string }
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = (options?.baseUrl ?? DEEPSEEK_BASE_URL).replace(/\/$/, '')
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      signal: mergeSignals(undefined, AbortSignal.timeout(TEST_TIMEOUT_MS)),
      body: JSON.stringify({
        model: options?.model ?? DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        thinking: { type: 'disabled' },
        max_tokens: 1
      })
    })
    if (response.ok) {
      return { ok: true, message: '连接成功' }
    }
    const err = mapHttpError(
      response.status,
      await response.text().catch(() => ''),
      options?.providerName
    )
    return { ok: false, message: err.message }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, message: '连接超时，请检查网络后重试' }
    }
    return { ok: false, message: '网络连接失败，请检查网络后重试' }
  }
}
