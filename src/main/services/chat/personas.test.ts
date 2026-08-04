import { describe, expect, it } from 'vitest'
import {
  getBuiltinPersona,
  mergePersonaProfile,
  sanitizePersonaFields
} from './personas'
import { buildSystemPrompt } from './prompt-builder'
import type { PetId } from '../../../shared/types'

describe('personas', () => {
  it('should return the builtin persona for hutao', () => {
    const persona = getBuiltinPersona('hutao')
    expect(persona.displayName).toBe('胡桃')
    expect(persona.coreIdentity).toContain('往生堂')
  })

  it('should throw for unregistered pets', () => {
    expect(() => getBuiltinPersona('nope' as PetId)).toThrow('未注册的角色')
  })

  it('should merge user overrides over builtin defaults', () => {
    const merged = mergePersonaProfile('hutao', { userCallName: '阿晴' }, 123)
    expect(merged).toMatchObject({ userCallName: '阿晴', petId: 'hutao' })
    expect(merged.updatedAt).toBe(123)
  })

  it('should sanitize persona fields with length and enum fallbacks', () => {
    const sanitized = sanitizePersonaFields({
      userCallName: 'x'.repeat(100),
      relationship: '',
      personalityBias: 'not-an-enum' as never,
      tonePreference: 'playful',
      extraNotes: 'y'.repeat(1000)
    })
    expect(sanitized.userCallName).toHaveLength(32)
    expect(sanitized.relationship).toBe('老朋友')
    expect(sanitized.personalityBias).toBe('mischievous')
    expect(sanitized.extraNotes).toHaveLength(500)
  })
})

describe('buildSystemPrompt', () => {
  it('should include role, call name and extra notes', () => {
    const prompt = buildSystemPrompt('hutao', {
      petId: 'hutao',
      userCallName: '旅行者',
      relationship: '老朋友',
      personalityBias: 'mischievous',
      tonePreference: 'playful',
      extraNotes: '喜欢听睡前故事',
      updatedAt: 0
    })
    expect(prompt).toContain('称呼用户为「旅行者」')
    expect(prompt).toContain('【额外偏好】喜欢听睡前故事')
  })

  it('should omit the extra notes section when empty', () => {
    const prompt = buildSystemPrompt('hutao', {
      petId: 'hutao',
      userCallName: '旅行者',
      relationship: '老朋友',
      personalityBias: 'mischievous',
      tonePreference: 'playful',
      extraNotes: '',
      updatedAt: 0
    })
    expect(prompt).not.toContain('【额外偏好】')
  })
})
