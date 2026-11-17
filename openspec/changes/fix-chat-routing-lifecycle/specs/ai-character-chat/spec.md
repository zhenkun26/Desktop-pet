## ADDED Requirements

### Requirement: Request-scoped generation completion

The renderer SHALL handle stop independently of input content. Stream events and IPC completion SHALL finalize only their matching request, at most once. Success, failure, and rejection SHALL all restore controls, including when terminal events are lost. Delayed history reads MUST NOT replace a different conversation.

#### Scenario: Empty input during generation
- **WHEN** the user clicks stop after sending cleared the input
- **THEN** the active conversation receives a cancellation request

#### Scenario: Terminal events are lost or arrive late
- **WHEN** IPC settles without a terminal event
- **THEN** the matching request is finalized from persisted history
- **AND** late events or completion from an older request cannot affect a newer one

### Requirement: Cancellation retains ownership until settlement

The service SHALL retain an aborted request's conversation lock until settlement, reject overlapping sends, and release only its own controller. Idle SHALL be emitted only when no requests remain.

#### Scenario: Immediate resend after stop
- **WHEN** the cancelled provider promise has not settled
- **THEN** another send for that conversation is rejected
- **AND** a new send is accepted after settlement and remains independently cancellable
