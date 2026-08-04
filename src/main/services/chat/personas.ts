import type {
  ChatPersonalityBias,
  ChatTonePreference,
  PersonaProfile,
  PersonaProfileFields,
  PetId
} from '../../../shared/types'
import { PET_LABELS } from '../../../shared/types'

export interface BuiltinPersona {
  petId: PetId
  displayName: string
  coreIdentity: string
  speechStyle: string
  defaultFields: PersonaProfileFields
}

const DEFAULT_FIELDS: PersonaProfileFields = {
  userCallName: '旅行者',
  relationship: '老朋友',
  personalityBias: 'mischievous',
  tonePreference: 'playful',
  extraNotes: ''
}

export const BUILTIN_PERSONAS: Record<PetId, BuiltinPersona> = {
  hutao: {
    petId: 'hutao',
    displayName: PET_LABELS.hutao,
    coreIdentity:
      '你是胡桃，璃月往生堂第七十七任堂主。你自称「本堂主」，性格古灵精怪、爱开玩笑，常把生死挂在嘴边却并不让人害怕。你最讨厌别人把往生堂和「晦气」联系在一起，会认真纠正。你和旅行者（用户）关系很好，喜欢突然出现在他身边。',
    speechStyle:
      '语气俏皮跳脱，自称「本堂主」或「胡桃」。常用「哎嘿」「嘿嘿」「哎呀呀」等语气词。喜欢用顺口溜打趣。偶尔用 *叉着腰* / *凑近了看* 这样的动作描写。',
    defaultFields: { ...DEFAULT_FIELDS }
  }
}

export const PERSONALITY_LABELS: Record<ChatPersonalityBias, string> = {
  caring: '体贴温柔',
  mischievous: '古灵精怪',
  shy: '害羞内敛',
  confident: '自信开朗',
  sleepy: '软软困困'
}

export const TONE_LABELS: Record<ChatTonePreference, string> = {
  gentle: '温柔',
  energetic: '元气',
  tsundere: '傲娇',
  soft: '软糯',
  playful: '俏皮'
}

export function getBuiltinPersona(petId: PetId): BuiltinPersona {
  const persona = BUILTIN_PERSONAS[petId]
  if (!persona) {
    throw new Error(`未注册的角色: ${petId}`)
  }
  return persona
}

export function mergePersonaProfile(
  petId: PetId,
  overrides: Partial<PersonaProfileFields> | null | undefined,
  updatedAt = 0
): PersonaProfile {
  const builtin = getBuiltinPersona(petId)
  return {
    petId,
    ...builtin.defaultFields,
    ...(overrides ?? {}),
    updatedAt
  }
}

export function sanitizePersonaFields(
  fields: Partial<PersonaProfileFields>
): PersonaProfileFields {
  const clamp = (value: unknown, max: number, fallback: string): string => {
    if (typeof value !== 'string') return fallback
    const trimmed = value.trim()
    return trimmed ? trimmed.slice(0, max) : fallback
  }

  const personality = fields.personalityBias
  const tone = fields.tonePreference

  return {
    userCallName: clamp(fields.userCallName, 32, DEFAULT_FIELDS.userCallName),
    relationship: clamp(fields.relationship, 64, DEFAULT_FIELDS.relationship),
    personalityBias:
      personality && personality in PERSONALITY_LABELS
        ? personality
        : DEFAULT_FIELDS.personalityBias,
    tonePreference:
      tone && tone in TONE_LABELS ? tone : DEFAULT_FIELDS.tonePreference,
    extraNotes: clamp(fields.extraNotes, 500, '')
  }
}
