/**
 * 掩码展示 API Key：保留前 3 与后 4 位，其余打码。
 *
 * @param apiKey 原始 API Key
 * @returns 掩码后的展示字符串
 */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 8) return '••••••••'
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`
}

/**
 * 校验并规范化 API Key 输入。
 *
 * @param apiKey 未知来源的 API Key
 * @returns 去除首尾空白后的合法 Key
 * @throws 输入非法时抛出明确错误
 */
export function validateApiKeyFormat(apiKey: unknown): string {
  if (typeof apiKey !== 'string') {
    throw new Error('API Key 必须是字符串')
  }
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API Key 不能为空')
  }
  if (trimmed.length > 256) {
    throw new Error('API Key 过长')
  }
  if (/\s/.test(trimmed)) {
    throw new Error('API Key 不能包含空白字符')
  }
  return trimmed
}
