import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_CONFIG,
  normalizeChatLanguage,
  PET_IDS,
  type PetConfig,
  type PetId
} from '../shared/types'

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): PetConfig {
  const path = configPath()
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Partial<PetConfig>
    const petId: PetId =
      typeof raw.petId === 'string' && PET_IDS.includes(raw.petId as PetId)
        ? (raw.petId as PetId)
        : DEFAULT_CONFIG.petId
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      petId,
      defaultModelProfileId:
        typeof raw.defaultModelProfileId === 'string' &&
        raw.defaultModelProfileId.trim()
          ? raw.defaultModelProfileId.trim()
          : raw.defaultModelProfileId === null
            ? null
            : DEFAULT_CONFIG.defaultModelProfileId,
      defaultResponseLanguage: normalizeChatLanguage(
        raw.defaultResponseLanguage
      )
    }
  } catch (error) {
    console.error('[store] 读取配置失败，已回退默认配置:', error)
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: PetConfig): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    console.error('[store] 保存配置失败:', error)
  }
}
