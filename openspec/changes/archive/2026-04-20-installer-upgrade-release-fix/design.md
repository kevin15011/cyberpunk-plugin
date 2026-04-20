# Design: Installer Upgrade & Release Fix

## Technical Approach

Keep the current CLI structure and add two focused helpers: one for OpenCode plugin registration and one for upgrade-mode branching. Install/uninstall continues to flow through component modules; upgrade continues through `src/commands/upgrade.ts`, but now dispatches by persisted `installMode`. The design stays fully inside this repository and reuses existing atomic config-write patterns where possible.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| OpenCode config edits | Add `src/opencode-config.ts` with `registerCyberpunkPlugin()` / `unregisterCyberpunkPlugin()` | Inline JSON edits in `plugin.ts` | Shared helper keeps install/uninstall symmetric, testable, and isolated from plugin file-copy logic. |
| Install mode source | Persist `installMode?: "repo" | "binary"` in cyberpunk config; treat missing as `"repo"` | Infer mode on every upgrade from cwd or binary path | Persisted mode is stable for release installs and matches approved spec defaulting behavior. |
| Binary version check | Compare embedded app version to latest GitHub release tag | Always download latest asset | Spec requires `up-to-date` with no file changes; explicit version compare avoids unnecessary replacement. |
| Binary replacement safety | Download to temp file in `~/.local/bin`, chmod, then rename over target; keep backup only during apply | Stream directly into live binary | Temp+rename prevents partial binary corruption and keeps failure rollback simple. |

## Data Flow

### Plugin install/uninstall

`runInstall` -> `plugin.install()` -> write `~/.config/opencode/plugins/cyberpunk.ts` -> `registerCyberpunkPlugin()` -> update `~/.config/cyberpunk/config.json`

`runUninstall` -> `plugin.uninstall()` -> remove plugin file -> `unregisterCyberpunkPlugin()` -> update cyberpunk config

### Upgrade

`checkUpgrade/runUpgrade` -> `loadConfig()` -> resolve `installMode` ->
- `repo`: existing git fetch/diff/pull path
- `binary`: fetch latest release metadata -> select platform asset -> compare versions -> download temp asset -> rename over `~/.local/bin/cyberpunk`

## File Changes

| File | Action | Description |
|---|---|---|
| `src/opencode-config.ts` | Create | Read/write `~/.config/opencode/config.json`, manage only `./plugins/cyberpunk`, return structured status/warnings. |
| `src/components/plugin.ts` | Modify | Call registration helper after successful copy and unregistration after successful delete; persist `pluginRegistered`. |
| `src/commands/install.ts` | Modify | Stamp repo installs with `installMode: "repo"` before/alongside successful installs from a git checkout. |
| `src/commands/upgrade.ts` | Modify | Split repo and binary check/apply paths; add GitHub release lookup, asset selection, temp-download, safe replace. |
| `src/config/schema.ts` | Modify | Add `installMode` and `pluginRegistered` fields plus default/install-mode resolver type. |
| `src/config/load.ts` | Modify | Normalize missing `installMode` to repo in memory without forcing migration. |
| `install.sh` | Modify | After binary download, initialize config and persist `installMode: "binary"` using the installed CLI before launching TUI. |
| `package.json` | Modify | Bump version `1.0.1` -> `1.1.0` so existing release workflow emits a new tag/release. |
| `src/opencode-config.test.ts` | Create | Unit tests for idempotent register/unregister and safe skip behavior. |
| `src/commands/upgrade.test.ts` | Create | Unit tests for mode dispatch, binary version comparison, failed download no-op, and repo default fallback. |
| `src/components/plugin.test.ts` | Create | Unit tests that plugin install/uninstall invoke registration helpers only on successful file operations. |

## Interfaces / Contracts

```ts
export interface OpenCodePluginUpdateResult {
  changed: boolean
  registered: boolean
  warning?: string
}

export type InstallMode = "repo" | "binary"
```

`src/opencode-config.ts` will only touch the `plugin` array entry `./plugins/cyberpunk`; all other OpenCode config keys and plugin entries remain untouched.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | OpenCode registration helper | Temp HOME/opencode config fixtures with Bun tests covering add, dedupe, remove-only-target, missing file, invalid plugin field. |
| Unit | Install mode persistence/default | Tests for config load fallback to `repo`, repo installs stamping repo mode, and `install.sh` invoking config init/set for binary mode. |
| Unit | Upgrade dispatch and binary apply | Mock git exec, mock fetch/release JSON, verify asset selection, `up-to-date` short-circuit, temp file rename, and rollback/no-change on download failure. |

## Migration / Rollout

No migration required. Existing configs remain valid because absent `installMode` is treated as `repo`. The version bump is the rollout trigger: once merged to `main`, `.github/workflows/release.yml` will publish `v1.1.0`, and new binary installs/upgrades can consume that release path.

## Open Questions

- [ ] Should invalid OpenCode `plugin` values (non-array) be warned-and-skipped or normalized to a new array? Design assumes warn-and-skip for safety.
