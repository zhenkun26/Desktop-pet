import type { ChatErrorCode } from '../../../shared/types'

/** 单条聊天消息最大长度（字符）。 */
export const MAX_MESSAGE_LENGTH = 4000

export type ChatContentValidation =
  | { ok: true; content: string }
  | { ok: false; error: string; code: ChatErrorCode }

/**
 * 校验并规范化聊天消息内容。
 *
 * @param content 未知来源的消息内容
 * @returns 校验通过时返回清理后的内容，否则返回用户可读错误
 */
export function validateChatContent(content: unknown): ChatContentValidation {
  const trimmed = typeof content === 'string' ? content.trim() : ''
  if (!trimmed) {
    return { ok: false, error: '消息不能为空', code: 'unknown' }
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `消息过长（最多 ${MAX_MESSAGE_LENGTH} 字）`,
      code: 'unknown'
    }
  }
  return { ok: true, content: trimmed }
}
