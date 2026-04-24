# Tasks: Repo Test Stabilization

## Phase 1: Foundation

- [x] 1.1 Create `tests/helpers/test-home.ts` — export `createTempHome(prefix: string)` returning `{ home, configDir, configPath, cleanup() }` using `mkdtempSync` + `join(home, ".config/cyberpunk", "config.json")`.
- [x] 1.2 Add `setDefaultConfig(dir, overrides?)` helper to `tests/helpers/test-home.ts` — writes a standard v1 config JSON with optional component/installMode overrides into the fixture dir.
- [x] 1.3 Add `importAfterHomeSet(modulePath: string)` helper — sets `process.env.HOME` before the cache-busted `await import(…?" + Date.now())` and restores original HOME on cleanup.

## Phase 2: Core Implementation

- [x] 2.1 Refactor `tests/upgrade-mode.test.ts` — remove `ACTUAL_CONFIG_PATH`/`ACTUAL_CONFIG_DIR` resolution from `beforeAll`; replace `writeTestConfig` with `setDefaultConfig` from shared helpers, writing only into temp HOME paths.
- [x] 2.2 Refactor `tests/upgrade-mode.test.ts` repo-mode tests (`"repo config dispatches to repo upgrade path"`, `"missing mode defaults to repo path"`, `"repo mode — checkUpgrade uses repo path"`) — stub `getRepoDir`/`gitCommand` via cache-busted module import with deterministic return values instead of live git calls.
- [x] 2.3 Refactor `tests/config.test.ts` — replace ad-hoc `TEMP_HOME`/`TEMP_CONFIG_DIR` constants with `createTempHome("cyberpunk-config")`; move config path derivation after HOME setup in `beforeEach`.
- [x] 2.4 Refactor `tests/doctor.test.ts` — replace inline `mkdtempSync`/HOME logic in `runDoctor summary derivation` with `createTempHome("cyberpunk-doctor")` and `importAfterHomeSet`.
- [x] 2.5 Refactor `tests/doctor-scenarios.test.ts` — replace inline fixture path setup with `createTempHome("cyberpunk-doctor-scenarios")`; keep single shared tempDir per file but derive all paths from helper output.
- [x] 2.6 Refactor `tests/tmux-component.test.ts` — replace inline `mkdtempSync`/path derivation with `createTempHome("cyberpunk-tmux")`; keep cache-busted import pattern after HOME is set.

## Phase 3: Verification

- [x] 3.1 Run `bun test tests/upgrade-mode.test.ts` — verify repo-mode tests pass deterministically without network/git and no real config touched.
- [x] 3.2 Run `bun test tests/config.test.ts` — verify all config tests use temp HOME exclusively.
- [x] 3.3 Run `bun test tests/doctor.test.ts tests/doctor-scenarios.test.ts` — verify doctor tests are order-independent and use isolated fixtures.
- [x] 3.4 Run `bun test tests/tmux-component.test.ts` — verify tmux install/uninstall assertions target temp fixtures only.
- [x] 3.5 Run full `bun test` — verify no cross-test contamination and no writes to real `~/.config/cyberpunk`.
- [x] 3.6 Add direct scenario-proof regressions for doctor order-independence, config caller-environment isolation, and repo-upgrade config preservation; rerun targeted verification and full suite/typecheck.
