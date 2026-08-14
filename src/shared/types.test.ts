import { describe, expect, it } from 'vitest'
import {
  CHAT_LANGUAGE_LABELS,
  CHAT_LANGUAGES,
  DEFAULT_CHAT_LANGUAGE,
  normalizeChatLanguage
} from './types'

describe('chat language domain', () => {
  it('should expose exactly the supported Chinese, English and Japanese languages', () => {
    expect(CHAT_LANGUAGES).toEqual(['zh-CN', 'en-US', 'ja-JP'])
    expect(CHAT_LANGUAGE_LABELS).toEqual({
      'zh-CN': '中文',
      'en-US': 'English',
      'ja-JP': '日本語'
    })
  })

  it('should normalize missing and invalid values to Chinese', () => {
    expect(normalizeChatLanguage(undefined)).toBe(DEFAULT_CHAT_LANGUAGE)
    expect(normalizeChatLanguage('ko-KR')).toBe(DEFAULT_CHAT_LANGUAGE)
    expect(normalizeChatLanguage(42)).toBe(DEFAULT_CHAT_LANGUAGE)
  })

  it('should preserve each supported language', () => {
    expect(normalizeChatLanguage('zh-CN')).toBe('zh-CN')
    expect(normalizeChatLanguage('en-US')).toBe('en-US')
    expect(normalizeChatLanguage('ja-JP')).toBe('ja-JP')
  })
})
