# Tasks: installer-upgrade-release-fix

## Phase 1: Foundation / Types

- [x] 1.1 **Add `InstallMode` type and fields to `src/config/schema.ts`** — add `installMode?: "repo" | "binary"` and `pluginRegistered?: boolean` to `CyberpunkConfig` interface

## Phase 2: Core Implementation

- [x] 2.1 **Create `src/opencode-config.ts`** — add `registerCyberpunkPlugin()` and `unregisterCyberpunkPlugin()` helpers; read/write only `./plugins/cyberpunk` entry in `~/.config/opencode/config.json`; return `{ changed, registered, warning? }`; idempotent (no duplicate entries); warn-and-skip on missing file or invalid `plugin` field
- [x] 2.2 **Create `src/opencode-config.test.ts`** — unit tests covering: append to empty `plugin` array, skip duplicate entry, remove only `./plugins/cyberpunk`, missing config file (skip silently), invalid `plugins` field type (warn-and-skip)
- [x] 2.3 **Modify `src/components/plugin.ts`** — after successful `writeFileSync(TARGET_PATH, ...)` in `install()`, call `registerCyberpunkPlugin()`; after `unlinkSync(TARGET_PATH)` in `uninstall()`, call `unregisterCyberpunkPlugin()`; update config with `pluginRegistered: true/false`
- [x] 2.4 **Modify `src/config/load.ts`** — in `loadConfig()`, if `installMode` is absent, silently default to `"repo"` in memory without writing to disk
- [x] 2.5 **Modify `src/commands/install.ts`** — after successful plugin install, stamp config with `installMode: "repo"`
- [x] 2.6 **Modify `src/commands/upgrade.ts`** — branch on `installMode`: if `"binary"`, add binary upgrade path (fetch `https://github.com/kevin15011/cyberpunk-plugin/releases/latest`, compare semver, download platform asset to temp file, chmod, rename over `~/.local/bin/cyberpunk`, return `up-to-date | upgraded | error`); if `"repo"` or absent, keep existing git-pull path; preserve `config.json` in both paths
- [x] 2.7 **Modify `install.sh`** — after binary download completes, call CLI to persist `installMode: "binary"` in cyberpunk config before launching TUI
- [x] 2.8 **Bump `package.json` version** — change `"version": "1.0.1"` to `"version": "1.1.0"`

## Phase 3: Testing

- [x] 3.1 **Create `src/commands/upgrade.test.ts`** — unit tests for: mode dispatch (repo vs binary), binary version comparison (up-to-date short-circuit), failed download returns `error` status with no local changes, `installMode` absent defaults to repo
- [x] 3.2 **Create `src/components/plugin.test.ts`** — unit tests verifying `registerCyberpunkPlugin` called only after successful file write, `unregisterCyberpunkPlugin` called only after successful file delete

## Phase 4: Cleanup

- [x] 4.1 **Verify no other files modified** — confirm only listed files above were changed

## Phase 5: Verification Fixes (batch 2)

- [x] 5.1 **Fix binary install mode persistence in `install.sh`** — replace bun/node-dependent JSON manipulation with CLI-native `cyberpunk config set installMode binary` command; relax `setConfigValue` in `src/config/save.ts` to allow setting new top-level keys
- [x] 5.2 **Fix `pluginRegistered` accuracy in `src/components/plugin.ts`** — only set `pluginRegistered = true` when `registerCyberpunkPlugin()` returns `registered: true`; set `false` when registration is skipped/failed (missing config, invalid plugin field)
- [x] 5.3 **Strengthen upgrade-mode tests** — rewrite `tests/upgrade-mode.test.ts` to import actual module functions (`compareSemver`, `getPlatformAsset`, `loadConfig`, `runUpgrade`, `checkUpgrade`) instead of inline logic copies; add real dispatch tests that verify repo vs binary path via result shape (git SHA vs semver)
- [x] 5.4 **Strengthen plugin-registration tests** — rewrite `tests/plugin-registration.test.ts` to use actual CONFIG_PATH from module; add tests verifying `pluginRegistered` is `false` when OpenCode config missing or invalid, and `true` when registration succeeds

## Phase 6: Install.sh Persistence Reliability (batch 3)

- [x] 6.1 **Fix install.sh CLI syntax** — corrected `config set installMode binary` (wrong: creates key "set") to `config installMode binary` (correct CLI syntax: `config <key> <value>`)
- [x] 6.2 **Remove silent failure swallowing in install.sh** — replaced `2>/dev/null || true` with explicit `if !` checks that `exit 1` with clear error messages on config init, config set, and readback verification failures
- [x] 6.3 **Add readback verification in install.sh** — after setting installMode, reads it back and fails the install if the persisted value doesn't match "binary"
- [x] 6.4 **Add `success` field to `ConfigCommandResult`** — enables proper exit code reporting; `src/index.ts` now exits 1 when config set/get fails instead of always exiting 0
- [x] 6.5 **Add config command success reporting tests** — 6 new tests in `tests/config.test.ts` covering: valid set, invalid nested key set, valid get, missing key get, init, list — all verify the `success` field
