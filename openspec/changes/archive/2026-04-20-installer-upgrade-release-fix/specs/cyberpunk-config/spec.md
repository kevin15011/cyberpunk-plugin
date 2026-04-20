# Delta for Cyberpunk Config

## MODIFIED Requirements

### Requirement: Config Data Model

The `CyberpunkConfig` interface SHALL include an optional `installMode` field with values `"repo" | "binary"`. When the field is absent, all consumers MUST treat it as `"repo"`. The system SHALL also persist `pluginRegistered: boolean` to track OpenCode config registration state.
(Previously: no `installMode` or `pluginRegistered` fields in data model)

```typescript
interface CyberpunkConfig {
  version: number
  installMode?: "repo" | "binary"    // ADDED
  pluginRegistered?: boolean          // ADDED
  components: {
    plugin: ComponentState
    theme: ComponentState
    sounds: ComponentState
    "context-mode": ComponentState
  }
  lastUpgradeCheck?: string
  repoUrl?: string
}
```

#### Scenario: Binary install sets installMode

- GIVEN install is invoked via `install.sh` (binary release download)
- WHEN install completes successfully
- THEN `installMode` is set to `"binary"` in config

#### Scenario: Repo install sets installMode

- GIVEN install is invoked from a git clone directory
- WHEN install completes successfully
- THEN `installMode` is set to `"repo"` in config

#### Scenario: Missing installMode defaults to repo

- GIVEN an existing config with no `installMode` field
- WHEN any command reads config
- THEN `installMode` is treated as `"repo"` without error

### Requirement: Version Bump

The `package.json` version SHALL be incremented from `1.0.1` to `1.1.0` to trigger a new GitHub Release on merge to main via the existing `release.yml` workflow.

#### Scenario: Version bumped for release

- GIVEN the current `package.json` version is `1.0.1`
- WHEN this change is merged to main
- THEN the version is `1.1.0` and the release workflow publishes a new GitHub Release
