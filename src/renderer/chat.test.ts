import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { providerConsentKey, resolveModelProfileId, resolveProviderSnapshot } from '../shared/model-routing'
import type { ChatMessageRecord, ChatStreamEvent, ConversationRecord, ProviderConfig } from '../shared/types'

// Execute the actual handlers with controlled UI/IPC ports; no DOM package or Electron launch.
const source = ts.createSourceFile('chat.ts', readFileSync(new URL('./chat.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true)
const handlerNames = [
  'selectedModelProfileId', 'renderModelSelector', 'prepareMessage', 'sendMessage',
  'finalizeStream', 'handleStreamEvent', 'handleModelSelection', 'ensureProviderPrivacy'
]
const handlerSource = source.statements.filter((statement) =>
  ts.isFunctionDeclaration(statement) && handlerNames.includes(statement.name?.text ?? '')
).map((statement) => statement.getText(source)).join('\n')
const executable = ts.transpileModule(handlerSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

function deferred<Result>() {
  let resolve!: (result: Result) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Result>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise; reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createHarness() {
  const providerConfig: ProviderConfig = {
    connections: ['deepseek-default', 'provider-b'].map((id) => ({
      id, providerType: 'openai-compatible', displayName: id, baseUrl: `https://${id}.example.test`,
      credentialId: id, enabled: true, allowLocalhost: false, privacyConfirmed: true, updatedAt: 1
    })),
    models: ['deepseek-default', 'provider-b'].map((id) => ({
      id, connectionId: id, modelId: `${id}-model`, displayName: id, enabled: true,
      capabilities: { text: true, streaming: true }, updatedAt: 1
    }))
  }
  const state = {
    currentConversationId: 'conversation-one',
    conversations: [{ id: 'conversation-one', modelProfileId: null }] as ConversationRecord[],
    config: { defaultModelProfileId: 'provider-b' }, providerConfig,
    messages: [] as ChatMessageRecord[], streaming: false, streamingConvId: null as string | null,
    activeRequestId: null as string | null, streamingContent: '', finalized: true,
    preparing: false, modelSelectionPending: false
  }
  const input = { value: 'Question', style: { height: 'auto' } }
  const select = { value: 'deepseek-default', innerHTML: '', disabled: false }
  const status = { textContent: '' }
  const button = { disabled: false }
  const ui = {
    renderMessages: vi.fn(), showThinkingBubble: vi.fn(), setStreamingUI: vi.fn(),
    clearThinkingTimers: vi.fn(), cancelStreamRender: vi.fn(), clearStreamContainer: vi.fn(),
    refreshConversations: vi.fn().mockResolvedValue(undefined), showChatError: vi.fn(),
    scheduleStreamRender: vi.fn(), renderConversationList: vi.fn(),
    loadProviderConfig: vi.fn().mockResolvedValue(undefined)
  }
  const api = {
    sendChatMessage: vi.fn().mockResolvedValue({ ok: true }),
    stopChatGeneration: vi.fn().mockResolvedValue({ ok: true }),
    getConversationMessages: vi.fn().mockResolvedValue([]),
    setConversationModelProfile: vi.fn().mockResolvedValue({ id: 'conversation-one', modelProfileId: 'provider-b' }),
    setDefaultModelProfile: vi.fn().mockResolvedValue({ defaultModelProfileId: 'provider-b' }),
    confirmProviderPrivacy: vi.fn().mockResolvedValue(undefined)
  }
  let requestSequence = 0
  const confirm = vi.fn().mockReturnValue(true)
  const sandbox = {
    ...ui, state, window: { desktopPet: api, confirm },
    $: (id: string) => ({ 'message-input': input, 'model-select': select, 'model-picker-status': status, 'send-btn': button })[id],
    console: { error: vi.fn() }, crypto: { randomUUID: () => `request-${++requestSequence}` },
    availableModels: () => providerConfig.models.filter((model) => model.enabled),
    modelLabel: (model: { displayName: string }) => model.displayName,
    escapeHtml: (text: string) => text,
    resolveModelProfileId, resolveProviderSnapshot, providerConsentKey,
    createNewConversation: vi.fn().mockResolvedValue(undefined)
  }
  const handlers = runInNewContext(`${executable}; ({ ${handlerNames.join(', ')} })`, sandbox) as {
    selectedModelProfileId: () => string | null
    renderModelSelector: () => void
    sendMessage: () => Promise<void>
    finalizeStream: (conversationId: string, requestId: string, error?: string) => Promise<void>
    handleStreamEvent: (event: ChatStreamEvent) => void
    handleModelSelection: () => Promise<void>
    ensureProviderPrivacy: (modelId: string) => Promise<boolean>
  }
  return { handlers, state, input, select, status, button, ui, api, confirm, sandbox }
}

describe('chat renderer routing', () => {
  it('should display the actual legacy model despite a different global default', () => {
    const { handlers, select } = createHarness()
    handlers.renderModelSelector()
    expect(select.value).toBe('deepseek-default')
  })

  it('should use the global default only before a conversation exists', () => {
    const { handlers, state, select } = createHarness()
    state.currentConversationId = ''
    handlers.renderModelSelector()
    expect(select.value).toBe('provider-b')
  })

  it.each(['removed', 'disabled'])('should show unavailable instead of silently replacing a %s model', (reason) => {
    const { handlers, state, select, status } = createHarness()
    if (reason === 'removed') state.conversations[0].modelProfileId = 'missing'
    else state.providerConfig.models[0].enabled = false
    handlers.renderModelSelector()
    expect(select.value).toBe('')
    expect(status.textContent).toContain('unavailable')
    expect(select.innerHTML).toContain('provider-b')
  })

  it('should send the route displayed for the current conversation', async () => {
    const { handlers, api } = createHarness()
    await handlers.sendMessage()
    expect(api.sendChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      expectedRoute: expect.objectContaining({ modelProfileId: 'deepseek-default', providerConnectionId: 'deepseek-default' })
    }))
  })

  it('should block sends during model persistence and use the saved model afterwards', async () => {
    const { handlers, api, select, state } = createHarness()
    const selection = deferred<ConversationRecord>()
    api.setConversationModelProfile.mockReturnValue(selection.promise)
    select.value = 'provider-b'
    const saving = handlers.handleModelSelection()
    await handlers.sendMessage()
    expect(api.sendChatMessage).not.toHaveBeenCalled()
    selection.resolve({ ...state.conversations[0], modelProfileId: 'provider-b' })
    await saving
    await handlers.sendMessage()
    expect(api.sendChatMessage.mock.calls[0][0].expectedRoute.modelProfileId).toBe('provider-b')
  })

  it('should restore the actual model after selection persistence fails', async () => {
    const { handlers, api, select, state, ui } = createHarness()
    select.value = 'provider-b'
    api.setConversationModelProfile.mockRejectedValue(new Error('Synthetic persistence failure'))
    await handlers.handleModelSelection()
    expect(select.value).toBe('deepseek-default')
    expect(state.modelSelectionPending).toBe(false)
    expect(ui.showChatError).toHaveBeenCalled()
  })

  it('should confirm the displayed endpoint identity and preserve input when consent fails', async () => {
    const { handlers, api, state, input, confirm } = createHarness()
    const connection = state.providerConfig.connections[0]
    connection.privacyConfirmed = false
    api.confirmProviderPrivacy.mockRejectedValue(new Error('Destination changed'))
    await handlers.sendMessage()
    expect(confirm.mock.calls[0][0]).toContain(connection.baseUrl)
    expect(api.confirmProviderPrivacy).toHaveBeenCalledWith(connection.id, providerConsentKey(connection))
    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(input.value).toBe('Question')
    expect(state.preparing).toBe(false)
  })

  it('should not send when the user declines consent', async () => {
    const { handlers, api, state, confirm } = createHarness()
    state.providerConfig.connections[0].privacyConfirmed = false
    confirm.mockReturnValue(false)
    await handlers.sendMessage()
    expect(api.confirmProviderPrivacy).not.toHaveBeenCalled()
    expect(api.sendChatMessage).not.toHaveBeenCalled()
  })
})

describe('chat renderer lifecycle', () => {
  it('should stop generation with an empty input', async () => {
    const { handlers, state, input, api } = createHarness()
    state.streaming = true; state.finalized = false; state.streamingConvId = 'conversation-one'
    input.value = ''
    await handlers.sendMessage()
    expect(api.stopChatGeneration).toHaveBeenCalledWith('conversation-one')
    expect(api.sendChatMessage).not.toHaveBeenCalled()
  })

  it('should reject empty input when no request is active', async () => {
    const { handlers, input, api } = createHarness()
    input.value = '  '
    await handlers.sendMessage()
    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(api.stopChatGeneration).not.toHaveBeenCalled()
  })

  it.each([true, false])('should recover from missing terminal events when invoke returns ok=%s', async (ok) => {
    const { handlers, state, api, ui } = createHarness()
    api.sendChatMessage.mockResolvedValue({ ok, error: ok ? undefined : 'Synthetic failure' })
    await handlers.sendMessage()
    expect(api.getConversationMessages).toHaveBeenCalledTimes(1)
    expect(state.streaming).toBe(false)
    expect(state.activeRequestId).toBeNull()
    expect(ui.setStreamingUI).toHaveBeenLastCalledWith(false)
  })

  it('should restore controls when invoke or history loading rejects', async () => {
    const { handlers, state, api, ui } = createHarness()
    api.sendChatMessage.mockRejectedValue(new Error('IPC failure'))
    api.getConversationMessages.mockRejectedValue(new Error('History failure'))
    await handlers.sendMessage()
    expect(state.streaming).toBe(false)
    expect(ui.showChatError).toHaveBeenCalled()
    expect(ui.setStreamingUI).toHaveBeenLastCalledWith(false)
  })

  it('should ignore old events and old invoke completion after a new request starts', async () => {
    const { handlers, state, api, input } = createHarness()
    const first = deferred<{ ok: boolean }>(); const second = deferred<{ ok: boolean }>()
    api.sendChatMessage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const firstSend = handlers.sendMessage()
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1))
    handlers.handleStreamEvent({ type: 'done', conversationId: 'conversation-one', requestId: 'request-1', assistantMessageId: 'assistant-one', content: 'First reply' })
    await vi.waitFor(() => expect(state.streaming).toBe(false))
    input.value = 'Second question'
    const secondSend = handlers.sendMessage()
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2))
    const late = { conversationId: 'conversation-one', requestId: 'request-1', assistantMessageId: 'assistant-one' }
    handlers.handleStreamEvent({ ...late, type: 'start', userMessageId: 'user-one' })
    handlers.handleStreamEvent({ ...late, type: 'delta', delta: 'Stale text' })
    handlers.handleStreamEvent({ ...late, type: 'cancelled' })
    first.resolve({ ok: true }); await firstSend
    expect(state.activeRequestId).toBe('request-2')
    expect(state.streaming).toBe(true)
    expect(state.streamingContent).toBe('')
    second.resolve({ ok: true }); await secondSend
    expect(api.getConversationMessages).toHaveBeenCalledTimes(2)
  })

  it('should not replace another conversation with a delayed completion history read', async () => {
    const { handlers, state, api, ui } = createHarness()
    const history = deferred<ChatMessageRecord[]>()
    api.getConversationMessages.mockReturnValue(history.promise)
    const sending = handlers.sendMessage()
    await vi.waitFor(() => expect(api.getConversationMessages).toHaveBeenCalledTimes(1))
    state.currentConversationId = 'conversation-two'
    const otherMessages = [] as ChatMessageRecord[]
    state.messages = otherMessages
    history.resolve([{ id: 'old-history' } as ChatMessageRecord])
    await sending
    expect(state.messages).toBe(otherMessages)
    expect(ui.renderMessages).toHaveBeenCalledTimes(1)
    expect(state.streaming).toBe(false)
  })

  it.each(['done', 'cancelled', 'error'] as const)('should finalize a matching %s event exactly once', async (type) => {
    const { handlers, state, api } = createHarness()
    const completion = deferred<{ ok: boolean }>()
    api.sendChatMessage.mockReturnValue(completion.promise)
    const sending = handlers.sendMessage()
    await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1))
    const identity = {
      conversationId: 'conversation-one', requestId: 'request-1', assistantMessageId: 'assistant-one'
    }
    const event: ChatStreamEvent = type === 'error'
      ? { ...identity, type, code: 'network', message: 'Synthetic failure' }
      : type === 'done' ? { ...identity, type, content: 'Reply' } : { ...identity, type }
    handlers.handleStreamEvent(event)
    await vi.waitFor(() => expect(state.streaming).toBe(false))
    completion.resolve({ ok: type === 'done' })
    await sending
    expect(api.getConversationMessages).toHaveBeenCalledTimes(1)
    expect(state.activeRequestId).toBeNull()
  })

  it('should ignore duplicate terminal events while history reload is pending', async () => {
    const { handlers, state, api } = createHarness()
    const history = deferred<ChatMessageRecord[]>()
    api.getConversationMessages.mockReturnValue(history.promise)
    const sending = handlers.sendMessage()
    await vi.waitFor(() => expect(api.getConversationMessages).toHaveBeenCalledTimes(1))
    handlers.handleStreamEvent({ type: 'cancelled', conversationId: 'conversation-one', requestId: 'request-1', assistantMessageId: 'assistant-one' })
    expect(api.getConversationMessages).toHaveBeenCalledTimes(1)
    history.resolve([]); await sending
    expect(state.streaming).toBe(false)
  })
})
