## Verification Report

**Change**: installer-upgrade-release-fix
**Version**: N/A
**Mode**: Standard

---

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

All checklist items in `openspec/changes/installer-upgrade-release-fix/tasks.md` are marked complete.

---

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ bun run build.ts
  [10ms]  bundle  1 modules
 [248ms] compile  ./cyberpunk
✓ Binary built: ./cyberpunk
```

**Tests**: ✅ 109 passed / ❌ 0 failed / ⚠️ 0 skipped
```text
bun test v1.3.12 (700fc117)

 109 pass
 0 fail
 224 expect() calls
Ran 109 tests across 9 files. [5.69s]
```

**Coverage**: ➖ Not available

---

### Additional Behavioral Validation

**Install script harness (`install.sh`)**
- Success harness: exit `0`; fake installed CLI received `config init`, `config installMode binary`, readback `config installMode`, then `tui`; persisted config stored `installMode: "binary"`.
- Failure harness (`config installMode binary` exits non-zero): installer exits `1` instead of swallowing the error.
- Readback-mismatch harness (`config installMode` returns `repo` after set): installer exits `1` on verification failure.
- Fake `bun`/`node` shims were never invoked in any harness.

**CLI config exit behavior**
- `bun run src/index.ts config installMode binary` → exit `0`
- `bun run src/index.ts config nonexistent.deep.key value` → exit `1`
- `bun run src/index.ts config installMode` → exit `0`
- `bun run src/index.ts config does.not.exist` → exit `1`

**Plugin install/uninstall harness**
- `runInstall(["plugin"])` set `installMode: "repo"`, set `pluginRegistered: true`, created the plugin file, and appended only `./plugins/cyberpunk` while preserving `./plugins/other`.
- `runUninstall(["plugin"])` set `pluginRegistered: false` and removed only `./plugins/cyberpunk`.
- Failure/skip harnesses confirmed registration is not invoked when plugin install errors and unregistration is not invoked when uninstall is skipped.

**Upgrade harnesses**
- Repo-mode harness returned `status: "up-to-date"` with git-SHA versions, confirming repo installs still dispatch through the git path.
- Binary-mode success harness (temp HOME, mocked GitHub API/download, existing `~/.local/bin`) returned `status: "upgraded"`, wrote the replacement binary, and preserved existing config fields while adding `lastUpgradeCheck`.
- Binary-mode up-to-date harness returned `status: "up-to-date"` and did not create a binary file.
- Binary-mode failure harness returned `status: "error"` on `HTTP 500` download failure and left no target or temp binary behind.

---

### Spec Compliance Matrix

| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| Register Plugin in OpenCode Config | Config lacks plugin entry | `tests/opencode-config.test.ts` → `register appends to existing config`; manual actual-module harness with `{}` config created `plugin: ["./plugins/cyberpunk"]` | ✅ COMPLIANT |
| Register Plugin in OpenCode Config | Config already has plugin entry | `tests/opencode-config.test.ts` → `register is idempotent — second call returns changed:false` | ✅ COMPLIANT |
| Register Plugin in OpenCode Config | OpenCode config does not exist | `tests/opencode-config.test.ts` → `register with missing config file — returns warning` | ✅ COMPLIANT |
| Unregister Plugin from OpenCode Config | Uninstall removes only cyberpunk entry | `tests/opencode-config.test.ts` → `unregister removes cyberpunk entry` | ✅ COMPLIANT |
| Unregister Plugin from OpenCode Config | No matching entry — array unchanged | Manual actual-module harness: `unregisterCyberpunkPlugin()` with only `./plugins/other` present left config unchanged | ✅ COMPLIANT |
| Unregister Plugin from OpenCode Config | OpenCode config absent on uninstall | `tests/opencode-config.test.ts` → `unregister with missing config — silent skip` | ✅ COMPLIANT |
| OpenCode Registration After Plugin Install | Registration follows successful plugin install | `tests/plugin-registration.test.ts` → `install() writes plugin file and registers in OpenCode config` | ✅ COMPLIANT |
| OpenCode Registration After Plugin Install | Registration skipped on install failure | Manual `runInstall(["plugin"])` failure harness with blocked plugins path returned `status: "error"` and left OpenCode plugin array unchanged | ✅ COMPLIANT |
| OpenCode Unregistration After Plugin Uninstall | Unregistration follows successful plugin uninstall | `tests/plugin-registration.test.ts` → `uninstall() removes plugin file and unregisters from OpenCode config` | ✅ COMPLIANT |
| OpenCode Unregistration After Plugin Uninstall | Unregistration skipped on uninstall skip | Manual `runUninstall(["plugin"])` skip harness returned `status: "skipped"` and left OpenCode plugin array unchanged | ✅ COMPLIANT |
| Apply Upgrade | Successful repo upgrade (git-pull) | `tests/upgrade-mode.test.ts` → `repo config dispatches to repo upgrade path`; repo harness returned git-SHA versions, but no divergent-remote `git pull` was executed | ⚠️ PARTIAL |
| Apply Upgrade | Successful binary upgrade (download + replace `~/.local/bin/cyberpunk`) | Manual binary-upgrade success harness with mocked release/download responses and temp HOME | ✅ COMPLIANT |
| Apply Upgrade | Binary already current — `up-to-date`, no modifications | Manual binary-upgrade up-to-date harness with latest tag `v1.1.0` | ✅ COMPLIANT |
| Apply Upgrade | Binary download failure — `error`, no local changes | Manual binary-upgrade failure harness with download `HTTP 500` | ✅ COMPLIANT |
| Apply Upgrade | Config preserved during upgrade (either mode) | Binary success harness preserved user fields (`installMode`, `pluginRegistered`, `repoUrl`) but `runUpgrade()` still adds `lastUpgradeCheck`, so config is not byte-identical before/after | ⚠️ PARTIAL |
| Install Mode Default | Unknown install mode defaults safely | `tests/upgrade-mode.test.ts` → `missing installMode — loadConfig defaults to 'repo' in memory` | ✅ COMPLIANT |
| Config Data Model | Binary install sets `"binary"` | `install.sh` success harness persisted `installMode: "binary"`; failure/readback harnesses exit non-zero on persistence problems | ✅ COMPLIANT |
| Config Data Model | Repo install sets `"repo"` | Manual `runInstall(["plugin"])` harness | ✅ COMPLIANT |
| Config Data Model | Missing installMode defaults to `"repo"` | `tests/upgrade-mode.test.ts` → `missing installMode — loadConfig defaults to 'repo' in memory` | ✅ COMPLIANT |
| Version Bump | Version bumped for release | `package.json` inspection → `"version": "1.1.0"` | ✅ COMPLIANT |

**Compliance summary**: 18/20 scenarios compliant, 0 failing, 2 partial

---

### Correctness (Static — Structural Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Register Plugin in OpenCode Config | ✅ Implemented | `src/opencode-config.ts` appends only `./plugins/cyberpunk`, dedupes, initializes missing `plugin` array, warns on missing/invalid config, and writes atomically. |
| Unregister Plugin from OpenCode Config | ✅ Implemented | `src/opencode-config.ts` removes only the cyberpunk entry and preserves other plugin entries. |
| OpenCode Registration After Plugin Install | ✅ Implemented | `src/components/plugin.ts` calls `registerCyberpunkPlugin()` only after successful file-copy path and persists `pluginRegistered` from the helper result. |
| OpenCode Unregistration After Plugin Uninstall | ✅ Implemented | `src/components/plugin.ts` calls `unregisterCyberpunkPlugin()` only after successful delete path; uninstall skip returns before helper invocation. |
| Apply Upgrade | ✅ Implemented | `src/commands/upgrade.ts` dispatches by `installMode`, keeps repo git flow, and adds release-check/download/replace logic for binary installs. |
| Install Mode Default | ✅ Implemented | `src/config/load.ts` normalizes absent `installMode` to `repo` in memory without forcing migration. |
| Config Data Model | ✅ Implemented | `src/config/schema.ts` adds `installMode` and `pluginRegistered`; `src/config/save.ts` now allows new top-level keys; `install.sh`, `src/commands/config.ts`, and `src/index.ts` now fail correctly on config persistence errors. |
| Version Bump | ✅ Implemented | `package.json` is bumped from `1.0.1` to `1.1.0`. |

---

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| OpenCode config edits via shared helper | ✅ Yes | `src/opencode-config.ts` exists and is used from `src/components/plugin.ts`. |
| Install mode persisted/defaulted from config | ✅ Yes | `install.sh` persists `binary`; repo installs stamp `repo`; `loadConfig()` defaults missing values to `repo`. |
| Binary version check compares local version to latest release | ✅ Yes | `getAppVersion()`, `fetchLatestReleaseTag()`, and `compareSemver()` implement the chosen flow. |
| Binary replacement uses temp file + rename | ✅ Yes | `downloadAndReplaceBinary()` writes `cyberpunk.tmp`, chmods it, then renames it over the target binary. |
| File changes match design scope | ⚠️ Deviated | Core implementation matches the approved design, but the current worktree also contains unrelated modifications (`.gitignore`, `cyberpunk-plugin.ts`, `tests/plugin.patch.test.ts`, unrelated openspec files). |

---

### Issues Found

**CRITICAL** (must fix before archive):
None.

**WARNING** (should fix):
1. No runtime proof of an actual divergent-remote repo upgrade (`git pull` producing `status: "upgraded"`) was executed during verification; evidence confirms dispatch to the git path and up-to-date repo behavior only.
2. The config-preservation scenario is only partial: successful binary upgrades preserve user fields but still mutate `lastUpgradeCheck`, so `config.json` is not byte-identical before/after.
3. The working tree remains broader than this change's design scope, with unrelated in-repo modifications present alongside the approved files.

**SUGGESTION** (nice to have):
1. Add an automated install-script test/harness that runs in CI for success, command failure, and readback-mismatch cases.
2. Add a repo-upgrade harness that exercises an actual newer remote SHA and verifies `status: "upgraded"` after `git pull`.
3. Clarify the spec wording for config preservation if updating `lastUpgradeCheck` is intended behavior.

---

### Verdict
PASS

Previously failing install-mode persistence is now closed: `install.sh` persists `installMode: "binary"`, fails fast on config persistence/readback errors, and the CLI now returns success/failure exit codes that the installer relies on. Full build/test validation passed, with only non-blocking warnings remaining around repo-upgrade runtime coverage, exact config-preservation wording, and unrelated worktree noise.
