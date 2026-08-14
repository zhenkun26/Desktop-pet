import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  ChatStreamEvent,
  ChatLanguage,
  DesktopPetApi,
  ModelProfileInput,
  ProviderConnectionInput,
  SetCredentialInput,
  OpenChatOptions,
  PetBusinessEvent,
  PetConfig,
  PetDescriptor,
  PetId,
  PomodoroDoneEvent,
  PomodoroTickEvent,
  RestReminderEvent,
  SendChatMessageInput,
  TimerConfig,
  UpdatePersonaInput
} from '../shared/types'

/** 订阅主进程事件，返回取消订阅函数 */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => {
    cb(payload)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: DesktopPetApi = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getDefaultResponseLanguage: () =>
    ipcRenderer.invoke('get-default-response-language'),
  setDefaultResponseLanguage: (language: ChatLanguage) =>
    ipcRenderer.invoke('set-default-response-language', language),
  setDefaultModelProfile: (modelProfileId: string | null) =>
    ipcRenderer.invoke('set-default-model-profile', modelProfileId),
  listPets: () => ipcRenderer.invoke('list-pets'),
  getPet: (petId: PetId) => ipcRenderer.invoke('get-pet', petId),
  setAlwaysOnTop: (value: boolean) =>
    ipcRenderer.invoke('set-always-on-top', value),
  moveWindow: (dx: number, dy: number) =>
    ipcRenderer.invoke('move-window', dx, dy),
  savePosition: () => ipcRenderer.invoke('save-position'),
  showContextMenu: () => ipcRenderer.invoke('show-context-menu'),
  openChat: (options?: OpenChatOptions) =>
    ipcRenderer.invoke('open-chat', options),
  getChatOpenOptions: () => ipcRenderer.invoke('get-chat-open-options'),
  showPet: () => ipcRenderer.invoke('show-pet'),
  hidePet: () => ipcRenderer.invoke('hide-pet'),
  toggleVisible: () => ipcRenderer.invoke('toggle-visible'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('set-api-key', apiKey),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  testApiKey: (apiKey?: string) => ipcRenderer.invoke('test-api-key', apiKey),
  getProviderConfig: () => ipcRenderer.invoke('get-provider-config'),
  saveProviderConnection: (input: ProviderConnectionInput) =>
    ipcRenderer.invoke('save-provider-connection', input),
  deleteProviderConnection: (connectionId: string) =>
    ipcRenderer.invoke('delete-provider-connection', connectionId),
  saveModelProfile: (input: ModelProfileInput) =>
    ipcRenderer.invoke('save-model-profile', input),
  deleteModelProfile: (modelProfileId: string) =>
    ipcRenderer.invoke('delete-model-profile', modelProfileId),
  getCredentialStatuses: () => ipcRenderer.invoke('get-credential-statuses'),
  setCredential: (input: SetCredentialInput) =>
    ipcRenderer.invoke('set-credential', input),
  clearCredential: (credentialId: string) =>
    ipcRenderer.invoke('clear-credential', credentialId),
  testCredential: (credentialId: string, modelProfileId?: string) =>
    ipcRenderer.invoke('test-credential', credentialId, modelProfileId),
  confirmProviderPrivacy: (connectionId: string) =>
    ipcRenderer.invoke('confirm-provider-privacy', connectionId),

  getPersonaProfile: (petId: PetId) =>
    ipcRenderer.invoke('get-persona-profile', petId),
  updatePersonaProfile: (input: UpdatePersonaInput) =>
    ipcRenderer.invoke('update-persona-profile', input),

  listConversations: (petId: PetId) =>
    ipcRenderer.invoke('list-conversations', petId),
  createConversation: (petId: PetId, title?: string) =>
    ipcRenderer.invoke('create-conversation', petId, title),
  getConversationResponseLanguage: (conversationId: string) =>
    ipcRenderer.invoke('get-conversation-response-language', conversationId),
  setConversationResponseLanguage: (
    conversationId: string,
    language: ChatLanguage
  ) =>
    ipcRenderer.invoke(
      'set-conversation-response-language',
      conversationId,
      language
    ),
  getConversationModelProfile: (conversationId: string) =>
    ipcRenderer.invoke('get-conversation-model-profile', conversationId),
  setConversationModelProfile: (
    conversationId: string,
    modelProfileId: string | null
  ) =>
    ipcRenderer.invoke(
      'set-conversation-model-profile',
      conversationId,
      modelProfileId
    ),
  renameConversation: (conversationId: string, title: string) =>
    ipcRenderer.invoke('rename-conversation', conversationId, title),
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('delete-conversation', conversationId),
  getConversationMessages: (conversationId: string) =>
    ipcRenderer.invoke('get-conversation-messages', conversationId),
  sendChatMessage: (input: SendChatMessageInput) =>
    ipcRenderer.invoke('send-chat-message', input),
  stopChatGeneration: (conversationId?: string) =>
    ipcRenderer.invoke('stop-chat-generation', conversationId),

  getTimerStatus: () => ipcRenderer.invoke('get-timer-status'),
  updateTimerConfig: (config: TimerConfig) =>
    ipcRenderer.invoke('update-timer-config', config),
  startPomodoro: () => ipcRenderer.invoke('start-pomodoro'),
  stopPomodoro: () => ipcRenderer.invoke('stop-pomodoro'),
  resetRestTimer: () => ipcRenderer.invoke('reset-rest-timer'),

  onConfigChanged: (cb) => subscribe<PetConfig>('config-changed', cb),
  onBusinessEvent: (cb) => subscribe<PetBusinessEvent>('business-event', cb),
  onChatStream: (cb) => subscribe<ChatStreamEvent>('chat-stream', cb),
  onChatOpenOptions: (cb) =>
    subscribe<OpenChatOptions>('chat-open-options', cb),
  onRestReminder: (cb) => subscribe<RestReminderEvent>('rest-reminder', cb),
  onPomodoroTick: (cb) => subscribe<PomodoroTickEvent>('pomodoro-tick', cb),
  onPomodoroDone: (cb) => subscribe<PomodoroDoneEvent>('pomodoro-done', cb)
}

contextBridge.exposeInMainWorld('desktopPet', api)
