# Plugin Registration Specification

## Purpose

Manages the cyberpunk plugin entry in OpenCode's `~/.config/opencode/config.json` `plugin` array. Ensures the plugin is registered after install and unregistered after uninstall.

## Requirements

### Requirement: Register Plugin in OpenCode Config

The system SHALL add `./plugins/cyberpunk` to the `plugin` array in `~/.config/opencode/config.json` after successful plugin install. Registration MUST be idempotent — duplicate entries MUST NOT be created.

#### Scenario: Config lacks plugin entry

- GIVEN `config.json` has no `plugin` array or the array does not contain `./plugins/cyberpunk`
- WHEN plugin install completes successfully
- THEN `./plugins/cyberpunk` is appended to the `plugin` array

#### Scenario: Config already has plugin entry

- GIVEN `config.json` `plugin` array already contains `./plugins/cyberpunk`
- WHEN plugin install completes successfully
- THEN the array is unchanged and no duplicate is added

#### Scenario: OpenCode config does not exist

- GIVEN `~/.config/opencode/config.json` does not exist
- WHEN plugin install completes successfully
- THEN registration is skipped with a warning (non-fatal)

### Requirement: Unregister Plugin from OpenCode Config

The system SHALL remove `./plugins/cyberpunk` from the `plugin` array on uninstall. It MUST NOT modify or remove any other entries in the array.

#### Scenario: Uninstall removes only cyberpunk entry

- GIVEN `plugin` array contains `./plugins/cyberpunk` and other plugin entries
- WHEN plugin uninstall completes successfully
- THEN only `./plugins/cyberpunk` is removed; all other entries remain untouched

#### Scenario: No matching entry on uninstall

- GIVEN `plugin` array does not contain `./plugins/cyberpunk`
- WHEN plugin uninstall completes successfully
- THEN the array is unchanged and no error is raised

#### Scenario: OpenCode config absent on uninstall

- GIVEN `~/.config/opencode/config.json` does not exist
- WHEN plugin uninstall completes successfully
- THEN unregistration is skipped silently

### Requirement: Agent-Specific Registration Adapters

The system MUST preserve the current OpenCode registration contract exactly, and MUST isolate registration behind agent-specific adapters. Claude and Codex registration MUST NOT run unless their adapter is explicitly verified as supported.

#### Scenario: OpenCode registration is unchanged

- GIVEN OpenCode plugin installation succeeds
- WHEN registration runs
- THEN the current OpenCode config entry is managed with the existing path and idempotent behavior

#### Scenario: Unverified adapter is not invoked

- GIVEN Claude or Codex is selected but no verified registration adapter exists
- WHEN plugin registration would otherwise run
- THEN registration is skipped safely with an explanatory status
