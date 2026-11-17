import { describe, expect, it } from 'vitest'
import { providerConsentKey, providerRoutesMatch, resolveModelProfileId, resolveProviderSnapshot } from './model-routing'
import type { ProviderConfig, ProviderConnection } from './types'

const connection: ProviderConnection = {
  id: 'deepseek-default', providerType: 'openai-compatible', displayName: 'Provider',
  baseUrl: 'https://provider.example.test', credentialId: 'credential', enabled: true,
  allowLocalhost: false, privacyConfirmed: true, updatedAt: 1
}
const config: ProviderConfig = {
  connections: [connection],
  models: [{ id: 'deepseek-default', connectionId: connection.id, modelId: 'model',
    displayName: 'Model', enabled: true, capabilities: { text: true, streaming: true }, updatedAt: 1 }]
}

describe('shared model routing', () => {
  it.each([null, undefined, ''])('should preserve the legacy model for %s', (reference) => {
    expect(resolveModelProfileId(reference)).toBe('deepseek-default')
    expect(resolveProviderSnapshot(config, reference)?.modelId).toBe('model')
  })

  it('should retain an explicit model without replacing a missing route', () => {
    expect(resolveModelProfileId('removed')).toBe('removed')
    expect(resolveProviderSnapshot(config, 'removed')).toBeNull()
    expect(resolveProviderSnapshot({ ...config, connections: [] }, null)).toBeNull()
  })

  it('should ignore cosmetic changes in consent identity', () => {
    expect(providerConsentKey({ ...connection, displayName: 'Renamed', updatedAt: 2 }))
      .toBe(providerConsentKey(connection))
  })

  it.each([
    { baseUrl: 'https://other.example.test' }, { credentialId: 'replacement' }, { allowLocalhost: true }
  ])('should change consent identity for routing changes: %j', (patch) => {
    expect(providerConsentKey({ ...connection, ...patch })).not.toBe(providerConsentKey(connection))
  })

  it('should compare route identity while ignoring display names', () => {
    const snapshot = resolveProviderSnapshot(config, null)!
    expect(providerRoutesMatch(snapshot, { ...snapshot, providerName: 'Renamed', modelName: 'Renamed' })).toBe(true)
    for (const field of ['modelProfileId', 'providerConnectionId', 'baseUrl', 'modelId', 'credentialId'] as const) {
      expect(providerRoutesMatch(snapshot, { ...snapshot, [field]: 'changed' })).toBe(false)
    }
  })
})
