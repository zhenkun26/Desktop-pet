## Context

The main process resolves a null conversation model to the built-in DeepSeek profile, while the renderer falls back to the current global default or the first available option. Streaming events have assistant IDs but no renderer-originated request correlation. Cancellation currently removes controllers before their promises settle.

## Decisions

1. Keep legacy null-model behavior. Use a shared resolver in both processes. Display an unavailable selected profile as unavailable, never as a different usable model. Global defaults affect only new conversations.
2. Include the displayed route snapshot in renderer sends. Main-process comparison rejects stale routes before persisting messages or contacting a provider. Existing direct service callers may omit this optional precondition; the application renderer always supplies it.
3. Represent consent identity using protocol, canonical base URL, credential ID, and localhost policy. Display-name edits preserve consent; destination-related edits revoke it. Confirmation must match the identity the renderer displayed.
4. Generate a renderer request ID before IPC. Events and invoke completion can finalize only that request. Successful invoke completion is a fallback even if all stream events are lost. Late events cannot finalize a newer request; delayed history reads cannot replace another conversation.
5. Keep an aborted controller registered until its request settles, reject overlapping sends for that conversation, and emit idle only when no request remains. A provider that resolves after cancellation must still produce a cancelled result.
6. Use the installed TypeScript compiler to execute selected renderer functions against mocked UI/IPC ports in tests. This checks actual event-handler code without adding a DOM dependency; it does not establish native Electron GUI acceptance.

## Risks and Validation

Internal confirmation and event contracts must change together across shared types, preload, IPC, service, and renderer. Tests cover stale consent, stale routes, legacy/default/unavailable selection, dropped and late events, empty-input stop, delayed history reads, and cancellation settlement. Existing tests, typecheck, and production build remain required. Native GUI behavior and hosted CI remain unverified in this local-only round.
