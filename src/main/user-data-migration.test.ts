import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MIGRATION_MARKER,
  migrateUserDataFiles
} from './user-data-migration'

describe('migrateUserDataFiles', () => {
  let oldDir: string
  let newDir: string

  beforeEach(() => {
    oldDir = join(tmpdir(), `pet-old-${Date.now()}-${Math.random()}`)
    newDir = join(tmpdir(), `pet-new-${Date.now()}-${Math.random()}`)
    mkdirSync(oldDir, { recursive: true })
    mkdirSync(newDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(oldDir, { recursive: true, force: true })
    rmSync(newDir, { recursive: true, force: true })
  })

  it('should copy all user data files once and write the marker', () => {
    writeFileSync(join(oldDir, 'config.json'), '{}')
    writeFileSync(join(oldDir, 'chat.db'), 'sqlite')
    writeFileSync(join(oldDir, 'chat.db-wal'), 'wal')
    writeFileSync(join(oldDir, 'deepseek-api-key.bin'), 'enc')

    const copied = migrateUserDataFiles(oldDir, newDir)

    expect(copied).toBe(4)
    expect(existsSync(join(newDir, 'config.json'))).toBe(true)
    expect(existsSync(join(newDir, 'chat.db'))).toBe(true)
    expect(existsSync(join(newDir, 'deepseek-api-key.bin'))).toBe(true)
    expect(existsSync(join(newDir, MIGRATION_MARKER))).toBe(true)
  })

  it('should be idempotent when the marker exists', () => {
    writeFileSync(join(oldDir, 'config.json'), '{}')
    writeFileSync(join(newDir, MIGRATION_MARKER), '1')
    expect(migrateUserDataFiles(oldDir, newDir)).toBe(0)
  })

  it('should skip when the new directory already has data', () => {
    writeFileSync(join(oldDir, 'config.json'), '{}')
    writeFileSync(join(newDir, 'chat.db'), 'existing')
    expect(migrateUserDataFiles(oldDir, newDir)).toBe(0)
  })

  it('should no-op when the old directory is missing', () => {
    rmSync(oldDir, { recursive: true, force: true })
    expect(migrateUserDataFiles(oldDir, newDir)).toBe(0)
  })

  it('should no-op when old and new are the same directory', () => {
    expect(migrateUserDataFiles(oldDir, oldDir)).toBe(0)
  })
})
