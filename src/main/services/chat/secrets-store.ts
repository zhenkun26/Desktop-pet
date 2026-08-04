import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ApiKeyStatus } from '../../../shared/types'
import { maskApiKey, validateApiKeyFormat } from './api-key-utils'

export { maskApiKey, validateApiKeyFormat }

const SECRETS_FILENAME = 'deepseek-api-key.bin'

function resolvePath(): string {
  return join(app.getPath('userData'), SECRETS_FILENAME)
}

export function getApiKeyStatus(): ApiKeyStatus {
  const available = safeStorage.isEncryptionAvailable()
  if (!existsSync(resolvePath())) {
    return { configured: false, masked: null, encryptionAvailable: available }
  }
  try {
    const key = getApiKey()
    if (!key) {
      return { configured: false, masked: null, encryptionAvailable: available }
    }
    return {
      configured: true,
      masked: maskApiKey(key),
      encryptionAvailable: available
    }
  } catch (error) {
    console.error('[secrets] 读取 API Key 状态失败（可能文件损坏）:', error)
    return { configured: false, masked: null, encryptionAvailable: available }
  }
}

/** 仅主进程内部调用，切勿经 IPC 返回明文。 */
export function getApiKey(): string | null {
  if (!existsSync(resolvePath())) return null
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用，无法读取 API Key')
  }
  const encrypted = readFileSync(resolvePath())
  if (encrypted.length === 0) return null
  const plain = safeStorage.decryptString(encrypted).trim()
  return plain || null
}

export function setApiKey(apiKey: string): ApiKeyStatus {
  const trimmed = validateApiKeyFormat(apiKey)
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用，拒绝以明文保存 API Key')
  }
  writeFileSync(resolvePath(), safeStorage.encryptString(trimmed))
  return getApiKeyStatus()
}

export function clearApiKey(): ApiKeyStatus {
  if (existsSync(resolvePath())) {
    unlinkSync(resolvePath())
  }
  return getApiKeyStatus()
}
