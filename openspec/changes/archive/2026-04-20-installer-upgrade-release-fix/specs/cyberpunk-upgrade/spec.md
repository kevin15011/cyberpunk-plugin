# Delta for Cyberpunk Upgrade

## MODIFIED Requirements

### Requirement: Apply Upgrade

When invoked without `--check`, the system SHALL read `installMode` from cyberpunk config and dispatch accordingly: `"repo"` uses git-pull, `"binary"` downloads the latest release binary from GitHub and replaces the local binary. The system MUST preserve `~/.config/cyberpunk/config.json` across upgrades.
(Previously: only git-pull upgrade path; no installMode dispatch)

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

## ADDED Requirements

### Requirement: Install Mode Default

When `installMode` is absent from cyberpunk config, the system SHALL default to `"repo"` and proceed with the git-pull upgrade path.

#### Scenario: Unknown install mode defaults safely

- GIVEN `config.json` has no `installMode` field
- WHEN `cyberpunk upgrade` is run
- THEN the system proceeds with repo-based (git-pull) upgrade without error
