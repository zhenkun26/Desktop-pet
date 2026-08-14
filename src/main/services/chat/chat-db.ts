import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_CHAT_LANGUAGE,
  normalizeChatLanguage,
  type ChatLanguage,
  type ChatMessageRecord,
  type ChatMessageRole,
  type ConversationRecord,
  type PersonaProfile,
  type PersonaProfileFields,
  type PetId
} from '../../../shared/types'
import { mergePersonaProfile, sanitizePersonaFields } from './personas'

/**
 * node:sqlite（Electron 39+ 内置 Node >= 22.13，免原生编译）的宽松封装，
 * 提供同步 API 与简单类型，避免类型噪音。
 */
interface LooseStatement {
  run: (...args: unknown[]) => { changes: number | bigint }
  get: (...args: unknown[]) => Record<string, unknown> | undefined
  all: (...args: unknown[]) => Record<string, unknown>[]
}

interface LooseDb {
  exec: (sql: string) => void
  prepare: (sql: string) => LooseStatement
  close: () => void
}

/** 事务包装：返回可调用的事务函数（BEGIN / COMMIT / ROLLBACK）。 */
function transaction<T>(database: LooseDb, fn: () => T): () => T {
  return () => {
    database.exec('BEGIN')
    try {
      const result = fn()
      database.exec('COMMIT')
      return result
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

let db: LooseDb | null = null

/** 旧 Tauri 版数据目录（bundle identifier 命名） */
const LEGACY_DB_PATH = join(
  app.getPath('home'),
  'Library',
  'Application Support',
  'com.hutao-desktop-pet',
  'chat.db'
)

export function getChatDb(): LooseDb {
  if (db) return db
  const database = new DatabaseSync(
    join(app.getPath('userData'), 'chat.db')
  ) as unknown as LooseDb
  database.exec('PRAGMA journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS persona_profiles (
      pet_id TEXT PRIMARY KEY,
      user_call_name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      personality_bias TEXT NOT NULL,
      tone_preference TEXT NOT NULL,
      extra_notes TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_message_preview TEXT,
      response_language TEXT NOT NULL DEFAULT 'zh-CN',
      model_profile_id TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'complete',
      error_code TEXT,
      model_profile_id TEXT,
      provider_connection_id TEXT,
      provider_name TEXT,
      model_id TEXT,
      model_name TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_pet
      ON conversations(pet_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at ASC);
  `)
  try {
    ensureConversationLanguageColumn(database)
    ensureConversationModelColumn(database)
    ensureMessageModelSnapshotColumns(database)
  } catch (error) {
    database.close()
    throw error
  }
  db = database
  migrateLegacyDb(database)
  return database
}

/** 对已有数据库执行一次幂等的会话语言列迁移。 */
function ensureConversationLanguageColumn(database: LooseDb): void {
  const columns = database
    .prepare('PRAGMA table_info(conversations)')
    .all()
  const hasLanguageColumn = columns.some(
    (column) => column.name === 'response_language'
  )
  if (hasLanguageColumn) return

  try {
    const tx = transaction(database, () => {
      database.exec(
        `ALTER TABLE conversations
         ADD COLUMN response_language TEXT NOT NULL DEFAULT ${sqlStringLiteral(
           DEFAULT_CHAT_LANGUAGE
         )}`
      )
    })
    tx()
  } catch (error) {
    console.error('[migration] 会话语言字段迁移失败，数据库保持可重试状态:', error)
    throw error
  }
}

function ensureConversationModelColumn(database: LooseDb): void {
  const columns = database.prepare('PRAGMA table_info(conversations)').all()
  if (columns.some((column) => column.name === 'model_profile_id')) return
  database.exec('ALTER TABLE conversations ADD COLUMN model_profile_id TEXT')
}

function ensureMessageModelSnapshotColumns(database: LooseDb): void {
  const columns = database.prepare('PRAGMA table_info(messages)').all()
  const existing = new Set(columns.map((column) => String(column.name)))
  const additions: Array<[string, string]> = [
    ['model_profile_id', 'TEXT'],
    ['provider_connection_id', 'TEXT'],
    ['provider_name', 'TEXT'],
    ['model_id', 'TEXT'],
    ['model_name', 'TEXT']
  ]
  for (const [name, type] of additions) {
    if (!existing.has(name)) {
      database.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`)
    }
  }
}

/**
 * 一次性迁移旧 Tauri 数据：新库为空且旧库存在时 ATTACH 复制。
 * 旧库时间戳是「秒级」，新库统一「毫秒」；status 'ok' 映射为 'complete'。
 * 旧库只读，不修改不删除；迁移失败仅记日志，不阻塞启动。
 */
function migrateLegacyDb(database: LooseDb): void {
  try {
    const count = database
      .prepare('SELECT COUNT(*) AS c FROM conversations')
      .get() as { c: number }
    if (count.c > 0) return
    if (!existsSync(LEGACY_DB_PATH)) return

    console.log('[migration] 检测到旧版数据，开始迁移:', LEGACY_DB_PATH)
    database.exec(`ATTACH DATABASE ${sqlStringLiteral(LEGACY_DB_PATH)} AS legacy`)
    const tx = transaction(database, () => {
      database.exec(`
        INSERT INTO conversations (
          id, pet_id, title, created_at, updated_at, last_message_preview,
          response_language, model_profile_id
        )
        SELECT id, pet_id, title, created_at * 1000, updated_at * 1000,
               NULLIF(last_message_preview, ''), ${sqlStringLiteral(
                 DEFAULT_CHAT_LANGUAGE
               )}, NULL
        FROM legacy.conversations;

        INSERT INTO messages (
          id, conversation_id, role, content, created_at, status, error_code,
          model_profile_id, provider_connection_id, provider_name, model_id, model_name
        )
        SELECT id, conversation_id, role, content, created_at * 1000,
               CASE status WHEN 'ok' THEN 'complete' ELSE status END,
               error_code, NULL, NULL, NULL, NULL, NULL
        FROM legacy.messages;
      `)
    })
    tx()
    const convs = database
      .prepare('SELECT COUNT(*) AS c FROM conversations')
      .get() as { c: number }
    const msgs = database
      .prepare('SELECT COUNT(*) AS c FROM messages')
      .get() as { c: number }
    console.log(`[migration] 迁移完成: ${convs.c} 个会话, ${msgs.c} 条消息`)
    database.exec('DETACH DATABASE legacy')
  } catch (error) {
    console.error('[migration] 旧数据迁移失败（不影响启动）:', error)
    try {
      database.exec('DETACH DATABASE legacy')
    } catch {
      /* 未 ATTACH 时忽略 */
    }
  }
}

function rowToPersona(row: Record<string, unknown>): PersonaProfile {
  return {
    petId: row.pet_id as PetId,
    userCallName: String(row.user_call_name),
    relationship: String(row.relationship),
    personalityBias:
      row.personality_bias as PersonaProfile['personalityBias'],
    tonePreference: row.tone_preference as PersonaProfile['tonePreference'],
    extraNotes: String(row.extra_notes ?? ''),
    updatedAt: Number(row.updated_at)
  }
}

function rowToConversation(row: Record<string, unknown>): ConversationRecord {
  return {
    id: String(row.id),
    petId: row.pet_id as PetId,
    title: String(row.title),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastMessagePreview:
      row.last_message_preview == null
        ? null
        : String(row.last_message_preview),
    responseLanguage: normalizeChatLanguage(row.response_language),
    modelProfileId:
      row.model_profile_id == null ? null : String(row.model_profile_id)
  }
}

function rowToMessage(row: Record<string, unknown>): ChatMessageRecord {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: row.role as ChatMessageRole,
    content: String(row.content),
    createdAt: Number(row.created_at),
    status: row.status as ChatMessageRecord['status'],
    errorCode:
      row.error_code == null
        ? null
        : (row.error_code as ChatMessageRecord['errorCode']),
    modelProfileId:
      row.model_profile_id == null ? null : String(row.model_profile_id),
    providerConnectionId:
      row.provider_connection_id == null
        ? null
        : String(row.provider_connection_id),
    providerName:
      row.provider_name == null ? null : String(row.provider_name),
    modelId: row.model_id == null ? null : String(row.model_id),
    modelName: row.model_name == null ? null : String(row.model_name)
  }
}

export function getPersonaProfile(petId: PetId): PersonaProfile {
  const row = getChatDb()
    .prepare('SELECT * FROM persona_profiles WHERE pet_id = ?')
    .get(petId) as Record<string, unknown> | undefined
  if (!row) return mergePersonaProfile(petId, null, 0)
  return mergePersonaProfile(petId, rowToPersona(row), Number(row.updated_at))
}

export function updatePersonaProfile(
  petId: PetId,
  fields: Partial<PersonaProfileFields>
): PersonaProfile {
  const sanitized = sanitizePersonaFields(fields)
  const now = Date.now()
  getChatDb()
    .prepare(
      `INSERT INTO persona_profiles (
         pet_id, user_call_name, relationship, personality_bias,
         tone_preference, extra_notes, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(pet_id) DO UPDATE SET
         user_call_name = excluded.user_call_name,
         relationship = excluded.relationship,
         personality_bias = excluded.personality_bias,
         tone_preference = excluded.tone_preference,
         extra_notes = excluded.extra_notes,
         updated_at = excluded.updated_at`
    )
    .run(
      petId,
      sanitized.userCallName,
      sanitized.relationship,
      sanitized.personalityBias,
      sanitized.tonePreference,
      sanitized.extraNotes,
      now
    )
  return getPersonaProfile(petId)
}

export function listConversations(petId: PetId): ConversationRecord[] {
  const rows = getChatDb()
    .prepare(
      `SELECT * FROM conversations
       WHERE pet_id = ?
       ORDER BY updated_at DESC, created_at DESC`
    )
    .all(petId)
  return rows.map(rowToConversation)
}

export function createConversation(
  petId: PetId,
  title?: string,
  responseLanguage: ChatLanguage = DEFAULT_CHAT_LANGUAGE,
  modelProfileId: string | null = null
): ConversationRecord {
  const now = Date.now()
  const id = randomUUID()
  const resolvedTitle =
    typeof title === 'string' && title.trim()
      ? title.trim().slice(0, 64)
      : `新对话 ${new Date(now).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`
  getChatDb()
    .prepare(
      `INSERT INTO conversations (
         id, pet_id, title, created_at, updated_at, last_message_preview,
         response_language, model_profile_id
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      id,
      petId,
      resolvedTitle,
      now,
      now,
      normalizeChatLanguage(responseLanguage),
      modelProfileId
    )
  return getConversation(id)!
}

export function getConversation(id: string): ConversationRecord | null {
  const row = getChatDb()
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id)
  return row ? rowToConversation(row) : null
}

export function renameConversation(
  id: string,
  title: string
): ConversationRecord | null {
  const trimmed = title.trim().slice(0, 64)
  if (!trimmed) return getConversation(id)
  getChatDb()
    .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
    .run(trimmed, Date.now(), id)
  return getConversation(id)
}

/** 更新会话回复语言；未知值统一回退为中文。 */
export function updateConversationResponseLanguage(
  id: string,
  responseLanguage: ChatLanguage
): ConversationRecord | null {
  getChatDb()
    .prepare(
      `UPDATE conversations
       SET response_language = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(normalizeChatLanguage(responseLanguage), Date.now(), id)
  return getConversation(id)
}

export function getConversationResponseLanguage(
  id: string
): ChatLanguage | null {
  const conversation = getConversation(id)
  return conversation?.responseLanguage ?? null
}

export function getConversationModelProfile(id: string): string | null {
  return getConversation(id)?.modelProfileId ?? null
}

export function updateConversationModelProfile(
  id: string,
  modelProfileId: string | null
): ConversationRecord | null {
  getChatDb()
    .prepare(
      `UPDATE conversations
       SET model_profile_id = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(modelProfileId, Date.now(), id)
  return getConversation(id)
}

export function deleteConversation(id: string): boolean {
  const database = getChatDb()
  const tx = transaction(database, () => {
    database.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id)
    return database.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  })
  return Number(tx().changes) > 0
}

export function getConversationMessages(
  conversationId: string
): ChatMessageRecord[] {
  const rows = getChatDb()
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, rowid ASC`
    )
    .all(conversationId)
  return rows.map(rowToMessage)
}

/** 取最近 N 条消息作为模型上下文（不含 system/error/cancelled）。 */
export function getRecentContextMessages(
  conversationId: string,
  limit = 20
): ChatMessageRecord[] {
  const rows = getChatDb()
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ?
         AND role IN ('user', 'assistant')
         AND status = 'complete'
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`
    )
    .all(conversationId, limit)
  return rows.map(rowToMessage).reverse()
}

export function insertMessage(input: {
  id?: string
  conversationId: string
  role: ChatMessageRole
  content: string
  status?: ChatMessageRecord['status']
  errorCode?: ChatMessageRecord['errorCode']
  modelProfileId?: string | null
  providerConnectionId?: string | null
  providerName?: string | null
  modelId?: string | null
  modelName?: string | null
  createdAt?: number
}): ChatMessageRecord {
  const id = input.id ?? randomUUID()
  const createdAt = input.createdAt ?? Date.now()
  const status = input.status ?? 'complete'
  const database = getChatDb()
  const tx = transaction(database, () => {
    database
      .prepare(
        `INSERT INTO messages (
           id, conversation_id, role, content, created_at, status, error_code,
           model_profile_id, provider_connection_id, provider_name, model_id, model_name
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.conversationId,
        input.role,
        input.content,
        createdAt,
        status,
        input.errorCode ?? null,
        input.modelProfileId ?? null,
        input.providerConnectionId ?? null,
        input.providerName ?? null,
        input.modelId ?? null,
        input.modelName ?? null
      )
    const preview = input.content.trim().slice(0, 80) || null
    if (preview != null) {
      database
        .prepare(
          `UPDATE conversations
           SET updated_at = ?, last_message_preview = ?
           WHERE id = ?`
        )
        .run(createdAt, preview, input.conversationId)
    } else {
      database
        .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
        .run(createdAt, input.conversationId)
    }
  })
  tx()
  return getMessage(id)!
}

export function getMessage(id: string): ChatMessageRecord | null {
  const row = getChatDb()
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(id)
  return row ? rowToMessage(row) : null
}

export function updateMessage(
  id: string,
  patch: {
    content?: string
    status?: ChatMessageRecord['status']
    errorCode?: ChatMessageRecord['errorCode'] | null
  }
): ChatMessageRecord | null {
  const current = getMessage(id)
  if (!current) return null
  const content = patch.content ?? current.content
  const status = patch.status ?? current.status
  const errorCode =
    patch.errorCode === undefined ? current.errorCode : patch.errorCode
  const database = getChatDb()
  const now = Date.now()
  const tx = transaction(database, () => {
    database
      .prepare(
        `UPDATE messages
         SET content = ?, status = ?, error_code = ?
         WHERE id = ?`
      )
      .run(content, status, errorCode ?? null, id)
    if (content.trim()) {
      database
        .prepare(
          `UPDATE conversations
           SET updated_at = ?, last_message_preview = ?
           WHERE id = ?`
        )
        .run(now, content.trim().slice(0, 80), current.conversationId)
    }
  })
  tx()
  return getMessage(id)
}

export function closeChatDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
