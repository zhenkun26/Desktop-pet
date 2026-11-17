## Implementation

- [x] Share route resolution and prevent silent model fallback.
- [x] Revoke destination-related consent and reject stale confirmation.
- [x] Fix empty-input stop and request-scoped renderer completion.
- [x] Preserve main-process request ownership during cancellation.
- [x] Add offline routing, consent, renderer, and service regressions.

## Validation and Delivery

- [x] Run typecheck, unit tests, and production build.
- [x] Review the diff and update change records.
- [x] Create a local Conventional Commit.
- [ ] Native Electron GUI acceptance (not run in this round).
- [ ] Hosted CI and maintainer review (requires a separately authorized push).

## Verification Record — 2026-11-16

- Base: `main` at `342996bce0e9805cd3cae31107c4197a5b0aeb65`.
- Branch: `fix/chat-routing-lifecycle`, isolated from the existing README branch.
- PASS: `node node_modules/typescript/bin/tsc --noEmit`.
- PASS: `npm test` — 19 files, 152 tests (109 existing plus 43 added).
- PASS: `npm run build` and `git diff --check`.
- Runtime: Node 24.20.0 and npm 11.19.0. Existing installed dependencies were copied into the isolated checkout; no dependency manifest or lockfile changes.
- Renderer regressions execute actual TypeScript handlers with mocked UI/IPC ports. They are not browser rendering or native GUI tests.
- Provider requests use mocks; credentials and databases are synthetic and isolated from real user data.
- NOT_RUN: native Electron GUI, paid provider requests, hosted CI, and OpenSpec CLI validation (CLI unavailable; artifacts reviewed directly).
- Delivery is local only. No push, merge, or release. Existing README PR work remains separate.
- Deferred audit findings: SSE terminal semantics, orphaned streaming records on startup, migration retries, packaged icon paths, navigation/IPC-origin hardening, and dependency remediation.
