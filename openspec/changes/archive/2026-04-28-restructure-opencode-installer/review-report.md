# Review Report: restructure-opencode-installer

**Change**: `restructure-opencode-installer`
**Date**: 2026-04-27
**Phase**: Review (post-apply, pre-verification)
**Verdict**: **FAIL**

## Executive Summary

The boundary split is mostly implemented as intended: runtime sound behavior stays in `plugin`, the new `sdd-integration` component owns Section E/F patching, presets/CLI/preflight/status wiring were updated, and the focused test slice for the restructure passes. However, a blocking defect remains in the codebase-memory doctor repair path: the new `codebase-memory:mcp-path` check detects bare command usage, but `cyberpunk doctor --fix` does not repair it, so the absolute-path fix required by the spec is not behaviorally complete.

## Artifacts Reviewed

- `openspec/changes/restructure-opencode-installer/proposal.md`
- `openspec/changes/restructure-opencode-installer/design.md`
- `openspec/changes/restructure-opencode-installer/tasks.md`
- `openspec/changes/restructure-opencode-installer/specs/**`
- Engram artifact `sdd/restructure-opencode-installer/apply-progress`
- Working-tree source and test changes

## Completeness

- Tasks listed: **22**
- Tasks checked complete in `tasks.md`: **22**
- Incomplete tasks in artifact: **0**

## Execution Evidence

### Focused change tests

Passed:

```bash
bun test tests/sdd-integration.test.ts tests/plugin.patch.test.ts tests/install-presets.test.ts tests/tui-preset-behavior.test.ts tests/codebase-memory.test.ts tests/cli-preset-execution.test.ts tests/component-adapter.test.ts tests/install-routing.test.ts tests/preflight.test.ts tests/tui-screens.test.ts
```

Result: **166 pass / 0 fail**

Additional targeted doctor ordering/ownership tests:

```bash
bun test tests/doctor-scenarios.test.ts -t "sdd-integration"
```

Result: **2 pass / 0 fail**

Plugin registration compatibility tests:

```bash
bun test tests/plugin-registration.test.ts tests/opencode-config.test.ts
```

Result: **24 pass / 0 fail**

### Build / type-check

- `bun run build` → **passed**
- `bun run typecheck` → **failed in this environment** (`tsc: command not found`)

### Broad-suite signal

`bun test` is **not currently green** in this workspace. Observed failures are in upgrade/doctor areas outside the main restructure slice, so the repository is not ready for final verification even though the focused restructure tests pass.

## Correctness Review

| Area | Status | Notes |
|---|---|---|
| SDD ownership split | ✅ | `src/components/plugin.ts` no longer patches `sdd-phase-common.md`; `src/components/sdd-integration.ts` owns patch/install/uninstall/doctor behavior. |
| Plugin runtime behavior | ✅ | Installed `PLUGIN_SOURCE` keeps the sound hooks and drops marker-writing logic; focused tests passed. |
| Presets / CLI / migration | ✅ | New presets, legacy preset aliases, `--sdd-integration`, and `--opencode-event-sounds` wiring are implemented and covered by focused tests. |
| Plugin registration compatibility | ✅ | Registration path remains `./plugins/cyberpunk`; install/uninstall compatibility tests passed. |
| Preflight / status integration | ✅ | `sdd-integration` appears in file-touch/status flows as designed. |
| codebase-memory absolute path install | ⚠️ | Install path resolution exists, but repair behavior is incomplete (see critical finding). |

## Coherence Review

| Topic | Status | Notes |
|---|---|---|
| Design boundary split | ✅ | Implementation matches the design choice to keep internal `plugin` while moving SDD behavior to `sdd-integration`. |
| Spec vs design component identity | ⚠️ | The spec says `opencode-event-sounds` is the canonical `ComponentId`, but the implementation keeps canonical internal id `plugin` and treats `opencode-event-sounds` as an alias (`src/components/types.ts`). This matches the design, not the current spec wording. |
| SDD ownership encapsulation | ⚠️ | `plugin.ts` still re-exports/delegates patch helpers for backward compatibility. Install/doctor behavior is correct, but the API surface still leaks SDD patch capability through the plugin module. |

## Findings

### CRITICAL

1. **`cyberpunk doctor --fix` does not repair `codebase-memory:mcp-path`.**  
   - Evidence in code: `src/components/codebase-memory.ts` emits `codebase-memory:mcp-path` when MCP uses bare `codebase-memory-mcp` and marks it `fixable: true` (lines ~427-438), but `src/commands/doctor.ts` only repairs `codebase-memory:routing` and `codebase-memory:mcp` (lines ~942-949).  
   - Manual behavioral repro: with a temp HOME containing `"command": ["codebase-memory-mcp"]` and a valid executable at `~/.local/bin/codebase-memory-mcp`, `runDoctor({ fix: true, components: ["codebase-memory"] })` returns a `codebase-memory:mcp-path` fix with status **`skipped`** and leaves the command unchanged.  
   - Spec impact: violates Doctor scenarios **“Bare command name detected”** + **“Fix resolves to absolute path”** in `openspec/changes/restructure-opencode-installer/specs/doctor/spec.md`.

### WARNING

1. **Spec/design/implementation contract is not fully aligned for the runtime component id.**  
   The design intentionally preserved internal `plugin`, but the spec still states `opencode-event-sounds` is the canonical `ComponentId`. Archive should not proceed with contradictory contract language.

2. **The new codebase-memory repair scenario lacks direct regression coverage.**  
   `tests/codebase-memory.test.ts` covers install/status/doctor pass/fail, but no test currently proves that `codebase-memory:mcp-path` is repaired to an absolute path during `doctor --fix`.

3. **Configured type-check command is not reproducible in the current environment.**  
   `bun run typecheck` failed with `tsc: command not found`, so final verification still needs a clean dependency-installed run.

## Recommended Next Step

Return to **sdd-apply** to:

1. add a repair path for `codebase-memory:mcp-path` that rewrites bare MCP commands to absolute paths,
2. add a regression test for that repair behavior,
3. reconcile spec wording vs the retained internal `plugin` id,
4. rerun review/verification once `bun run typecheck` is reproducible.

## Review Outcome

**FAIL** — the change is close, but the codebase-memory doctor repair flow is not compliant with the spec yet.
