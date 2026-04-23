# Proposal: Toolkit Doctor & Repair

## Intent

The CLI has no diagnostic or repair capability. When components break (patching drift, registration loss, missing binaries, platform tool gaps), the only recovery is full uninstall/reinstall — wasteful and opaque. Users need `cyberpunk doctor` to detect what's wrong and `cyberpunk doctor --fix` to repair safely.

## Scope

### In Scope
- New `doctor` top-level command: `cyberpunk doctor [--fix] [--json] [--verbose]`
- Per-component diagnostic checks (plugin patching, theme activation, sounds+ffmpeg, context-mode binary+MCP, rtk binary+routing)
- Platform prerequisite checks (ffmpeg, npm/bun, curl availability)
- Config integrity validation (JSON parseable, required fields present)
- OpenCode registration verification (plugin array, MCP config)
- `--fix` auto-repair: re-patch files, re-register plugins, regenerate missing assets, rewrite routing files
- Structured output: pretty-printed table (default) or JSON (`--json`)
- Cross-platform paths (Linux, WSL, macOS)

### Out of Scope
- Interactive TUI doctor dashboard
- Installing missing external tools (ffmpeg, npm, bun) — report only
- Rollback of broken configs (backup + restore)
- tmux or preset integration
- Component reinstall on doctor failure (suggest reinstall instead)

## Capabilities

### New Capabilities
- `doctor`: Diagnostics and auto-repair system — runs health checks across all components and optionally fixes issues

### Modified Capabilities
- `cyberpunk-install`: ComponentModule interface gains optional `doctor(): Promise<DoctorResult>` method; existing modules extended

## Approach

Follow the `collectStatus()` pattern from `src/commands/status.ts`. Add a `doctor()` method (optional on `ComponentModule`) that returns structured check results. A new `src/commands/doctor.ts` orchestrates all checks, formats output, and applies fixes when `--fix` is passed. Each check is a pure function — testable in isolation, safe to run read-only.

Repair ordering: patch → register → regenerate → report. Each repair action is atomic; failures are reported without blocking subsequent repairs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/index.ts` | Modified | Add `doctor` dispatch case |
| `src/cli/parse-args.ts` | Modified | Add `doctor` to command union + `--fix` flag |
| `src/cli/output.ts` | Modified | Add doctor result formatting |
| `src/commands/doctor.ts` | New | Doctor command orchestrator |
| `src/components/types.ts` | Modified | Add `DoctorResult`, `DoctorCheck`, optional `doctor()` |
| `src/components/plugin.ts` | Modified | Add doctor checks (patching, registration) |
| `src/components/theme.ts` | Modified | Add doctor checks (theme file, tui.json) |
| `src/components/sounds.ts` | Modified | Add doctor checks (ffmpeg, wav files) |
| `src/components/context-mode.ts` | Modified | Add doctor checks (binary, MCP config) |
| `src/components/rtk.ts` | Modified | Add doctor checks (binary, routing) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| File patching in --fix corrupts target | Low | Marker-based patching (already used); dry-run log before write |
| OpenCode config write breaks JSON | Low | Atomic write pattern (write tmp → rename); already used in codebase |
| WSL path edge cases | Med | Use `~` expansion via `os.homedir()`; test on WSL |
| False positives on checks | Med | Verbose mode shows raw values; doctor is non-destructive without --fix |

## Rollback Plan

`doctor` without `--fix` is read-only — zero risk. `--fix` repairs are reversible: each fix logs the previous state. If `--fix` causes issues, `cyberpunk uninstall --all && cyberpunk install --all` restores clean state. OpenCode config writes use atomic rename.

## Dependencies

- Bun 1.3.12 runtime (existing)
- No new external packages

## Success Criteria

- [ ] `cyberpunk doctor` runs all checks and reports pass/fail per component + platform prerequisites
- [ ] `cyberpunk doctor --fix` repairs at least: plugin patching drift, OpenCode registration, missing routing files
- [ ] `cyberpunk doctor --json` produces valid JSON output
- [ ] All checks are cross-platform (Linux, WSL, macOS paths)
- [ ] Zero breaking changes to existing commands
