import type { ProviderConfig, ProviderConfigSnapshot, ProviderConnection } from './types'

export const DEFAULT_MODEL_PROFILE_ID = 'deepseek-default'

/** Resolve legacy null model references without applying a new global default. */
export function resolveModelProfileId(modelProfileId: string | null | undefined): string {
  return modelProfileId || DEFAULT_MODEL_PROFILE_ID
}

/** Resolve a route without exposing credentials or choosing a replacement model. */
export function resolveProviderSnapshot(
  config: ProviderConfig,
  modelProfileId: string | null | undefined
): ProviderConfigSnapshot | null {
  const model = config.models.find((entry) => entry.id === resolveModelProfileId(modelProfileId))
  if (!model) return null
  const connection = config.connections.find((entry) => entry.id === model.connectionId)
  if (!connection) return null
  return {
    modelProfileId: model.id,
    providerConnectionId: connection.id,
    providerType: connection.providerType,
    providerName: connection.displayName,
    baseUrl: connection.baseUrl,
    modelId: model.modelId,
    modelName: model.displayName,
    credentialId: connection.credentialId
  }
}

/** Bind user consent to the destination and credential policy, not its display name. */
export function providerConsentKey(connection: ProviderConnection): string {
  return JSON.stringify([
    connection.providerType, connection.baseUrl,
    connection.credentialId, connection.allowLocalhost
  ])
}

/** Compare actual routing fields; cosmetic names do not change a request's destination. */
export function providerRoutesMatch(
  expected: ProviderConfigSnapshot,
  actual: ProviderConfigSnapshot
): boolean {
  return expected.modelProfileId === actual.modelProfileId &&
    expected.providerConnectionId === actual.providerConnectionId &&
    expected.providerType === actual.providerType &&
    expected.baseUrl === actual.baseUrl &&
    expected.modelId === actual.modelId &&
    expected.credentialId === actual.credentialId
}
