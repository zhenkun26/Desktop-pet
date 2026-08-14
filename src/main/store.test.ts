import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'
import { loadConfig, saveConfig } from './store'
import { DEFAULT_CONFIG } from '../shared/types'

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

describe('store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    rmSync(configPath(), { force: true })
  })

  it('should return defaults when no config file exists', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('should round-trip saved config', () => {
    saveConfig({ ...DEFAULT_CONFIG, windowX: 100, windowY: 200 })
    expect(loadConfig()).toMatchObject({ windowX: 100, windowY: 200 })
  })

  it('should fall back to defaults and log on corrupt config', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    writeFileSync(configPath(), '{not-json')
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('should fall back to the default pet for unregistered pet ids', () => {
    writeFileSync(
      configPath(),
      JSON.stringify({ ...DEFAULT_CONFIG, petId: 'nope' })
    )
    expect(loadConfig().petId).toBe('hutao')
  })

  it('should fall back to Chinese for a missing or invalid response language', () => {
    writeFileSync(
      configPath(),
      JSON.stringify({ ...DEFAULT_CONFIG, defaultResponseLanguage: 'ko-KR' })
    )
    expect(loadConfig().defaultResponseLanguage).toBe('zh-CN')
  })

  it('should persist a supported default response language', () => {
    saveConfig({ ...DEFAULT_CONFIG, defaultResponseLanguage: 'en-US' })
    expect(loadConfig().defaultResponseLanguage).toBe('en-US')
  })

  it('should create the userData directory when saving', () => {
    mkdirSync(app.getPath('userData'), { recursive: true })
    saveConfig(DEFAULT_CONFIG)
    expect(loadConfig()).toEqual(DEFAULT_CONFIG)
  })
})
