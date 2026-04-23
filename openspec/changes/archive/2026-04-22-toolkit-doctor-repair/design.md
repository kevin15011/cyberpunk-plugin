# Design: Toolkit Doctor & Repair

## Technical Approach

Add a read-first `doctor` command that mirrors the existing command-dispatch/status pattern, but returns richer health data and optionally runs targeted repairs. The first slice stays narrow: detect config/component drift, report external-tool gaps, and repair only safe local state (patched files, OpenCode registration, routing files, generated assets, and parseable config defaults).

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Command shape | Separate `repair` command vs `doctor --fix` | `cyberpunk doctor [--fix] [--json] [--verbose] [component flags]` | Fits current CLI style (`upgrade --check`), keeps one entry point for inspect/repair, and reuses existing global component filters. |
| Diagnostic contract | Reuse `ComponentStatus` vs add doctor model | Add `DoctorCheck`, `DoctorResult`, `DoctorFixResult`; keep `doctor?()` optional on `ComponentModule` | `status()` is too coarse. Doctor needs per-check IDs, severity, fixability, and repair outcomes without breaking current status/TUI flows. |
| Repair implementation | Call broad `install()` methods vs narrow fix helpers | Extract/reuse narrow helpers inside components | `install()` performs side effects that exceed doctor scope (npm/global installs, downloads). Doctor must repair drift without acting like reinstall. |
| Config inspection | Use `loadConfig()` vs raw non-mutating read | Add raw config health reader | `loadConfig()` auto-creates/normalizes config, which would hide missing/bad config during diagnostics. Doctor must observe first, then optionally repair. |

## Data Flow

```text
parseArgs -> runDoctor(options)
              |
              +-> read config + prerequisites
              +-> component.doctor?(context)
              +-> aggregate checks/result
              +-> if --fix: run safe fixes in order
              +-> formatDoctor(result, --json)
```

Sequence:

```text
CLI -> doctor.ts -> config/openCode readers -> component doctor checks
                                 |                    |
                                 +---- shared facts <-+
doctor.ts --fix -> component fix helpers -> atomic writes -> final summary
```

## Diagnostic Model

`DoctorResult` is command-level output:

```ts
interface DoctorCheck {
  id: string
  component?: ComponentId | "platform" | "config"
  status: "pass" | "warn" | "fail"
  summary: string
  details?: string
  fixable: boolean
}
interface DoctorFixResult {
  checkId: string
  status: "fixed" | "unchanged" | "failed" | "skipped"
  message: string
}
```

`runDoctor()` returns checks, fixes, and a derived summary (`healthy`, `warnings`, `failures`, `fixed`, `remainingFailures`). `--json` prints this object directly; text output groups by component and shows repair lines only when `--fix` is used.

## Safe Repair Flow

Repair only checks marked `fixable=true` and only after the full read phase completes. Order is deterministic:

1. Config shape defaults (parseable JSON only)
2. Plugin patch drift / plugin registration
3. Theme file + `tui.json` activation
4. Sound asset regeneration (only if `ffmpeg` exists)
5. Context-mode routing + MCP block (only if binary already exists)
6. RTK routing + OpenCode plugin registration (only if binary already exists)

Rules:
- No external tool installation in doctor.
- No deletion-based repair.
- Each fix is atomic (`.tmp` + rename where config files are touched).
- Failed fixes do not stop later fixes.
- Malformed JSON in user-managed files is report-only in slice 1.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/index.ts` | Modify | Add `doctor` dispatch and exit-code handling. |
| `src/cli/parse-args.ts` | Modify | Add `doctor` command and `fix` flag. |
| `src/cli/output.ts` | Modify | Add text/JSON doctor formatter. |
| `src/commands/doctor.ts` | Create | Aggregate checks, run safe fixes, compute summary. |
| `src/components/types.ts` | Modify | Add doctor result/check/fix interfaces and optional `doctor()`. |
| `src/components/*.ts` | Modify | Implement component diagnostics and expose narrow repair helpers. |
| `src/config/load.ts` | Modify | Add raw, non-mutating config health read helper. |
| `src/opencode-config.ts` | Modify | Export safe readers/writers needed for registration diagnostics/repair. |

## Interfaces / Contracts

- `ComponentModule.doctor?(ctx: DoctorContext): Promise<DoctorCheck[]>`
- `DoctorContext` carries shared facts already read once (`cyberpunkConfig`, `openCodeConfig`, prerequisite availability, verbose flag).
- Component doctors must be read-only; repair helpers are invoked separately by `doctor.ts`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | arg parsing, doctor summary derivation, formatter | `bun:test` table tests |
| Unit | config/OpenCode health readers and atomic repair helpers | temp-dir filesystem tests |
| Unit | component doctor checks | mocked fs/command availability states |
| Integration | `runDoctor({fix:false/true})` on drift scenarios | temp HOME with fixture files |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Should malformed `~/.config/cyberpunk/config.json` become fixable via backup-and-regenerate in a later slice?
- [ ] Should `doctor` exit non-zero on warnings, or only on remaining failures?
