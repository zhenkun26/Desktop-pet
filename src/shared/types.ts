/** 单角色：胡桃 */
export type PetId = 'hutao'

export const PET_IDS: PetId[] = ['hutao']

export const PET_LABELS: Record<PetId, string> = {
  hutao: '胡桃'
}

/** 会话回复语言；界面和主进程只允许使用这三个值。 */
export type ChatLanguage = 'zh-CN' | 'en-US' | 'ja-JP'

export const CHAT_LANGUAGES: ChatLanguage[] = ['zh-CN', 'en-US', 'ja-JP']

export const CHAT_LANGUAGE_LABELS: Record<ChatLanguage, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
  'ja-JP': '日本語'
}

export const DEFAULT_CHAT_LANGUAGE: ChatLanguage = 'zh-CN'

/** 将未知输入规范化为受支持的会话回复语言。 */
export function normalizeChatLanguage(value: unknown): ChatLanguage {
  return typeof value === 'string' && CHAT_LANGUAGES.includes(value as ChatLanguage)
    ? (value as ChatLanguage)
    : DEFAULT_CHAT_LANGUAGE
}

/** 宠物动画/业务状态 */
export type PetVisualState = 'idle' | 'drag' | 'click' | 'busy'

/** 持久化配置 */
export interface PetConfig {
  petId: PetId
  alwaysOnTop: boolean
  windowX: number | null
  windowY: number | null
  visible: boolean
  defaultResponseLanguage: ChatLanguage
  defaultModelProfileId?: string | null
}

export const DEFAULT_CONFIG: PetConfig = {
  petId: 'hutao',
  alwaysOnTop: true,
  windowX: null,
  windowY: null,
  visible: true,
  defaultResponseLanguage: DEFAULT_CHAT_LANGUAGE,
  defaultModelProfileId: 'deepseek-default'
}

/** 主进程 → 桌宠窗口的业务事件 */
export type PetBusinessEvent =
  | { type: 'busy' }
  | { type: 'idle' }
  | { type: 'message'; message: string; persistent?: boolean }

/** —— AI 角色对话 —— */

export type ChatMessageRole = 'user' | 'assistant' | 'system'

export type ChatTonePreference =
  | 'gentle'
  | 'energetic'
  | 'tsundere'
  | 'soft'
  | 'playful'

export type ChatPersonalityBias =
  | 'caring'
  | 'mischievous'
  | 'shy'
  | 'confident'
  | 'sleepy'

export interface PersonaProfileFields {
  userCallName: string
  relationship: string
  personalityBias: ChatPersonalityBias
  tonePreference: ChatTonePreference
  extraNotes: string
}

export interface PersonaProfile extends PersonaProfileFields {
  petId: PetId
  updatedAt: number
}

export interface ConversationRecord {
  id: string
  petId: PetId
  title: string
  createdAt: number
  updatedAt: number
  lastMessagePreview: string | null
  responseLanguage: ChatLanguage
  modelProfileId?: string | null
}

export interface ChatMessageRecord {
  id: string
  conversationId: string
  role: ChatMessageRole
  content: string
  createdAt: number
  status: 'complete' | 'streaming' | 'error' | 'cancelled'
  errorCode?: ChatErrorCode | null
  modelProfileId?: string | null
  providerConnectionId?: string | null
  providerName?: string | null
  modelId?: string | null
  modelName?: string | null
}

export type ChatErrorCode =
  | 'missing_api_key'
  | 'missing_credential'
  | 'invalid_api_key'
  | 'invalid_credential'
  | 'model_not_supported'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'content_filter'
  | 'insufficient_resource'
  | 'aborted'
  | 'unknown'

export interface ApiKeyStatus {
  configured: boolean
  masked: string | null
  encryptionAvailable: boolean
}

/** 供应商协议类型。首期支持 OpenAI-compatible 文本聊天协议。 */
export type ProviderType = 'openai-compatible'

export const PROVIDER_TYPES: ProviderType[] = ['openai-compatible']

export interface CredentialStatus {
  id: string
  configured: boolean
  masked: string | null
  encryptionAvailable: boolean
  lastTestedAt: number | null
}

export interface ProviderConnection {
  id: string
  providerType: ProviderType
  displayName: string
  baseUrl: string
  credentialId: string
  enabled: boolean
  allowLocalhost: boolean
  privacyConfirmed: boolean
  updatedAt: number
}

export interface ModelCapabilities {
  streaming: boolean
  text: boolean
}

export interface ModelProfile {
  id: string
  connectionId: string
  modelId: string
  displayName: string
  enabled: boolean
  capabilities: ModelCapabilities
  updatedAt: number
}

export interface ProviderConfigSnapshot {
  modelProfileId: string
  providerConnectionId: string
  providerType: ProviderType
  providerName: string
  baseUrl: string
  modelId: string
  modelName: string
  credentialId: string
}

export interface ProviderConfig {
  connections: ProviderConnection[]
  models: ModelProfile[]
}

export interface ProviderConnectionInput {
  id?: string
  providerType: ProviderType
  displayName: string
  baseUrl: string
  credentialId?: string
  enabled?: boolean
  allowLocalhost?: boolean
}

export interface ModelProfileInput {
  id?: string
  connectionId: string
  modelId: string
  displayName: string
  enabled?: boolean
  capabilities?: Partial<ModelCapabilities>
}

export interface SetCredentialInput {
  credentialId: string
  apiKey: string
}

/**
 * 流式事件契约（v2）：
 * - assistant 消息在 start 时已落库，事件均携带 assistantMessageId 供渲染层关联
 * - sendChatMessage 的 invoke 在生成终结后才返回，完成信号不依赖本事件通道
 */
export type ChatStreamEvent =
  | {
      type: 'start'
      conversationId: string
      userMessageId: string
      assistantMessageId: string
    }
  | {
      type: 'delta'
      conversationId: string
      assistantMessageId: string
      delta: string
    }
  | {
      type: 'done'
      conversationId: string
      assistantMessageId: string
      content: string
    }
  | {
      type: 'error'
      conversationId: string
      assistantMessageId: string
      code: ChatErrorCode
      message: string
    }
  | {
      type: 'cancelled'
      conversationId: string
      assistantMessageId: string
    }

export interface OpenChatOptions {
  petId?: PetId
  view?: 'chat' | 'persona' | 'settings' | 'timer'
  conversationId?: string
}

/** 宠物时段问候文案（按一天时间段分组）。 */
export interface PetGreetings {
  morning: string[]
  afternoon: string[]
  evening: string[]
  night: string[]
}

/** 宠物注册表条目（经 IPC 序列化给渲染层）。 */
export interface PetDescriptor {
  petId: PetId
  displayName: string
  assetFileName: string
  coreIdentity: string
  speechStyle: string
  greetings: PetGreetings
}

export interface SendChatMessageInput {
  conversationId: string
  content: string
}

export interface ProviderChatMessage {
  role: ChatMessageRole
  content: string
}

export interface ProviderChatRequest {
  snapshot: ProviderConfigSnapshot
  messages: ProviderChatMessage[]
  signal?: AbortSignal
  onDelta?: (delta: string) => void
}

export type ProviderStreamEvent =
  | { type: 'delta'; delta: string }
  | { type: 'done'; content: string }
  | { type: 'error'; code: ChatErrorCode; message: string }
  | { type: 'cancelled' }

export interface UpdatePersonaInput {
  petId: PetId
  fields: PersonaProfileFields
}

/** —— 休息提醒 & 番茄钟 —— */

export interface TimerConfig {
  restIntervalSecs: number
  workSecs: number
  breakSecs: number
}

export type PomodoroPhase = 'idle' | 'working' | 'break'

export interface TimerStatus {
  activeSecs: number
  restIntervalSecs: number
  pomodoroActive: boolean
  pomodoroPhase: PomodoroPhase
  pomodoroElapsed: number
  pomodoroTotal: number
  config: TimerConfig
}

export interface RestReminderEvent {
  activeMinutes: number
}

export interface PomodoroTickEvent {
  phase: PomodoroPhase
  elapsed: number
  total: number
}

export interface PomodoroDoneEvent {
  phase: 'working' | 'break'
  nextPhase: 'working' | 'break'
  message: string
}

/** preload 暴露给渲染进程的 API */
export interface DesktopPetApi {
  getConfig: () => Promise<PetConfig>
  getDefaultResponseLanguage: () => Promise<ChatLanguage>
  setDefaultResponseLanguage: (language: ChatLanguage) => Promise<PetConfig>
  listPets: () => Promise<PetDescriptor[]>
  getPet: (petId: PetId) => Promise<PetDescriptor>
  setAlwaysOnTop: (value: boolean) => Promise<PetConfig>
  moveWindow: (dx: number, dy: number) => Promise<void>
  savePosition: () => Promise<void>
  showContextMenu: () => Promise<void>
  openChat: (options?: OpenChatOptions) => Promise<void>
  getChatOpenOptions: () => Promise<OpenChatOptions | null>
  showPet: () => Promise<void>
  hidePet: () => Promise<void>
  toggleVisible: () => Promise<void>
  quitApp: () => Promise<void>
  getApiKeyStatus: () => Promise<ApiKeyStatus>
  setApiKey: (apiKey: string) => Promise<ApiKeyStatus>
  clearApiKey: () => Promise<ApiKeyStatus>
  testApiKey: (apiKey?: string) => Promise<{ ok: boolean; message: string }>
  getProviderConfig: () => Promise<ProviderConfig>
  saveProviderConnection: (
    input: ProviderConnectionInput
  ) => Promise<ProviderConnection>
  deleteProviderConnection: (connectionId: string) => Promise<{ ok: boolean }>
  saveModelProfile: (input: ModelProfileInput) => Promise<ModelProfile>
  deleteModelProfile: (modelProfileId: string) => Promise<{ ok: boolean }>
  setDefaultModelProfile: (modelProfileId: string | null) => Promise<PetConfig>
  getCredentialStatuses: () => Promise<CredentialStatus[]>
  setCredential: (input: SetCredentialInput) => Promise<CredentialStatus>
  clearCredential: (credentialId: string) => Promise<CredentialStatus>
  testCredential: (
    credentialId: string,
    modelProfileId?: string
  ) => Promise<{ ok: boolean; message: string }>
  confirmProviderPrivacy: (connectionId: string) => Promise<ProviderConnection>
  getPersonaProfile: (petId: PetId) => Promise<PersonaProfile>
  updatePersonaProfile: (input: UpdatePersonaInput) => Promise<PersonaProfile>
  listConversations: (petId: PetId) => Promise<ConversationRecord[]>
  createConversation: (
    petId: PetId,
    title?: string
  ) => Promise<ConversationRecord>
  getConversationResponseLanguage: (
    conversationId: string
  ) => Promise<ChatLanguage | null>
  setConversationResponseLanguage: (
    conversationId: string,
    language: ChatLanguage
  ) => Promise<ConversationRecord | null>
  getConversationModelProfile: (
    conversationId: string
  ) => Promise<string | null>
  setConversationModelProfile: (
    conversationId: string,
    modelProfileId: string | null
  ) => Promise<ConversationRecord | null>
  renameConversation: (
    conversationId: string,
    title: string
  ) => Promise<ConversationRecord | null>
  deleteConversation: (conversationId: string) => Promise<{ ok: boolean }>
  getConversationMessages: (
    conversationId: string
  ) => Promise<ChatMessageRecord[]>
  sendChatMessage: (input: SendChatMessageInput) => Promise<{
    ok: boolean
    error?: string
    code?: ChatErrorCode
  }>
  stopChatGeneration: (conversationId?: string) => Promise<{ ok: boolean }>
  getTimerStatus: () => Promise<TimerStatus>
  updateTimerConfig: (config: TimerConfig) => Promise<void>
  startPomodoro: () => Promise<void>
  stopPomodoro: () => Promise<void>
  resetRestTimer: () => Promise<void>
  onConfigChanged: (cb: (config: PetConfig) => void) => () => void
  onBusinessEvent: (cb: (event: PetBusinessEvent) => void) => () => void
  onChatStream: (cb: (event: ChatStreamEvent) => void) => () => void
  onChatOpenOptions: (cb: (options: OpenChatOptions) => void) => () => void
  onRestReminder: (cb: (event: RestReminderEvent) => void) => () => void
  onPomodoroTick: (cb: (event: PomodoroTickEvent) => void) => () => void
  onPomodoroDone: (cb: (event: PomodoroDoneEvent) => void) => () => void
}

declare global {
  interface Window {
    desktopPet: DesktopPetApi
  }
}
