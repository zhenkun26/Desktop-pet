## Why

Legacy conversations can display a global default that differs from their actual provider. Editing a confirmed endpoint retains consent. Empty input prevents stopping generation, successful IPC completion does not recover a lost terminal event, and cancellation can release request ownership too early.

## What Changes

- Share effective model and route resolution between the renderer and main process; reject stale displayed routes before sending.
- Bind privacy confirmation to the endpoint, protocol, credential reference, and localhost policy.
- Handle stop before validating message content, correlate stream events and completion by request, and retain cancellation ownership until settlement.
- Add offline regressions using synthetic credentials, temporary databases, mocked providers, and renderer function execution.

## Capabilities

### Modified Capabilities
- `multi-provider-model-routing`: consistent displayed and actual routes and destination-bound consent.
- `ai-character-chat`: request-scoped cancellation and terminal cleanup.

## Non-goals

No dependency upgrades, navigation/IPC-origin hardening, SSE protocol changes, startup recovery, migration changes, packaging fixes, paid requests, pushes, merges, or releases.

## Impact

Shared route helpers, internal preload/IPC contracts, provider configuration, chat service, renderer controls, regression tests, and change records. Existing conversation rows and message history are not rewritten.
