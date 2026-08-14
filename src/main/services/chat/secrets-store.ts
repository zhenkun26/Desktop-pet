import { app, safeStorage } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { ApiKeyStatus, CredentialStatus } from '../../../shared/types'
import { maskApiKey, validateApiKeyFormat } from './api-key-utils'

export { maskApiKey, validateApiKeyFormat }

const LEGACY_SECRETS_FILENAME = 'deepseek-api-key.bin'
const CREDENTIALS_DIRNAME = 'credentials'
const DEFAULT_CREDENTIAL_ID = 'deepseek-default'
const MIGRATION_MARKER = '.deepseek-credential-migrated-v1'

function legacyPath(): string {
  return join(app.getPath('userData'), LEGACY_SECRETS_FILENAME)
}

function credentialPath(credentialId: string): string {
  const safeId = credentialId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return join(app.getPath('userData'), CREDENTIALS_DIRNAME, `${safeId}.bin`)
}

function migrationMarkerPath(): string {
  return join(app.getPath('userData'), MIGRATION_MARKER)
}

function resolveCredentialPath(credentialId: string): string {
  const modern = credentialPath(credentialId)
  if (existsSync(modern)) return modern
  if (credentialId === DEFAULT_CREDENTIAL_ID && existsSync(legacyPath())) {
    return legacyPath()
  }
  return modern
}

function readCredentialFile(path: string): string | null {
  if (!existsSync(path)) return null
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用，无法读取 API Key')
  }
  const encrypted = readFileSync(path)
  if (encrypted.length === 0) return null
  const plain = safeStorage.decryptString(encrypted).trim()
  return plain || null
}

function writeCredentialFile(path: string, apiKey: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('系统加密不可用，拒绝以明文保存 API Key')
  }
  const dir = join(app.getPath('userData'), CREDENTIALS_DIRNAME)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tempPath = `${path}.tmp`
  writeFileSync(tempPath, safeStorage.encryptString(apiKey))
  renameSync(tempPath, path)
}

/** 仅主进程内部调用，切勿经 IPC 返回明文。 */
export function getCredential(credentialId: string): string | null {
  return readCredentialFile(resolveCredentialPath(credentialId))
}

export function getCredentialStatus(credentialId: string): CredentialStatus {
  const available = safeStorage.isEncryptionAvailable()
  try {
    const key = getCredential(credentialId)
    return {
      id: credentialId,
      configured: Boolean(key),
      masked: key ? maskApiKey(key) : null,
      encryptionAvailable: available,
      lastTestedAt: null
    }
  } catch (error) {
    console.error('[secrets] 读取凭据状态失败（可能文件损坏）:', error)
    return {
      id: credentialId,
      configured: false,
      masked: null,
      encryptionAvailable: available,
      lastTestedAt: null
    }
  }
}

export function getCredentialStatuses(
  credentialIds: string[]
): CredentialStatus[] {
  return [...new Set(credentialIds)].map(getCredentialStatus)
}

export function setCredential(
  credentialId: string,
  apiKey: string
): CredentialStatus {
  const id = credentialId.trim()
  if (!id) throw new Error('凭据 ID 不能为空')
  const trimmed = validateApiKeyFormat(apiKey)
  writeCredentialFile(credentialPath(id), trimmed)
  return getCredentialStatus(id)
}

export function clearCredential(credentialId: string): CredentialStatus {
  const modern = credentialPath(credentialId)
  if (existsSync(modern)) unlinkSync(modern)
  if (credentialId === DEFAULT_CREDENTIAL_ID && existsSync(legacyPath())) {
    unlinkSync(legacyPath())
  }
  return getCredentialStatus(credentialId)
}

/** 将旧版单 Key 复制到新凭据位置；保留旧文件以便失败时回滚。 */
export function migrateLegacyCredential(): boolean {
  if (existsSync(credentialPath(DEFAULT_CREDENTIAL_ID))) return true
  if (!existsSync(legacyPath())) return false
  try {
    const key = readCredentialFile(legacyPath())
    if (!key) return false
    writeCredentialFile(credentialPath(DEFAULT_CREDENTIAL_ID), key)
    writeFileSync(migrationMarkerPath(), String(Date.now()), 'utf8')
    return true
  } catch (error) {
    console.error('[migration] 旧 DeepSeek Key 迁移失败，保留原文件:', error)
    return false
  }
}

// 兼容现有 IPC 和旧测试；新代码应按 credentialId 调用上面的 API。
export function getApiKey(): string | null {
  return getCredential(DEFAULT_CREDENTIAL_ID)
}

export function getApiKeyStatus(): ApiKeyStatus {
  const status = getCredentialStatus(DEFAULT_CREDENTIAL_ID)
  return {
    configured: status.configured,
    masked: status.masked,
    encryptionAvailable: status.encryptionAvailable
  }
}

export function setApiKey(apiKey: string): ApiKeyStatus {
  const status = setCredential(DEFAULT_CREDENTIAL_ID, apiKey)
  // 保留旧文件路径，兼容升级前的回滚和现有迁移逻辑。
  writeCredentialFile(legacyPath(), validateApiKeyFormat(apiKey))
  return {
    configured: status.configured,
    masked: status.masked,
    encryptionAvailable: status.encryptionAvailable
  }
}

export function clearApiKey(): ApiKeyStatus {
  clearCredential(DEFAULT_CREDENTIAL_ID)
  return getApiKeyStatus()
}
