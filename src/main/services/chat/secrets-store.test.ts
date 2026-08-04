import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'
import {
  clearApiKey,
  getApiKey,
  getApiKeyStatus,
  setApiKey
} from './secrets-store'

function keyPath(): string {
  return join(app.getPath('userData'), 'deepseek-api-key.bin')
}

describe('secrets-store', () => {
  beforeEach(() => {
    clearApiKey()
  })

  afterEach(() => {
    clearApiKey()
    vi.restoreAllMocks()
  })

  it('should report not configured initially', () => {
    expect(getApiKeyStatus()).toMatchObject({ configured: false })
  })

  it('should store, read and mask an API key', () => {
    const status = setApiKey('sk-abcdefghijklmnop')
    expect(status).toMatchObject({ configured: true, masked: 'sk-…mnop' })
    expect(getApiKey()).toBe('sk-abcdefghijklmnop')
  })

  it('should clear the stored key', () => {
    setApiKey('sk-test-key')
    expect(clearApiKey()).toMatchObject({ configured: false })
    expect(existsSync(keyPath())).toBe(false)
  })

  it('should degrade gracefully and log when the key file is corrupt', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    writeFileSync(keyPath(), 'not-encrypted-garbage')
    expect(getApiKeyStatus()).toMatchObject({ configured: false })
    expect(errorSpy).toHaveBeenCalled()
  })

  it('should reject invalid key formats', () => {
    expect(() => setApiKey('')).toThrow('不能为空')
    expect(() => setApiKey('has space')).toThrow('空白字符')
  })

  it('should read a key stored as plain buffer through the mock', () => {
    writeFileSync(keyPath(), Buffer.from('enc:sk-plain-key'))
    expect(readFileSync(keyPath(), 'utf8')).toContain('sk-plain-key')
  })
})
