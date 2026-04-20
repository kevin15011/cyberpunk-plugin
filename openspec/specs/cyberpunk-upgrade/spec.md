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

When invoked without `--check`, the system SHALL read `installMode` from cyberpunk config and dispatch accordingly: `"repo"` uses git-pull, `"binary"` downloads the latest release binary from GitHub and replaces the local binary. The system MUST preserve `~/.config/cyberpunk/config.json` across upgrades.

#### Scenario: Successful repo upgrade

- GIVEN `installMode` is `"repo"` and a newer version exists on remote
- WHEN `cyberpunk upgrade` is run
- THEN local source files are updated via git-pull
- AND `UpgradeResult.status` is `"upgraded"` with `fromVersion` and `toVersion`

#### Scenario: Successful binary upgrade

- GIVEN `installMode` is `"binary"` and a newer release exists on GitHub
- WHEN `cyberpunk upgrade` is run
- THEN the latest release binary is downloaded and replaces `~/.local/bin/cyberpunk`
- AND `config.json` is unchanged
- AND `UpgradeResult.status` is `"upgraded"`

#### Scenario: Binary already current

- GIVEN `installMode` is `"binary"` and local version matches latest release tag
- WHEN `cyberpunk upgrade` is run
- THEN `UpgradeResult.status` is `"up-to-date"` and no files are modified

#### Scenario: Binary download failure

- GIVEN `installMode` is `"binary"` and GitHub release lookup or download fails
- WHEN `cyberpunk upgrade` is run
- THEN `UpgradeResult.status` is `"error"` with a descriptive message
- AND no local files are modified

#### Scenario: Config preserved during upgrade

- GIVEN the user has custom config values in `config.json`
- WHEN upgrade applies (either mode)
- THEN `config.json` content is identical before and after upgrade

### Requirement: Install Mode Default

When `installMode` is absent from cyberpunk config, the system SHALL default to `"repo"` and proceed with the git-pull upgrade path.

#### Scenario: Unknown install mode defaults safely

- GIVEN `config.json` has no `installMode` field
- WHEN `cyberpunk upgrade` is run
- THEN the system proceeds with repo-based (git-pull) upgrade without error

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
