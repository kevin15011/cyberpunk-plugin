# Delta for Plugin Registration

## MODIFIED Requirements

### Requirement: Register Plugin in OpenCode Config

The system SHALL add `./plugins/cyberpunk` to the `plugin` array in `~/.config/opencode/config.json` after successful `opencode-event-sounds` install. Registration MUST be idempotent. The registration entry path MUST remain `./plugins/cyberpunk` regardless of the component id rename.

(Previously: Registration was tied to the `plugin` component id without explicit name stability guarantee.)

#### Scenario: Config lacks plugin entry

- GIVEN `config.json` has no `plugin` array or the array does not contain `./plugins/cyberpunk`
- WHEN `opencode-event-sounds` install completes successfully
- THEN `./plugins/cyberpunk` is appended to the `plugin` array

#### Scenario: Config already has plugin entry

- GIVEN `config.json` `plugin` array already contains `./plugins/cyberpunk`
- WHEN `opencode-event-sounds` install completes successfully
- THEN the array is unchanged and no duplicate is added

#### Scenario: OpenCode config does not exist

- GIVEN `~/.config/opencode/config.json` does not exist
- WHEN `opencode-event-sounds` install completes successfully
- THEN registration is skipped with a warning (non-fatal)

### Requirement: Unregister Plugin from OpenCode Config

The system SHALL remove `./plugins/cyberpunk` from the `plugin` array on `opencode-event-sounds` uninstall. It MUST NOT modify or remove any other entries.

(Previously: Same behavior but tied to old `plugin` id.)

#### Scenario: Uninstall removes only cyberpunk entry

- GIVEN `plugin` array contains `./plugins/cyberpunk` and other plugin entries
- WHEN `opencode-event-sounds` uninstall completes successfully
- THEN only `./plugins/cyberpunk` is removed; all other entries remain untouched

#### Scenario: No matching entry on uninstall

- GIVEN `plugin` array does not contain `./plugins/cyberpunk`
- WHEN `opencode-event-sounds` uninstall completes successfully
- THEN the array is unchanged and no error is raised
