import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** 每个测试进程独立的临时 userData 目录。 */
const TEST_USER_DATA_DIR = mkdtempSync(join(tmpdir(), 'hutao-pet-test-'))

export const app = {
  getPath: (name: string): string =>
    name === 'userData' ? TEST_USER_DATA_DIR : TEST_USER_DATA_DIR,
  getVersion: (): string => '2.0.2'
}

export const safeStorage = {
  isEncryptionAvailable: (): boolean => true,
  encryptString: (plain: string): Buffer => Buffer.from(`enc:${plain}`),
  decryptString: (buffer: Buffer): string => {
    const text = buffer.toString('utf8')
    if (!text.startsWith('enc:')) {
      throw new Error('safeStorage decrypt failed')
    }
    return text.slice(4)
  }
}

export class BrowserWindow {}
export class Tray {}
export class Menu {}
