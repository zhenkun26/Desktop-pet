import { app } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'

/** 旧产品名对应的 userData 目录名（Electron userData = appData/<app 名>）。 */
export const LEGACY_USER_DATA_DIR_NAME = '胡桃桌宠'

/** 迁移完成标记文件：防止后续重复拷贝覆盖用户新数据。 */
export const MIGRATION_MARKER = '.migrated-user-data'

/**
 * 把旧 userData 目录中的文件一次性复制到新目录（仅当新目录尚无数据）。
 *
 * @param oldDir 旧 userData 目录
 * @param newDir 新 userData 目录
 * @returns 成功复制的文件数
 */
export function migrateUserDataFiles(oldDir: string, newDir: string): number {
  if (oldDir === newDir) return 0
  if (!existsSync(oldDir)) return 0
  if (existsSync(join(newDir, MIGRATION_MARKER))) return 0

  const newHasData =
    existsSync(join(newDir, 'config.json')) ||
    existsSync(join(newDir, 'chat.db'))
  if (newHasData) return 0

  mkdirSync(newDir, { recursive: true })

  let copied = 0
  let failed = 0
  for (const entry of readdirSync(oldDir)) {
    const source = join(oldDir, entry)
    const target = join(newDir, entry)
    if (!statSync(source).isFile()) continue
    if (existsSync(target)) continue
    try {
      copyFileSync(source, target)
      copied += 1
    } catch (error) {
      failed += 1
      console.error(`[migration] 复制用户数据失败: ${source}`, error)
    }
  }

  if (copied > 0) {
    writeFileSync(join(newDir, MIGRATION_MARKER), String(Date.now()))
    console.log(`[migration] 用户数据迁移完成: ${copied} 个文件（失败 ${failed}）`)
  }
  return copied
}

/**
 * 产品更名迁移：旧 userData（胡桃桌宠）→ 新 userData（当前应用名）。
 * 在加载配置与打开数据库之前调用；失败不阻塞启动。
 *
 * @returns 成功复制的文件数
 */
export function migrateLegacyUserData(): number {
  try {
    const oldDir = join(app.getPath('appData'), LEGACY_USER_DATA_DIR_NAME)
    return migrateUserDataFiles(oldDir, app.getPath('userData'))
  } catch (error) {
    console.error('[migration] 用户数据迁移失败（不影响启动）:', error)
    return 0
  }
}
