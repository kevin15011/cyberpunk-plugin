# Plugin Sound Events Specification

## Purpose

Defines which OpenCode lifecycle events trigger sound playback in the cyberpunk plugin, with dedupe rules for streaming-completion events.

## Requirements

### Requirement: Completion Sound Trigger

The completion sound (`idle.wav`) MUST play exactly once when the assistant finishes responding. The trigger MUST be `message.updated` with `properties.info.finish` present. The system MUST NOT play the completion sound on `session.idle`. The system MUST NOT play the completion sound for intermediate streaming updates lacking `info.finish`.

#### Scenario: Multiple streaming updates before completion

- GIVEN the assistant is streaming a response
- WHEN multiple `message.updated` events arrive without `info.finish`
- THEN the completion sound MUST NOT play for any intermediate event

#### Scenario: Final message with finish flag

- GIVEN the assistant is streaming a response
- WHEN a `message.updated` event arrives with `properties.info.finish` set
- THEN the completion sound (`idle.wav`) MUST play exactly once

#### Scenario: Duplicate terminal updates within throttle window

- GIVEN a `message.updated` with `info.finish` already triggered the completion sound
- WHEN another `message.updated` with `info.finish` arrives within 2 seconds
- THEN the completion sound MUST NOT play again

#### Scenario: Second completion beyond throttle window

- GIVEN the completion sound played at time T
- WHEN a new `message.updated` with `info.finish` arrives at T+3s
- THEN the completion sound MUST play (throttle window elapsed)

### Requirement: Session Idle Non-Trigger

The `session.idle` event MUST NOT trigger any sound playback. No handler for `session.idle` SHALL exist in the plugin event system.

#### Scenario: Session idle event received

- GIVEN the plugin is active
- WHEN a `session.idle` event is received
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
