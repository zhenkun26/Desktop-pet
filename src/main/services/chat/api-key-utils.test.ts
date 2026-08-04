import { describe, expect, it } from 'vitest'
import { maskApiKey, validateApiKeyFormat } from './api-key-utils'

describe('maskApiKey', () => {
  it('should keep first 3 and last 4 characters for long keys', () => {
    expect(maskApiKey('sk-abcdefghijklmnop')).toBe('sk-…mnop')
  })

  it('should fully mask short keys', () => {
    expect(maskApiKey('short')).toBe('••••••••')
  })
})

describe('validateApiKeyFormat', () => {
  it('should accept a valid key and trim whitespace', () => {
    expect(validateApiKeyFormat('  sk-valid-key  ')).toBe('sk-valid-key')
  })

  it('should reject non-string input', () => {
    expect(() => validateApiKeyFormat(42)).toThrow('必须是字符串')
  })

  it('should reject empty input', () => {
    expect(() => validateApiKeyFormat('   ')).toThrow('不能为空')
  })

  it('should reject over-long input', () => {
    expect(() => validateApiKeyFormat('x'.repeat(300))).toThrow('过长')
  })

  it('should reject keys containing whitespace', () => {
    expect(() => validateApiKeyFormat('sk has space')).toThrow('空白字符')
  })
})
