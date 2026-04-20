# Proposal: Installer Upgrade & Release Fix

## Intent

Three production gaps in the cyberpunk CLI: (1) `cyberpunk install` copies the plugin file to `~/.config/opencode/plugins/` but never registers it in OpenCode's `plugin` config array — the user must do that manually. (2) `cyberpunk upgrade` only works for git-repo installs (`git fetch` + `git pull`); users who installed via the binary from GitHub Releases have no upgrade path. (3) No version bump mechanism exists, so merging to main does not reliably produce a new GitHub release.

## Scope

### In Scope
- Plugin install auto-registers `./plugins/cyberpunk` path in `~/.config/opencode/config.json` → `plugin` array
- Plugin uninstall removes that registration cleanly (no stale entries)
- Config schema gains `installMode: "repo" | "binary"` field, persisted on first install
- `cyberpunk upgrade` dispatches: git-pull path for repo installs, binary-download path for binary installs
- Version bump in `package.json` to trigger a new GitHub Release on merge to main

### Out of Scope
- macOS/Windows binary builds in CI (Linux-only release is unchanged)
- TUI redesign or new subcommands
- Automatic version bump via CI (bump is manual before merge)

## Capabilities

### New Capabilities
- **plugin-registration**: Auto-register/unregister plugin path in OpenCode config during install/uninstall

### Modified Capabilities
- **cyberpunk-install**: Must call registration helper after copying plugin file; uninstall must call unregistration
- **cyberpunk-upgrade**: Must detect `installMode` from config and dispatch to git-pull or binary-download accordingly
- **cyberpunk-config**: Schema gains `installMode` field; persisted on first install or `config init`

## Approach

1. **Registration helper** — new module `src/opencode-config.ts` reads/writes `~/.config/opencode/config.json`, adds/removes `./plugins/cyberpunk` (relative to opencode config dir) from `plugin` array. Idempotent. No-op if opencode config doesn't exist yet.
2. **Install mode tracking** — add `installMode` to `CyberpunkConfig`. `install.sh` sets `"binary"`; running from a git repo sets `"repo"`. Stored in `~/.config/cyberpunk/config.json`.
3. **Upgrade split** — `runUpgrade()` reads `installMode`. If `"repo"`, current git logic applies. If `"binary"`, download latest release binary (reuse `install.sh` URL pattern), replace `~/.local/bin/cyberpunk`, preserve config.
4. **Version bump** — bump `package.json` version from `1.0.1` → `1.1.0`. Existing `release.yml` already reads version from `package.json` and creates a GitHub Release when the tag is new.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/opencode-config.ts` | New | OpenCode config read/write helper for plugin registration |
| `src/components/plugin.ts` | Modified | Call register on install, unregister on uninstall |
| `src/commands/upgrade.ts` | Modified | Add binary-download path alongside git-pull |
| `src/config/schema.ts` | Modified | Add `installMode` field to `CyberpunkConfig` |
| `install.sh` | Modified | Write `installMode: "binary"` to cyberpunk config after download |
| `package.json` | Modified | Version bump `1.0.1` → `1.1.0` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OpenCode config format changes | Low | Use defensive parsing; if `plugin` key missing/invalid, skip registration with warning |
| Binary download fails (arch/OS) | Med | Reuse proven `install.sh` URL pattern; clear error message with manual fallback |
| Race on config.json writes | Low | Existing atomic-write (tmp+rename) pattern in `save.ts` |

## Rollback Plan

- All changes are additive (new field, new module, new code path). Revert the commit to restore prior behavior.
- `installMode` field defaults to `"repo"` if absent, so old binaries work with new config files and vice versa.

## Dependencies

- None external. All changes are internal to this repository.

## Success Criteria

- [ ] `cyberpunk install --plugin` adds entry to OpenCode `plugin` config array automatically
- [ ] `cyberpunk uninstall --plugin` removes that entry cleanly
- [ ] `cyberpunk upgrade` works for binary installs (downloads new binary, replaces old one)
- [ ] `cyberpunk upgrade` still works for repo installs (git pull)
- [ ] `package.json` version bumped; merge to main produces a new GitHub Release
