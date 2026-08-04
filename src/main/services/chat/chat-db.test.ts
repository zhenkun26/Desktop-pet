import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeChatDb,
  createConversation,
  deleteConversation,
  getChatDb,
  getConversationMessages,
  getPersonaProfile,
  getRecentContextMessages,
  insertMessage,
  listConversations,
  renameConversation,
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
