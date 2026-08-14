/** 在日志和用户可见错误前移除常见认证信息，避免凭据泄露。 */
export function redactSensitive(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? '')
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key|token|secret|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]')
}

export function redactErrorMessage(value: unknown, fallback: string): string {
  const redacted = redactSensitive(value).trim()
  return redacted || fallback
}
