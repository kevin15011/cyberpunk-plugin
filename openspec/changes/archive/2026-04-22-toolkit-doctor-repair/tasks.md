# Tasks: toolkit-doctor-repair — Slice 1

## Phase 1: Foundation / Type & Config Infrastructure

- [x] 1.1 `src/components/types.ts` — Add `DoctorCheck`, `DoctorResult`, `DoctorFixResult`, `DoctorContext` interfaces; extend `ComponentModule` with optional `doctor(ctx: DoctorContext): Promise<DoctorCheck[]>`
- [x] 1.2 `src/config/load.ts` — Add `readConfigRaw()`: reads config without auto-create/normalize, returns `{ parsed: object | null, raw: string, path: string, error: string | null }`
- [x] 1.3 `src/opencode-config.ts` — Export `readOpenCodeConfig()` and `writeOpenCodeConfig()` helpers needed for registration diagnostics/repair

## Phase 2: Core Doctor Command

- [x] 2.1 `src/commands/doctor.ts` — Create `runDoctor(ctx: DoctorContext, fix: boolean): Promise<DoctorRunResult>`: aggregates checks from platform + all components, runs fixes in order, returns summary
- [x] 2.2 `src/cli/parse-args.ts` — Add `doctor` subcommand and `--fix` / `--json` / `--verbose` flags
- [x] 2.3 `src/cli/output.ts` — Add `formatDoctorText(results, verbose)` and `formatDoctorJson(results)` formatters
- [x] 2.4 `src/index.ts` — Add `doctor` dispatch branch; exit code 0 = all pass, 1 = any fail, mirrors existing command pattern

## Phase 3: Platform & Component Diagnostics (Slice 1 scope only)

- [x] 3.1 `src/components/platform.ts` — Implement `doctor()` checking `ffmpeg`, `npm`/`bun`, `curl` availability on PATH; return warn (not fail) for missing tools
- [x] 3.2 `src/components/plugin.ts` — Implement `doctor()` checking: (1) plugin file exists, (2) patching markers in `sdd-phase-common.md`; expose narrow `applyPatch()` helper
- [x] 3.3 `src/components/config.ts` — Implement `doctor()` verifying config is valid JSON with `version` and `components` fields; expose `repairConfigDefaults()` helper
- [x] 3.4 `src/components/theme.ts` — Implement `doctor()` checking theme JSON exists and `tui.json` has `theme: "cyberpunk"`; expose `activateTheme()` helper

## Phase 4: Verification

- [x] 4.1 Write table-driven unit tests for `parse-args` doctor flags and `runDoctor` summary derivation
- [x] 4.2 Write temp-dir integration tests: `runDoctor({fix:false})` on missing-plugin and missing-ffmpeg scenarios
- [x] 4.3 Run `cyberpunk doctor` and `cyberpunk doctor --fix` against live config, verify exit codes and JSON output schema
