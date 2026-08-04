import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE_LENGTH, validateChatContent } from './chat-input'

describe('validateChatContent', () => {
  it('should accept and trim a valid message', () => {
    expect(validateChatContent('  你好，胡桃！  ')).toEqual({
      ok: true,
      content: '你好，胡桃！'
    })
  })

  it('should reject empty and non-string content', () => {
    expect(validateChatContent('')).toMatchObject({ ok: false })
    expect(validateChatContent('   ')).toMatchObject({ ok: false })
    expect(validateChatContent(undefined)).toMatchObject({ ok: false })
  })

  it('should reject content over the length limit', () => {
    const result = validateChatContent('x'.repeat(MAX_MESSAGE_LENGTH + 1))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toContain('消息过长')
  })

  it('should accept content exactly at the length limit', () => {
    expect(validateChatContent('x'.repeat(MAX_MESSAGE_LENGTH))).toMatchObject({
      ok: true
    })
  })
})
