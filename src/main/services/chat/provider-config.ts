import { app } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import type {
  ModelCapabilities,
  ModelProfile,
  ModelProfileInput,
  ProviderConfig,
  ProviderConfigSnapshot,
  ProviderConnection,
  ProviderConnectionInput,
  ProviderType
} from '../../../shared/types'
import { PROVIDER_TYPES } from '../../../shared/types'
import { migrateLegacyCredential } from './secrets-store'

export const DEFAULT_PROVIDER_CONNECTION_ID = 'deepseek-default'
export const DEFAULT_CREDENTIAL_ID = 'deepseek-default'
export const DEFAULT_MODEL_PROFILE_ID = 'deepseek-default'
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash'

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  text: true
}

interface ProviderConfigFile extends ProviderConfig {
  version: 1
}

function configPath(): string {
  return join(app.getPath('userData'), 'provider-config.json')
}

function createDefaultConfig(): ProviderConfigFile {
  const now = Date.now()
  return {
    version: 1,
    connections: [
      {
        id: DEFAULT_PROVIDER_CONNECTION_ID,
        providerType: 'openai-compatible',
        displayName: 'DeepSeek',
        baseUrl: DEFAULT_DEEPSEEK_BASE_URL,
        credentialId: DEFAULT_CREDENTIAL_ID,
        enabled: true,
        allowLocalhost: false,
        // 旧版用户已经明确使用 DeepSeek；迁移后视为已确认，新增连接仍默认未确认。
        privacyConfirmed: true,
        updatedAt: now
      }
    ],
    models: [
      {
        id: DEFAULT_MODEL_PROFILE_ID,
        connectionId: DEFAULT_PROVIDER_CONNECTION_ID,
        modelId: DEFAULT_DEEPSEEK_MODEL,
        displayName: DEFAULT_DEEPSEEK_MODEL,
        enabled: true,
        capabilities: { ...DEFAULT_CAPABILITIES },
        updatedAt: now
      }
    ]
  }
}

function cloneConfig(config: ProviderConfigFile): ProviderConfigFile {
  return JSON.parse(JSON.stringify(config)) as ProviderConfigFile
}

function readConfigFile(): ProviderConfigFile {
  const path = configPath()
  if (!existsSync(path)) return createDefaultConfig()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ProviderConfigFile>
    return normalizeConfig(raw)
  } catch (error) {
    console.error('[providers] 读取供应商配置失败，已回退默认配置:', error)
    return createDefaultConfig()
  }
}

function normalizeConfig(raw: Partial<ProviderConfigFile>): ProviderConfigFile {
  const defaults = createDefaultConfig()
  const connections = Array.isArray(raw.connections)
    ? raw.connections.filter(isProviderConnection).map((item) => ({
        ...item,
        allowLocalhost: item.allowLocalhost === true
      }))
    : []
  const models = Array.isArray(raw.models)
    ? raw.models.filter(isModelProfile)
    : []

  if (!connections.some((item) => item.id === DEFAULT_PROVIDER_CONNECTION_ID)) {
    connections.unshift(defaults.connections[0])
  }
  if (!models.some((item) => item.id === DEFAULT_MODEL_PROFILE_ID)) {
    models.unshift(defaults.models[0])
  }
  return { version: 1, connections, models }
}

function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string' && PROVIDER_TYPES.includes(value as ProviderType)
}

function isProviderConnection(value: unknown): value is ProviderConnection {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ProviderConnection>
  return (
    typeof item.id === 'string' &&
    isProviderType(item.providerType) &&
    typeof item.displayName === 'string' &&
    typeof item.baseUrl === 'string' &&
    typeof item.credentialId === 'string' &&
    typeof item.enabled === 'boolean'
  )
}

function isModelProfile(value: unknown): value is ModelProfile {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ModelProfile>
  return (
    typeof item.id === 'string' &&
    typeof item.connectionId === 'string' &&
    typeof item.modelId === 'string' &&
    typeof item.displayName === 'string' &&
    typeof item.enabled === 'boolean' &&
    Boolean(item.capabilities) &&
    typeof item.updatedAt === 'number'
  )
}

function writeConfigFile(config: ProviderConfigFile): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = configPath()
  const tempPath = `${path}.tmp`
  writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf8')
  renameSync(tempPath, path)
}

function assertIdentifier(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed || !/^[a-zA-Z0-9._-]{1,80}$/.test(trimmed)) {
    throw new Error(`${label}格式不合法`)
  }
  return trimmed
}

export function validateProviderBaseUrl(
  value: string,
  allowLocalhost = false
): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('供应商端点格式不合法')
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
    url.hostname
  )
  if (
    url.protocol !== 'https:' &&
    !(allowLocalhost && localHost && url.protocol === 'http:')
  ) {
    throw new Error('供应商端点必须使用 HTTPS；本机服务仅允许 localhost')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('供应商端点不得包含账号、密码、查询参数或片段')
  }
  return url.toString().replace(/\/$/, '')
}

export function getProviderConfig(): ProviderConfig {
  migrateLegacyCredential()
  const current = readConfigFile()
  const normalized = normalizeConfig(current)
  if (JSON.stringify(current) !== JSON.stringify(normalized)) {
    writeConfigFile(normalized)
  }
  return cloneConfig(normalized)
}

export function saveProviderConnection(
  input: ProviderConnectionInput
): ProviderConnection {
  if (!isProviderType(input.providerType)) throw new Error('供应商协议不支持')
  const config = normalizeConfig(readConfigFile())
  const id = assertIdentifier(
    input.id ?? `connection-${Date.now()}`,
    '供应商连接 ID'
  )
  const displayName = input.displayName.trim().slice(0, 80)
  if (!displayName) throw new Error('供应商名称不能为空')
  const allowLocalhost = input.allowLocalhost === true
  const baseUrl = validateProviderBaseUrl(input.baseUrl, allowLocalhost)
  const credentialId = assertIdentifier(
    input.credentialId ?? id,
    '凭据 ID'
  )
  const now = Date.now()
  const existing = config.connections.find((item) => item.id === id)
  const connection: ProviderConnection = {
    id,
    providerType: input.providerType,
    displayName,
    baseUrl,
    credentialId,
    enabled: input.enabled ?? existing?.enabled ?? true,
    allowLocalhost,
    privacyConfirmed: existing?.privacyConfirmed ?? false,
    updatedAt: now
  }
  const duplicate = config.connections.find(
    (item) => item.id !== id && item.displayName === displayName && item.baseUrl === baseUrl
  )
  if (duplicate) throw new Error('已存在相同供应商连接')
  if (existing) {
    config.connections = config.connections.map((item) =>
      item.id === id ? connection : item
    )
  } else {
    config.connections.push(connection)
  }
  writeConfigFile(config)
  return connection
}

export function deleteProviderConnection(connectionId: string): boolean {
  const config = normalizeConfig(readConfigFile())
  if (connectionId === DEFAULT_PROVIDER_CONNECTION_ID) return false
  const exists = config.connections.some((item) => item.id === connectionId)
  if (!exists) return false
  config.connections = config.connections.filter((item) => item.id !== connectionId)
  config.models = config.models.filter((item) => item.connectionId !== connectionId)
  writeConfigFile(config)
  return true
}

export function saveModelProfile(input: ModelProfileInput): ModelProfile {
  const config = normalizeConfig(readConfigFile())
  const connectionId = assertIdentifier(input.connectionId, '供应商连接 ID')
  if (!config.connections.some((item) => item.id === connectionId)) {
    throw new Error('供应商连接不存在')
  }
  const modelId = input.modelId.trim().slice(0, 120)
  const displayName = input.displayName.trim().slice(0, 120)
  if (!modelId || !displayName) throw new Error('模型 ID 和名称不能为空')
  const id = assertIdentifier(input.id ?? `model-${Date.now()}`, '模型配置 ID')
  const duplicate = config.models.find(
    (item) =>
      item.id !== id &&
      item.connectionId === connectionId &&
      item.modelId === modelId
  )
  if (duplicate) throw new Error('该供应商下已存在相同模型')
  const existing = config.models.find((item) => item.id === id)
  const model: ModelProfile = {
    id,
    connectionId,
    modelId,
    displayName,
    enabled: input.enabled ?? existing?.enabled ?? true,
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      ...existing?.capabilities,
      ...input.capabilities
    },
    updatedAt: Date.now()
  }
  config.models = existing
    ? config.models.map((item) => (item.id === id ? model : item))
    : [...config.models, model]
  writeConfigFile(config)
  return model
}

export function deleteModelProfile(modelProfileId: string): boolean {
  const config = normalizeConfig(readConfigFile())
  if (modelProfileId === DEFAULT_MODEL_PROFILE_ID) return false
  const exists = config.models.some((item) => item.id === modelProfileId)
  if (!exists) return false
  config.models = config.models.filter((item) => item.id !== modelProfileId)
  writeConfigFile(config)
  return true
}

export function confirmProviderPrivacy(connectionId: string): ProviderConnection {
  const config = normalizeConfig(readConfigFile())
  const connection = config.connections.find((item) => item.id === connectionId)
  if (!connection) throw new Error('供应商连接不存在')
  connection.privacyConfirmed = true
  connection.updatedAt = Date.now()
  writeConfigFile(config)
  return connection
}

export function getProviderSnapshot(
  modelProfileId: string | null | undefined
): ProviderConfigSnapshot | null {
  const config = getProviderConfig()
  const model = config.models.find(
    (item) => item.id === (modelProfileId || DEFAULT_MODEL_PROFILE_ID)
  )
  if (!model) return null
  const connection = config.connections.find((item) => item.id === model.connectionId)
  if (!connection) return null
  return {
    modelProfileId: model.id,
    providerConnectionId: connection.id,
    providerType: connection.providerType,
    providerName: connection.displayName,
    baseUrl: connection.baseUrl,
    modelId: model.modelId,
    modelName: model.displayName,
    credentialId: connection.credentialId
  }
}

export function getModelProfile(modelProfileId: string): ModelProfile | null {
  return getProviderConfig().models.find((item) => item.id === modelProfileId) ?? null
}

export function getProviderConnection(connectionId: string): ProviderConnection | null {
  return (
    getProviderConfig().connections.find((item) => item.id === connectionId) ?? null
  )
}
