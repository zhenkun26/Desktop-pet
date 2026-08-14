import { DatabaseSync } from 'node:sqlite'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'
import {
  closeChatDb,
  createConversation,
  deleteConversation,
  getChatDb,
  getConversationResponseLanguage,
  getConversationMessages,
  getPersonaProfile,
  getRecentContextMessages,
  insertMessage,
  listConversations,
  renameConversation,
  updateConversationResponseLanguage,
  updateMessage,
  updatePersonaProfile
} from './chat-db'

describe('chat-db', () => {
  beforeEach(() => {
    getChatDb()
  })

  afterEach(() => {
    closeChatDb()
  })

  it('should create and list conversations for a pet', () => {
    const conversation = createConversation('hutao')
    expect(listConversations('hutao').map((c) => c.id)).toContain(
      conversation.id
    )
    expect(conversation.responseLanguage).toBe('zh-CN')
  })

  it('should create and update an isolated conversation response language', () => {
    const conversation = createConversation('hutao', undefined, 'en-US')
    expect(getConversationResponseLanguage(conversation.id)).toBe('en-US')

    const updated = updateConversationResponseLanguage(
      conversation.id,
      'ja-JP'
    )
    expect(updated?.responseLanguage).toBe('ja-JP')
    expect(getConversationResponseLanguage('missing')).toBeNull()
  })

  it('should keep response languages isolated between conversations', () => {
    const chinese = createConversation('hutao', '中文会话', 'zh-CN')
    const english = createConversation('hutao', 'English conversation', 'en-US')

    updateConversationResponseLanguage(chinese.id, 'ja-JP')

    const conversations = listConversations('hutao')
    expect(
      conversations.find((conversation) => conversation.id === chinese.id)
        ?.responseLanguage
    ).toBe('ja-JP')
    expect(
      conversations.find((conversation) => conversation.id === english.id)
        ?.responseLanguage
    ).toBe('en-US')
  })

  it('should migrate an old conversations table without touching messages', () => {
    closeChatDb()
    const dbPath = join(app.getPath('userData'), 'chat.db')
    rmSync(dbPath, { force: true })
    rmSync(`${dbPath}-wal`, { force: true })
    rmSync(`${dbPath}-shm`, { force: true })

    const oldDatabase = new DatabaseSync(dbPath)
    oldDatabase.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message_preview TEXT
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'complete',
        error_code TEXT
      );
      INSERT INTO conversations
        (id, pet_id, title, created_at, updated_at, last_message_preview)
      VALUES ('old-conversation', 'hutao', '旧会话', 1000, 1000, '旧消息');
      INSERT INTO messages
        (id, conversation_id, role, content, created_at, status, error_code)
      VALUES ('old-message', 'old-conversation', 'user', '旧消息', 1000, 'complete', NULL);
    `)
    oldDatabase.close()

    const migrated = listConversations('hutao')
    expect(migrated[0]).toMatchObject({
      id: 'old-conversation',
      responseLanguage: 'zh-CN'
    })
    expect(getConversationMessages('old-conversation')).toHaveLength(1)
  })

  it('should log and rethrow a failed language migration', () => {
    closeChatDb()
    const dbPath = join(app.getPath('userData'), 'chat.db')
    rmSync(dbPath, { force: true })
    const oldDatabase = new DatabaseSync(dbPath)
    oldDatabase.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_message_preview TEXT
      );
    `)
    oldDatabase.close()

    const originalExec = DatabaseSync.prototype.exec
    const execSpy = vi
      .spyOn(DatabaseSync.prototype, 'exec')
      .mockImplementation(function (this: DatabaseSync, sql: string): void {
        if (sql.includes('ALTER TABLE conversations')) {
          throw new Error('simulated migration failure')
        }
        originalExec.call(this, sql)
      })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => getChatDb()).toThrow('simulated migration failure')
    expect(errorSpy).toHaveBeenCalledWith(
      '[migration] 会话语言字段迁移失败，数据库保持可重试状态:',
      expect.any(Error)
    )

    execSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('should rename a conversation and clamp the title length', () => {
    const conversation = createConversation('hutao')
    const renamed = renameConversation(
      conversation.id,
      'x'.repeat(100)
    )
    expect(renamed?.title).toHaveLength(64)
  })

  it('should insert messages and update the conversation preview', () => {
    const conversation = createConversation('hutao')
    const message = insertMessage({
      conversationId: conversation.id,
      role: 'user',
      content: '你好，胡桃'
    })
    expect(message.status).toBe('complete')
    expect(getConversation(conversation.id)?.lastMessagePreview).toBe(
      '你好，胡桃'
    )
  })

  it('should update message content and status', () => {
    const conversation = createConversation('hutao')
    const message = insertMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: '',
      status: 'streaming'
    })
    const updated = updateMessage(message.id, {
      content: '完整回复',
      status: 'complete'
    })
    expect(updated).toMatchObject({ content: '完整回复', status: 'complete' })
  })

  it('should filter context messages to complete user/assistant rows', () => {
    const conversation = createConversation('hutao')
    insertMessage({
      conversationId: conversation.id,
      role: 'user',
      content: '问题',
      status: 'complete'
    })
    insertMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: '半截',
      status: 'streaming'
    })
    insertMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: '答案',
      status: 'complete'
    })
    const context = getRecentContextMessages(conversation.id, 20)
    expect(context.map((m) => m.content)).toEqual(['问题', '答案'])
  })

  it('should delete a conversation with its messages', () => {
    const conversation = createConversation('hutao')
    insertMessage({
      conversationId: conversation.id,
      role: 'user',
      content: '要删掉的'
    })
    expect(deleteConversation(conversation.id)).toBe(true)
    expect(getConversationMessages(conversation.id)).toEqual([])
  })

  it('should upsert persona profiles per pet', () => {
    const profile = updatePersonaProfile('hutao', {
      userCallName: '旅行者',
      relationship: '挚友',
      personalityBias: 'caring',
      tonePreference: 'gentle',
      extraNotes: ''
    })
    expect(profile).toMatchObject({
      petId: 'hutao',
      userCallName: '旅行者',
      relationship: '挚友',
      personalityBias: 'caring'
    })
    expect(getPersonaProfile('hutao')).toMatchObject({ userCallName: '旅行者' })
  })

  it('should return builtin persona when no profile row exists', () => {
    expect(getPersonaProfile('hutao').userCallName).toBe('旅行者')
  })
})

function getConversation(id: string) {
  // 轻量封装：仅用于断言会话预览
  const row = getChatDb()
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: String(row.id),
    lastMessagePreview:
      row.last_message_preview == null ? null : String(row.last_message_preview)
  }
}
