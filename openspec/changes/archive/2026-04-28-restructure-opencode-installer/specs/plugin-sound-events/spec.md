# Delta for Plugin Sound Events

## MODIFIED Requirements

### Requirement: Sound Events Owned by OpenCode Event Sounds

All sound event triggers (`session.idle`, `permission.asked`, `session.error`, `session.compacted`) SHALL be owned by the `opencode-event-sounds` component. Runtime behavior MUST remain identical to the previous `plugin` component. No sound trigger logic SHALL change as part of this rename.

(Previously: Sound events were owned by the generic `plugin` component.)

#### Scenario: Session idle triggers idle.wav

- GIVEN the `opencode-event-sounds` plugin is active
- WHEN a `session.idle` event is received
- THEN `idle.wav` plays exactly once

#### Scenario: Permission asked triggers permission.wav

- GIVEN the `opencode-event-sounds` plugin is active
- WHEN a `permission.asked` event is received
- THEN `permission.wav` plays

#### Scenario: Error event triggers error.wav

- GIVEN the `opencode-event-sounds` plugin is active
- WHEN a `session.error` event is received
- THEN `error.wav` plays

#### Scenario: Compact event triggers compact.wav

- GIVEN the `opencode-event-sounds` plugin is active
- WHEN a `session.compacted` event is received
- THEN `compact.wav` plays

### Requirement: Sound Asset Filename Stability

All sound filenames (`idle.wav`, `error.wav`, `compact.wav`, `permission.wav`) MUST remain unchanged. No sound asset SHALL be renamed as part of this change.

#### Scenario: Existing sounds remain valid after upgrade

- GIVEN a user has previously installed cyberpunk sounds
- WHEN the plugin is upgraded with this change
- THEN all existing sound filenames SHALL remain valid without reinstallation
