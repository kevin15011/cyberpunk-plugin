# Cyberpunk Config Specification

## Purpose

Manages persistent configuration for the cyberpunk CLI at `~/.config/cyberpunk/config.json`. Tracks which components are installed, their versions, and user preferences.

## CLI Interface

```
cyberpunk config [key] [value] [--json]
cyberpunk config --list
cyberpunk config --init
```

### Flags

| Flag | Description |
|------|-------------|
| `--list` | Print all config keys and values |
| `--init` | Create default config if none exists |
| `--json` | JSON output |

### Arguments

| Argument | Description |
|----------|-------------|
| `key` | Config key to read or set |
| `value` | If provided, sets the key to this value |

## Data Models

```typescript
interface CyberpunkConfig {
  version: number           // schema version, starts at 1
  components: {
    plugin: ComponentState
    theme: ComponentState
    sounds: ComponentState
    "context-mode": ComponentState
  }
  lastUpgradeCheck?: string // ISO timestamp
  repoUrl?: string          // git remote, defaults to kevin15011/cyberpunk-plugin
}

interface ComponentState {
  installed: boolean
  version?: string          // git hash or "bundled"
  installedAt?: string      // ISO timestamp
  path?: string             // where it was installed
}
```

## Requirements

### Requirement: Config File Location

The system SHALL store configuration at `~/.config/cyberpunk/config.json`. If the directory or file does not exist, the system MUST create them on first access.

#### Scenario: First run creates config

- GIVEN `~/.config/cyberpunk/` does not exist
- WHEN any cyberpunk command is run
- THEN the directory and `config.json` are created with default values
- AND all components have `installed: false`

#### Scenario: Existing config loaded

- GIVEN `config.json` exists with `plugin.installed: true`
- WHEN `cyberpunk config --list` is run
- THEN the output reflects the stored state

### Requirement: Read Config Value

The system SHALL support reading a single config key via `cyberpunk config <key>`.

#### Scenario: Read nested value

- GIVEN config has `components.plugin.installed: true`
- WHEN `cyberpunk config components.plugin.installed` is run
- THEN output is `true`

#### Scenario: Read missing key

- GIVEN config exists but `repoUrl` is not set
- WHEN `cyberpunk config repoUrl` is run
- THEN output is `(not set)` or JSON `null`

### Requirement: Write Config Value

The system SHALL support setting a config key via `cyberpunk config <key> <value>`. Values MUST be parsed as JSON (strings quoted, booleans unquoted).

#### Scenario: Set string value

- GIVEN config exists
- WHEN `cyberpunk config repoUrl "https://github.com/user/repo"` is run
- THEN `repoUrl` is set to the provided string

#### Scenario: Set boolean value

- GIVEN config exists
- WHEN `cyberpunk config components.sounds.installed true` is run
- THEN `components.sounds.installed` is set to `true`

### Requirement: Config Init

The system SHALL provide `--init` to create a default config without overwriting an existing one.

#### Scenario: Init when no config exists

- GIVEN `~/.config/cyberpunk/config.json` does not exist
- WHEN `cyberpunk config --init` is run
- THEN a default config is written with all components `installed: false`

#### Scenario: Init preserves existing config

- GIVEN `config.json` exists with custom values
- WHEN `cyberpunk config --init` is run
- THEN the existing config is unchanged and a message says "Config already exists"

### Requirement: Config Sync on Install/Uninstall

The install and uninstall commands MUST update `config.json` to reflect the actual state after each operation.

#### Scenario: Config updated after install

- GIVEN plugin is not installed
- WHEN `cyberpunk install --plugin` succeeds
- THEN `components.plugin.installed` is `true` and `installedAt` is set to current timestamp

#### Scenario: Config updated after uninstall

- GIVEN sounds is installed
- WHEN `cyberpunk uninstall --sounds` succeeds
- THEN `components.sounds.installed` is `false` and version/path are cleared
