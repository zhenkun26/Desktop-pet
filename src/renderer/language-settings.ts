import type {
  ChatLanguage,
  ConversationRecord,
  PetConfig
} from '../shared/types'

/** 设置页执行语言更新所需的最小 IPC 契约。 */
export interface LanguageSettingsApi {
  setDefaultResponseLanguage: (language: ChatLanguage) => Promise<PetConfig>
  setConversationResponseLanguage: (
    conversationId: string,
    language: ChatLanguage
  ) => Promise<ConversationRecord | null>
}

/** 更新新会话默认语言；不会隐式修改当前会话。 */
export function updateDefaultLanguage(
  api: LanguageSettingsApi,
  language: ChatLanguage
): Promise<PetConfig> {
  return api.setDefaultResponseLanguage(language)
}

/** 有当前会话时更新会话，否则按设置页边界更新默认语言。 */
export async function updateCurrentLanguage(
  api: LanguageSettingsApi,
  conversationId: string | null,
  language: ChatLanguage
): Promise<ConversationRecord | null> {
  if (!conversationId) {
    await api.setDefaultResponseLanguage(language)
    return null
  }
  return api.setConversationResponseLanguage(conversationId, language)
}
