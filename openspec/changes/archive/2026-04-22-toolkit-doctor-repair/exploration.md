# Exploration: toolkit-doctor-repair

## Current State

The CLI dispatches commands via a simple switch in `src/index.ts`: `tui | install | uninstall | status | upgrade | config`. Each component module (`plugin`, `theme`, `sounds`, `context-mode`, `rtk`) exposes `install()`, `uninstall()`, and `status()` methods.

**No diagnostic command exists.** The `status` command calls each component's `status()` method, which only reports "installed | available | error" — it does not verify prerequisite tools, file integrity, or configuration consistency. Repair is entirely absent; uninstall/reinstall is the only recovery path.

### Affected Areas

| File | Role | Why Affected |
|------|------|--------------|
| `src/index.ts` | CLI entry point — command dispatch | New `doctor` command needs a dispatch case |
| `src/cli/parse-args.ts` | Arg parsing | `doctor` must be added to `ParsedArgs.command` union and parsed |
| `src/cli/output.ts` | Output formatting | Doctor output needs structured display (check/pass/fail with details) |
| `src/commands/status.ts` | Status collection | `collectStatus` pattern is the model for doctor checks |
| `src/config/schema.ts` | Config schema | Component state model informs what doctor can inspect |
| `src/config/load.ts` | Config I/O | Doctor reads config to know what's installed |
| `src/components/plugin.ts` | Plugin install/uninstall/status + patching | Doctor must verify patching was applied, config registered, binary exists |
| `src/components/theme.ts` | Theme install/uninstall/status | Doctor must verify theme file and tui.json activation |
| `src/components/sounds.ts` | Sounds install/uninstall/status | Doctor must verify ffmpeg availability and .wav files |
| `src/components/context-mode.ts` | context-mode install/uninstall/status + MCP | Doctor must verify npm, ctx binary, MCP config, routing file |
| `src/components/rtk.ts` | RTK install/uninstall/status | Doctor must verify rtk binary, plugin entry, routing file |
| `src/opencode-config.ts` | OpenCode plugin registration | Doctor must check `opencode.json` plugin array |
| `openspec/config.yaml` | SDD project config | New domain added to project context |

---

## Approaches

### 1. Integrated Doctor Command — Full Diagnostics + Auto-Repair Flag

**Add `cyberpunk doctor [--fix] [--json]` as a new top-level command.**

- `doctor` runs all component `status()` checks plus prerequisite/tool checks (ffmpeg, npm, curl, bun availability for binary installs).
- `doctor --fix` attempts auto-repair: re-patch if Section E missing, re-register if plugin not in array, regenerate missing sounds, fix routing files.
- Follows the existing pattern in `status.ts` — iterate all component modules and call a `doctor()` method or collect issues.

**Pros**: Natural CLI extension, reuses component model, clear UX.  
**Cons**: Requires adding `doctor()` method to `ComponentModule` interface (backwards compatible — optional?); `--fix` logic lives in each component or in a central orchestrator.

**Effort**: Medium

### 2. Component-Level Doctor Methods Added to Each Module

Each component gets a new `diagnose(): DiagnosisResult` method that returns detailed pass/fail checks. A central `doctor` command orchestrates and formats results.

**Pros**: Encapsulates diagnostic logic per component; easy to extend.  
**Cons**: Interface change (add `diagnose` to `ComponentModule`); more code per component.

**Effort**: Medium-High

### 3. Standalone Diagnostic Script + Repair Wizard in TUI

Add a `cyberpunk tui --doctor` mode that shows a diagnostic dashboard with auto-fix buttons.

**Pros**: Rich UI for diagnostics.  
**Cons**: Much larger scope; TUI work is out of scope for first slice.

**Effort**: High

---

## Recommended Approach: Option 1 (Integrated Doctor Command)

A new `doctor` command that:
1. Runs each component's `status()` to get baseline.
2. Performs platform-specific checks (ffmpeg for sounds, npm for context-mode, curl for rtk, bun for binary mode).
3. Validates file integrity — checks if plugin source matches what the CLI would install, if Section E patching is applied, if OpenCode registration is correct.
4. With `--fix`: applies corrections in order (patch → register → regenerate → report).
5. Reports structured output (JSON or pretty-printed) showing each check and its result.

**Scope boundaries for first slice:**
- `cyberpunk doctor` — read-only diagnostics (all checks, no auto-repair)
- `cyberpunk doctor --fix` — auto-repair for: re-patch sdd-phase-common, re-register OpenCode plugins, regenerate missing sounds, rewrite routing files
- NOT in scope: interactive TUI doctor, upgrade/reinstall of missing external tools, rollback of broken configs

**High-value checks for WSL/Linux/macOS:**
| Check | Why It Matters |
|-------|---------------|
| ffmpeg availability + sound files exist | Sounds silently fail on Linux if ffmpeg missing |
| Section E patching in `sdd-phase-common.md` | Plugin won't inject ctx_stats without this |
| OpenCode plugin array contains `./plugins/cyberpunk` and `./plugins/rtk` | Registration drift breaks plugin loading |
| context-mode binary available + MCP configured in `opencode.json` | context-mode won't work if MCP not set up |
| `tui.json` theme is "cyberpunk" | Theme deactivation leaves stale config |
| Config file integrity (JSON parseable, installMode set) | Corrupted config breaks upgrade path |
| Binary path exists and is executable (binary install mode) | Stale binary after repo-mode install |
| bun/npm/node availability for binary install detection | Wrong upgrade path chosen if detection fails |

---

## Risks

1. **Patching existing files carries risk of data loss** — Section E patching in `sdd-phase-common.md` is safe (uses markers + replace), but any future file-patching in `--fix` must be equally careful.
2. **Config schema drift** — adding new fields to `CyberpunkConfig` needs migration strategy.
3. **OpenCode config modification** — writing to `~/.config/opencode/opencode.json` could break OpenCode if JSON is malformed — needs atomic write pattern (already used in `opencode-config.ts`).
4. **Platform-specific path assumptions** — `HOME`, `.config`, `.local/bin` are all POSIX-standard but WSL could have edge cases with mounted Windows homes.

---

## Ready for Proposal

**Yes** — the feature is well-defined, the existing component model is a natural fit, and the scope for the first slice is clear. Next step: `sdd-propose` to define intent, approach, and rollback plan.