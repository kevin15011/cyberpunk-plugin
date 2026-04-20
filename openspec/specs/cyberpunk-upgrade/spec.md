# Cyberpunk Upgrade Specification

## Purpose

Verifies whether a newer version of the cyberpunk plugin exists in the remote git repository and applies the update, replacing local files while preserving user configuration.

## CLI Interface

```
cyberpunk upgrade [--check] [--json] [--verbose]
```

### Flags

| Flag | Description |
|------|-------------|
| `--check` | Only check for updates; do not apply |
| `--json` | JSON output |
| `--verbose` | Show git diff details |

## Data Models

```typescript
interface UpgradeStatus {
  currentVersion: string   // git hash or tag of local install
  latestVersion: string    // git hash or tag of remote main
  upToDate: boolean
  changedFiles: string[]   // files that differ between local and remote
}

interface UpgradeResult {
  status: "up-to-date" | "upgraded" | "error"
  fromVersion?: string
  toVersion?: string
  filesUpdated?: string[]
  error?: string
}
```

## Requirements

### Requirement: Version Check

The system SHALL compare the local version (stored in config) against the latest commit on the remote `main` branch. It MUST NOT modify any files when `--check` is specified.

#### Scenario: Already up to date

- GIVEN local version hash matches remote `main` HEAD
- WHEN `cyberpunk upgrade --check` is run
- THEN `UpgradeStatus.upToDate` is `true` and no files are touched

#### Scenario: New version available

- GIVEN remote `main` has a newer commit than local
- WHEN `cyberpunk upgrade --check` is run
- THEN `UpgradeStatus.upToDate` is `false` and `changedFiles` lists the diffs

### Requirement: Apply Upgrade

When invoked without `--check`, the system SHALL download the latest files from the remote repository and replace local component sources. The system MUST preserve `~/.config/cyberpunk/config.json` across upgrades.

#### Scenario: Successful upgrade

- GIVEN a newer version exists on remote
- WHEN `cyberpunk upgrade` is run
- THEN local source files are updated to match remote HEAD
- AND `UpgradeResult.status` is `"upgraded"` with `fromVersion` and `toVersion`
- AND `config.json` is unchanged

#### Scenario: Config preserved during upgrade

- GIVEN the user has custom config values in `config.json`
- WHEN `cyberpunk upgrade` applies an update
- THEN the config file content is identical before and after upgrade

### Requirement: Offline Graceful Failure

The system MUST handle network failures gracefully and report an error without modifying local files.

#### Scenario: No network

- GIVEN the machine has no internet connectivity
- WHEN `cyberpunk upgrade` is run
- THEN `UpgradeResult.status` is `"error"` with a network-related message
- AND no local files are modified

### Requirement: Backup Before Upgrade

The system SHOULD create a backup of files being replaced before writing new versions.

#### Scenario: Backup created

- GIVEN an upgrade will replace `cyberpunk.ts`
- WHEN the upgrade proceeds
- THEN a copy of the old file is saved as `cyberpunk.ts.bak` in the same directory
