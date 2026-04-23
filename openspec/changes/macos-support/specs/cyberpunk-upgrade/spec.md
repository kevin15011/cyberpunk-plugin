# Delta for cyberpunk-upgrade

## MODIFIED Requirements

### Requirement: Apply Upgrade

When invoked without `--check`, the system SHALL read `installMode` from cyberpunk config and dispatch accordingly: `"repo"` uses git-pull, `"binary"` downloads the latest release binary matching the current OS and CPU architecture from GitHub Releases using `releases/latest/download/cyberpunk-{os}-{arch}` and replaces the local binary. The system MUST preserve `~/.config/cyberpunk/config.json` across upgrades.
(Previously: binary upgrades downloaded the latest release binary without an explicit platform-specific asset selection and shared URL contract.)

#### Scenario: Successful repo upgrade

- GIVEN `installMode` is `"repo"` and a newer version exists on remote
- WHEN `cyberpunk upgrade` is run
- THEN local source files are updated via git-pull
- AND `UpgradeResult.status` is `"upgraded"` with `fromVersion` and `toVersion`

#### Scenario: Successful Linux binary upgrade

- GIVEN `installMode` is `"binary"` on linux x64 or arm64 and a newer release exists
- WHEN `cyberpunk upgrade` is run
- THEN the matching `cyberpunk-linux-{arch}` asset replaces `~/.local/bin/cyberpunk`
- AND `config.json` is unchanged

#### Scenario: Successful macOS binary upgrade

- GIVEN `installMode` is `"binary"` on darwin x64 or arm64 and a newer release exists
- WHEN `cyberpunk upgrade` is run
- THEN the matching `cyberpunk-darwin-{arch}` asset is downloaded from the shared latest-download URL
- AND it replaces `~/.local/bin/cyberpunk`

#### Scenario: Binary already current

- GIVEN `installMode` is `"binary"` and local version matches the latest release for the current platform
- WHEN `cyberpunk upgrade` is run
- THEN `UpgradeResult.status` is `"up-to-date"` and no files are modified

#### Scenario: Binary download failure

- GIVEN `installMode` is `"binary"` and release lookup or download for the current platform fails
- WHEN `cyberpunk upgrade` is run
- THEN `UpgradeResult.status` is `"error"` with a descriptive message
- AND no local files are modified

#### Scenario: Config preserved during upgrade

- GIVEN the user has custom config values in `config.json`
- WHEN upgrade applies in either mode
- THEN `config.json` content is identical before and after upgrade
