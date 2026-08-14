import { describe, expect, it, vi } from 'vitest'
import type { ConversationRecord, PetConfig } from '../shared/types'
import { updateCurrentLanguage, updateDefaultLanguage } from './language-settings'

const config: PetConfig = {
  petId: 'hutao',
  alwaysOnTop: true,
  windowX: null,
  windowY: null,
  visible: true,
  defaultResponseLanguage: 'zh-CN'
}

const conversation: ConversationRecord = {
  id: 'conversation-1',
  petId: 'hutao',
  title: '测试',
  createdAt: 1,
  updatedAt: 1,
  lastMessagePreview: null,
  responseLanguage: 'ja-JP'
}

describe('language settings boundaries', () => {
  it('should update only the default language through the default control', async () => {
    const api = {
      setDefaultResponseLanguage: vi.fn().mockResolvedValue({
        ...config,
        defaultResponseLanguage: 'en-US'
      }),
      setConversationResponseLanguage: vi.fn()
    }

    await expect(updateDefaultLanguage(api, 'en-US')).resolves.toMatchObject({
      defaultResponseLanguage: 'en-US'
    })
    expect(api.setDefaultResponseLanguage).toHaveBeenCalledWith('en-US')
    expect(api.setConversationResponseLanguage).not.toHaveBeenCalled()
  })

  it('should update the current conversation without reloading messages', async () => {
    const api = {
      setDefaultResponseLanguage: vi.fn(),
      setConversationResponseLanguage: vi
        .fn()
        .mockResolvedValue(conversation)
    }

    await expect(
      updateCurrentLanguage(api, conversation.id, 'ja-JP')
    ).resolves.toEqual(conversation)
    expect(api.setConversationResponseLanguage).toHaveBeenCalledWith(
      conversation.id,
      'ja-JP'
    )
    expect(api.setDefaultResponseLanguage).not.toHaveBeenCalled()
  })

  it('should update the default when no conversation is active', async () => {
    const api = {
      setDefaultResponseLanguage: vi.fn().mockResolvedValue(config),
      setConversationResponseLanguage: vi.fn()
    }

    await expect(updateCurrentLanguage(api, null, 'en-US')).resolves.toBeNull()
    expect(api.setDefaultResponseLanguage).toHaveBeenCalledWith('en-US')
    expect(api.setConversationResponseLanguage).not.toHaveBeenCalled()
  })
})
