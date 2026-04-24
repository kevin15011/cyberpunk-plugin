# Tasks: Tmux TPM Bootstrap

## Phase 1: Foundation — Types & Prerequisites

- [x] 1.1 Add `TmuxBootstrapResult` type (`tpmState`, `pluginsState`, `warnings`) to `src/components/types.ts`
- [x] 1.2 Add `git: boolean` to `DoctorContext.prerequisites` interface in `src/components/types.ts`
- [x] 1.3 Add `git` check via `isOnPath("git")` and include `git` in `PlatformPrerequisites` + `checkPlatformPrerequisites()` in `src/components/platform.ts`

## Phase 2: Core — TPM Bootstrap Helpers in tmux.ts

- [x] 2.1 Add `isGitAvailable()` helper using `execSync("which git")` in `src/components/tmux.ts`
- [x] 2.2 Add `getTpmDir()` helper returning `~/.tmux/plugins/tpm` path
- [x] 2.3 Add `cloneTpm(home: string): boolean` — runs `git clone` into `~/.tmux/plugins/tpm`, catches errors, returns success
- [x] 2.4 Add `runTpmScript(home: string, script: "install_plugins" | "update_plugins"): "ok" | "script-missing" | "failed"` — probes `bin/` then `scripts/` paths, catches errors
- [x] 2.5 Add `bootstrapTpm(home: string): TmuxBootstrapResult` — orchestrates git check → clone → install/update, returns result with warnings
- [x] 2.6 Wire `bootstrapTpm()` into `install()` after config write/skip, surface advisory messages in `InstallResult.message`

## Phase 3: Doctor — Checks & Fix Handlers

- [x] 3.1 Add `tmux:plugins` check to `tmux.doctor()` in `src/components/tmux.ts` — probes plugin readiness, status `pass|warn`, `fixable` when git or TPM exists
- [x] 3.2 Make `tmux:tpm` check `fixable: true` when git is available in `ctx.prerequisites`
- [x] 3.3 Add `tmux:tpm` fix branch in `applyTmuxFix()` in `src/commands/doctor.ts` — calls `cloneTpm()` via tmux module
- [x] 3.4 Add `tmux:plugins` fix branch in `applyTmuxFix()` — calls `runTpmScript(home, "install_plugins")` best-effort, keeps config-before-bootstrap ordering
- [x] 3.5 Ensure `doctor --fix` tmux handler respects `ctx.prerequisites.git` and surfaces advisory results on failure

## Phase 4: Testing

- [x] 4.1 Add tests to `tests/tmux-component.test.ts`: install idempotency with TPM bootstrap, missing-git warning path, clone failure advisory, script failure advisory
- [x] 4.2 Add tests to `tests/tmux-component.test.ts`: `tmux:plugins` doctor check presence and `tmux:tpm` fixable logic
- [x] 4.3 Add tests to `tests/doctor.test.ts` or `tests/doctor-scenarios.test.ts`: tmux fix ordering (config → tpm → plugins), partial fix outcomes, no real HOME mutation

## Phase 5: Documentation

- [x] 5.1 Update `README.md` — replace manual TPM bootstrap instructions with automatic best-effort behavior and troubleshooting for missing git / clone failures
