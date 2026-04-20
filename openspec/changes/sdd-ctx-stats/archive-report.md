# Archive Report: sdd-ctx-stats

## Summary

The **sdd-ctx-stats** change extended the cyberpunk plugin (`src/components/plugin.ts`) to idempotently inject a **Section E — Session Stats** directive into the shared `sdd-phase-common.md` file during `cyberpunk install --plugin`. This ensures every SDD phase sub-agent automatically reports `ctx_stats` output at the end of its session, making token cost savings visible across all phases.

The implementation added ~80 lines to `plugin.ts`: constants for markers and template, a shared `extractBetweenMarkers()` helper, a `patchSddPhaseCommon()` function with three-way patching logic (fresh install / no-op / mismatch), and integration into the existing `install()` flow. 20 behavioral tests were added across 2 test files covering both the patching logic and the Section E directive behavior.

## Final Task Status

| Task | Description | Status |
|------|-------------|--------|
| 1 | Define `SECTION_E_TEMPLATE` constant | ✅ Complete |
| 2 | Define `START_MARKER` and `END_MARKER` constants | ✅ Complete |
| 3 | Add `extractBetweenMarkers()` helper | ✅ Complete |
| 4 | Add `patchSddPhaseCommon()` function | ✅ Complete |
| 5 | Call `patchSddPhaseCommon()` from `install()` | ✅ Complete |
| 6 | Add unit tests for helper functions | ✅ Complete |
| 7 | Update `PLUGIN_SOURCE` with patching code | ✅ Complete |

**7/7 tasks completed.** All tests pass (53/53), build succeeds, type-check passes.

## Decisions Made During Implementation

1. **Patching lives in `plugin.ts`** — No new component was created. The Section E directive is a behavioral extension of the cyberpunk plugin itself, and adding a standalone component would have required changes to `ComponentId`, `schema.ts`, `install.ts`, and the CLI parser.

2. **Start/end markers for in-file patching** — Two markers (`<!-- cyberpunk:start:section-e -->` / `<!-- cyberpunk:end:section-e -->`) were used instead of a single marker to precisely scope the managed region within a shared file that Gentle AI may update.

3. **No uninstall cleanup** — The plugin's `uninstall()` does not remove Section E. Removing markers would leave confusing state; removing the entire section would break agents that rely on it. The section is harmless and degrades gracefully.

4. **Three-way patching logic** — `patchSddPhaseCommon()` handles: (a) fresh install with heading detection, (b) no-op when markers + content match, (c) replacement when markers exist but content is mismatched.

5. **Silent skip when file missing** — If `sdd-phase-common.md` doesn't exist (Gentle AI not installed), the function returns `false` without error.

## Marker Name Fix

**Original task spec** used markers named `sdd-ctx-stats`:
```
<!-- cyberpunk:start:sdd-ctx-stats -->
<!-- cyberpunk:end:sdd-ctx-stats -->
```

**Final implementation** uses markers named `section-e`:
```
<!-- cyberpunk:start:section-e -->
<!-- cyberpunk:end:section-e -->
```

This change was made during implementation to align the marker name with the actual section being managed (Section E) rather than the internal change ID. The spec, tests, live shared file, and `PLUGIN_SOURCE` all consistently use `section-e`. The `design.md` document contains some historical `sdd-ctx-stats` marker examples that were not updated — this is minor doc drift with no runtime impact.

## Live File Patching

The shared file at `~/.config/opencode/skills/_shared/sdd-phase-common.md` was patched during verification. Section E with `section-e` markers is present at lines 92–111. The patching was confirmed by the verifier runtime, which loaded Section E and reported session stats in the verify report.

## Verification Results

- **Build**: ✅ `bun run build` — exit 0
- **Tests**: ✅ 53 passed / 0 failed / 0 skipped (`bun test`)
- **Type Check**: ✅ `bunx tsc --noEmit` — exit 0
- **Spec Compliance**: 7/7 scenarios compliant
- **Verdict**: **PASS**

## Session Stats (from verification run)

```
context-mode -- session (19 min)
Without context-mode:  29.2 KB in conversation
With context-mode:     10.4 KB in conversation
18.8 KB processed in sandbox (64.2% reduction)
+5m session time gained
```
