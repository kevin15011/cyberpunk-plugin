# Tasks: Doctor Expansion

## Phase 1: Foundation

- [x] 1.1 Add `detail?: { group?: string; nextStep?: string }` to `DoctorCheck` in `src/components/types.ts`
- [x] 1.2 Export `getPlaybackDependency()` and `getPlatformLabel()` helpers in `src/platform/detect.ts` — map `DetectedEnvironment` to playback binary name and human label

## Phase 2: Core Checks

- [x] 2.1 Add `platform:opencode` check in `src/components/platform.ts` — detect `opencode` binary on PATH, set `detail.group = "runtime"`, `detail.nextStep` with install guidance
- [x] 2.2 Add `platform:playback` check in `src/components/platform.ts` — use `getPlaybackDependency()` to validate platform-specific playback binary; `detail.group = "runtime"`, `detail.nextStep` per platform
- [x] 2.3 Add `plugin:source-drift` check in `src/components/plugin.ts` doctor hook — compare installed plugin file content against `PLUGIN_SOURCE`; `fixable: true` only when target is managed install path
- [x] 2.4 Add sound validity checks in `src/components/sounds.ts` doctor hook — for each `SOUND_FILE`, verify presence AND minimal WAV header integrity (first 4 bytes = "RIFF"); report `sounds:invalid` with `fixable: true` when ffmpeg available

## Phase 3: Wiring & Output

- [x] 3.1 Wire new platform checks (`opencode`, `playback`) into `collectPlatformChecks()` in `src/commands/doctor.ts`
- [x] 3.2 Add `applyPluginDriftFix()` handler in `src/commands/doctor.ts` — re-install plugin from `PLUGIN_SOURCE` only when target is managed path
- [x] 3.3 Add `applySoundValidityFix()` handler in `src/commands/doctor.ts` — delegate to existing sound regeneration for invalid managed files only
- [x] 3.4 Upgrade `formatDoctorText()` in `src/cli/output.ts` — group checks by `detail.group` or component, render section headers, append "Next actions" summary derived from non-pass `detail.nextStep` values; keep `formatDoctorJson()` unchanged

## Phase 4: Tests

- [x] 4.1 Test runtime/playback checks: `opencode` missing returns `warn`/`fail` with platform-aware nextStep; playback missing reports per-platform guidance — in `tests/doctor.test.ts`
- [x] 4.2 Test plugin source drift: matching source → pass; modified file → fail with `fixable: true`; non-managed path → `fixable: false` — in `tests/doctor-scenarios.test.ts`
- [x] 4.3 Test sound validity: valid WAV → pass; empty/missing header → `sounds:invalid` with `fixable: true`; `--fix` regenerates only invalid managed files — in `tests/doctor-scenarios.test.ts`
- [x] 4.4 Test grouped text output: multiple non-pass checks produce section headers and "Next actions" block; `--json` output remains valid `DoctorResult[]` — in `tests/doctor-scenarios.test.ts`
