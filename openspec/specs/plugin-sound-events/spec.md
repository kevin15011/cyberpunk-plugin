# Plugin Sound Events Specification

## Purpose

Defines which OpenCode lifecycle events trigger sound playback in the cyberpunk plugin, with dedupe rules for session-completion events.

## Requirements

### Requirement: Completion Sound Trigger

The completion sound (`idle.wav`) MUST play exactly once when the OpenCode session finishes working and returns to the idle state. The trigger MUST be `session.idle` and/or `session.status` with `properties.status.type` set to `idle`. The system MUST NOT use `message.updated` as the completion trigger.

#### Scenario: Session idle event received

- GIVEN the plugin is active
- WHEN a `session.idle` event is received
- THEN the completion sound (`idle.wav`) MUST play exactly once

#### Scenario: Session status transitions to idle

- GIVEN the plugin is active
- WHEN a `session.status` event arrives with `properties.status.type` set to `idle`
- THEN the completion sound (`idle.wav`) MUST play exactly once

#### Scenario: Duplicate idle signals within throttle window

- GIVEN the completion sound already played for a session completion
- WHEN another completion signal (`session.idle` or `session.status` with `idle`) arrives within 2 seconds
- THEN the completion sound MUST NOT play again

#### Scenario: Second completion beyond throttle window

- GIVEN the completion sound played at time T
- WHEN a new completion signal arrives at T+3s
- THEN the completion sound MUST play (throttle window elapsed)

### Requirement: Message Updated Non-Trigger

The `message.updated` event MUST NOT trigger the completion sound. No completion logic SHALL rely on `properties.info.finish`.

#### Scenario: Message updated event received

- GIVEN the plugin is active
- WHEN a `message.updated` event is received
- THEN no sound SHALL be played

### Requirement: Permission Sound

The `permission.asked` event MUST trigger the permission sound (`permission.wav`).

#### Scenario: Permission prompt

- GIVEN the plugin is active
- WHEN a `permission.asked` event is received
- THEN `permission.wav` MUST play

### Requirement: Error Sound

The `session.error` event MUST trigger the error sound (`error.wav`).

#### Scenario: Error event

- GIVEN the plugin is active
- WHEN a `session.error` event is received
- THEN `error.wav` MUST play

### Requirement: Compact Sound

The `session.compacted` event MUST trigger the compact sound (`compact.wav`).

#### Scenario: Compact event

- GIVEN the plugin is active
- WHEN a `session.compacted` event is received
- THEN `compact.wav` MUST play

### Requirement: Sound Asset Filename Stability

All sound filenames (`idle.wav`, `error.wav`, `compact.wav`, `permission.wav`) MUST remain unchanged. No sound asset SHALL be renamed as part of this change.

#### Scenario: Existing sounds remain valid after upgrade

- GIVEN a user has previously installed cyberpunk sounds
- WHEN the plugin is upgraded with this change
- THEN all existing sound filenames SHALL remain valid without reinstallation
