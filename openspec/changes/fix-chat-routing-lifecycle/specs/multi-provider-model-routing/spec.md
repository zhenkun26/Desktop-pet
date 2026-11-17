## ADDED Requirements

### Requirement: Displayed route matches the conversation route

The system SHALL resolve existing null-model conversations to the legacy DeepSeek profile in both processes. It MUST NOT silently display an alternative when the selected profile is unavailable. Renderer sends SHALL include their displayed route; stale routes SHALL be rejected before persistence or provider access.

#### Scenario: Global default changes after a legacy conversation exists
- **WHEN** the global default changes to another provider
- **THEN** the existing null-model conversation still displays and uses DeepSeek
- **AND** only newly created conversations inherit the new default

#### Scenario: Selected route is unavailable or changes before sending
- **WHEN** the selected model is removed, disabled, lacks a credential, or differs from the displayed route
- **THEN** the system prevents sending instead of silently selecting a replacement

### Requirement: Privacy confirmation belongs to the displayed destination

The system SHALL invalidate consent when protocol, endpoint, credential reference, or localhost policy changes. Confirmation SHALL reject an identity different from the current connection. Display-name-only edits MAY preserve consent.

#### Scenario: Confirmed endpoint changes
- **WHEN** a confirmed connection changes destination
- **THEN** sending requires fresh confirmation and the old confirmation identity is rejected
