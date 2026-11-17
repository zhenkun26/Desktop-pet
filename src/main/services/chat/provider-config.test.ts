import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { app } from 'electron'
import { providerConsentKey } from '../../../shared/model-routing'
import { confirmProviderPrivacy, getProviderConnection } from './provider-config'
import {
  deleteModelProfile,
  deleteProviderConnection,
  getProviderConfig,
  saveModelProfile,
  saveProviderConnection,
  validateProviderBaseUrl
} from './provider-config'
import {
  clearApiKey,
  getCredential,
  getCredentialStatus,
  setCredential
} from './secrets-store'

const userData = app.getPath('userData')

function cleanup(): void {
  rmSync(join(userData, 'provider-config.json'), { force: true })
  rmSync(join(userData, 'deepseek-api-key.bin'), { force: true })
  rmSync(join(userData, 'credentials'), { recursive: true, force: true })
}

describe('provider-config', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it('should provide a built-in DeepSeek connection and model', () => {
    const config = getProviderConfig()
    expect(config.connections[0]).toMatchObject({
      id: 'deepseek-default',
      providerType: 'openai-compatible'
    })
    expect(config.models[0]).toMatchObject({
      id: 'deepseek-default',
      modelId: 'deepseek-v4-flash'
    })
  })

  it('should reject unsafe provider endpoints and allow HTTPS/localhost', () => {
    expect(() => validateProviderBaseUrl('file:///tmp/key')).toThrow()
    expect(() => validateProviderBaseUrl('https://example.com?api_key=secret')).toThrow()
    expect(validateProviderBaseUrl('https://example.com/')).toBe('https://example.com')
    expect(() => validateProviderBaseUrl('http://localhost:11434/')).toThrow()
    expect(validateProviderBaseUrl('http://localhost:11434/', true)).toBe(
      'http://localhost:11434'
    )
  })

  it('should isolate connections, credentials and models', () => {
    saveProviderConnection({
      id: 'company-a',
      providerType: 'openai-compatible',
      displayName: '公司 A',
      baseUrl: 'https://a.example.com',
      credentialId: 'company-a-key'
    })
    saveProviderConnection({
      id: 'company-b',
      providerType: 'openai-compatible',
      displayName: '公司 B',
      baseUrl: 'https://b.example.com',
      credentialId: 'company-b-key'
    })
    const modelA = saveModelProfile({
      id: 'company-a-model',
      connectionId: 'company-a',
      modelId: 'model-a',
      displayName: '模型 A'
    })
    expect(modelA.connectionId).toBe('company-a')
    expect(() =>
      saveModelProfile({
        id: 'duplicate-model',
        connectionId: 'company-a',
        modelId: 'model-a',
        displayName: '重复模型'
      })
    ).toThrow('相同模型')

    setCredential('company-a-key', 'sk-company-a')
    setCredential('company-b-key', 'sk-company-b')
    expect(getCredential('company-a-key')).toBe('sk-company-a')
    expect(getCredential('company-b-key')).toBe('sk-company-b')
    expect(getCredentialStatus('company-a-key').masked).toBe('sk-…ny-a')
    clearApiKey()
    expect(getCredential('company-a-key')).toBe('sk-company-a')

    expect(deleteModelProfile(modelA.id)).toBe(true)
    expect(deleteProviderConnection('company-a')).toBe(true)
    expect(existsSync(join(userData, 'provider-config.json'))).toBe(true)
  })
})


describe('destination-bound privacy confirmation', () => {
  const input = {
    id: 'consent-test', providerType: 'openai-compatible' as const,
    displayName: 'Provider', baseUrl: 'https://first.example.test', credentialId: 'consent-key'
  }
  beforeEach(cleanup)
  afterEach(cleanup)

  it('should keep new connections unconfirmed and accept the displayed destination', () => {
    const created = saveProviderConnection(input)
    expect(created.privacyConfirmed).toBe(false)
    expect(confirmProviderPrivacy(created.id, providerConsentKey(created)).privacyConfirmed).toBe(true)
  })

  it.each([
    { baseUrl: 'https://second.example.test' },
    { credentialId: 'new-credential' },
    { allowLocalhost: true }
  ])('should revoke confirmation and reject stale consent after %j', (patch) => {
    const created = saveProviderConnection(input)
    const oldConsent = providerConsentKey(created)
    confirmProviderPrivacy(created.id, oldConsent)
    expect(saveProviderConnection({ ...input, ...patch }).privacyConfirmed).toBe(false)
    expect(() => confirmProviderPrivacy(created.id, oldConsent)).toThrow('changed')
    expect(getProviderConnection(created.id)?.privacyConfirmed).toBe(false)
  })

  it('should preserve confirmation for a renamed provider and equivalent canonical endpoint', () => {
    const created = saveProviderConnection(input)
    confirmProviderPrivacy(created.id, providerConsentKey(created))
    const renamed = saveProviderConnection({ ...input, displayName: 'Renamed', baseUrl: input.baseUrl + '/' })
    expect(renamed.privacyConfirmed).toBe(true)
  })

  it('should reject confirmation of a missing provider', () => {
    expect(() => confirmProviderPrivacy('missing', 'unused')).toThrow()
  })
})
