# Apply Progress: Metrics Viewer MVP

**Mode**: Standard (strict_tdd: false)
**Batch**: 1 + verification fixes
**Date**: 2026-04-27

## Completed Tasks

- [x] 1.1 Tests for parseOtelNdjson() with synthetic envelopes
- [x] 1.2 Tests for candidate key extraction (gen_ai.*, llm.*, short names)
- [x] 1.3 Implementation: types, parseOtelNdjson() with opportunistic key extraction
- [x] 1.4 Tests for edge cases (missing file, empty, malformed, no usage)
- [x] 1.5 Implementation: resolveMetricsPath(), loadMetricsViewerData() with capped reader
- [x] 2.1 Tests for formatMetricsText() (summary-first, no raw JSON, N/A/not emitted)
- [x] 2.2 Tests for formatMetricsJson() (valid JSON contract)
- [x] 2.3 Implementation: formatMetricsText(), formatMetricsJson()
- [x] 3.1 Tests for parseArgs(["metrics"]), --json, --watch, --interval
- [x] 3.2 Implementation: metrics command, m alias, --watch/--interval flags
- [x] 3.3 Implementation: metrics dispatch in index.ts with --watch loop
- [x] 3.4 Implementation: formatHelp() updated with metrics command and flags
- [x] 4.1 Tests for metrics screen render (summary, events, status line, loading/error/paused)
- [x] 4.2 Tests for metrics screen update (r=refresh, p=pause, Esc/back, ctrl-c=quit)
- [x] 4.3 Implementation: RouteId, MetricsScreenState, ScreenIntent updates in types.ts
- [x] 4.4 Implementation: metrics-viewer.ts screen module with render/update
- [x] 4.5 Implementation: screen registration in app.ts, navigation in home.ts
- [x] 4.6 Implementation: route-scoped 30s refresh timer in tui/index.ts
- [x] 5.1 bun test tests/metrics-viewer.test.ts — 56 pass, 0 fail
- [x] 5.2 bun test (full suite) — 748 tests, 0 fail (after fixing regressions)
- [x] 5.3 bunx tsc --noEmit — passes clean

## Verification Fixes (Batch 2)

### Fix 1: `q` key as back/exit
- Added `q` key handler in metrics screen update → triggers `{ type: "back" }` intent
- Updated all controls hints from `[Esc] Back` to `[Esc/q] Back`
- Test: `'q' key triggers back intent` — passes

### Fix 2: Refresh indicators in all states
- Added `appendRefreshStatus()` helper that renders "Last updated Xs ago" and "Next refresh in Xs" lines
- Applied to: loading, error, no-data-loaded, no-data-file states (when `lastUpdatedAt`/`nextRefreshAt` exist)
- States without prior refresh data (first load) omit indicators correctly
- Tests: 5 new tests covering loading/error/no-data states with and without refresh data

### Fix 3: Behavioral/fake-timer tests for auto-refresh
- Exported `loadMetricsDataHelper` from `src/tui/index.ts` for testability
- Tests verify:
  - Route entry sets loading state with correct interval
  - `loadMetricsDataHelper` sets `lastUpdatedAt` and `nextRefreshAt` on success
  - Paused state clears `nextRefreshAt`
  - Resume re-enables `nextRefreshAt`
  - Router clears metrics state on route leave
  - Interval callback guard skips when paused or wrong route
  - Simulated interval refresh updates timestamps

### Test Results
- `bun test tests/metrics-viewer.test.ts` — 74 pass, 0 fail, 179 expect calls
- `bun test` (full suite) — 767 pass, 0 fail, 1958 expect calls
- `bunx tsc --noEmit` — passes clean

## Pending Tasks

- [ ] 5.4 Manual: cyberpunk metrics with no telemetry file shows clear no-data state
- [ ] 5.5 Manual: TUI metrics screen shows summary-first, auto-refreshes

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/components/metrics-viewer.ts` | Created | Types, pure parser, loader, formatters for LLM usage metrics |
| `src/tui/screens/metrics-viewer.ts` | Created/Modified | TUI screen with render/update, `q` key, refresh indicators in all states |
| `tests/metrics-viewer.test.ts` | Created/Modified | 74 tests: parser, loader, formatters, CLI flags, TUI screen, auto-refresh cycle |
| `src/tui/types.ts` | Modified | Added metrics-viewer RouteId, MetricsScreenState, refresh-metrics intent |
| `src/tui/app.ts` | Modified | Registered metrics screen, handle refresh-metrics intent |
| `src/tui/screens/home.ts` | Modified | Added "Metrics" navigation entry |
| `src/tui/router.ts` | Modified | Reset metrics state on route change |
| `src/tui/index.ts` | Modified | Route-scoped 30s refresh timer, metrics data loading, exported loadMetricsDataHelper |
| `src/cli/parse-args.ts` | Modified | Added metrics command, m alias, --watch, --interval flags |
| `src/cli/output.ts` | Modified | Updated formatHelp() with metrics command and flags |
| `src/index.ts` | Modified | Added metrics command dispatch with --watch loop |
| `tests/tui-screens.test.ts` | Modified | Updated quit cursor index, added metrics nav test |

## Deviations from Design

- Used ASCII `[!]` instead of unicode `⚠` for warning symbols (TUI copy standards test requires ASCII-only).
- The design listed `src/config/schema.ts`, `src/components/types.ts`, `src/components/registry.ts` in file changes — these were NOT modified per the constraint that metrics-viewer MUST NOT be added to ComponentId, COMPONENT_IDS, or registry.
- Added `--metrics` flag as an alternative to positional `metrics` command (consistent with other commands).
- Added `q` as back/exit key alongside Esc (verify fix, consistent with TUI patterns).

## Issues Found

- TUI copy standards test required ASCII-only symbols — replaced `⚠` with `[!]`.
- Home screen menu index shift — adding "Metrics" entry moved "quit" from index 5 to 6; updated tui-screens test.
- Metric envelope parsing initially didn't map metric name to data point value — fixed.
- `hasUsage` check initially excluded cachedTokens — fixed to include it.

## Key Design Decisions

1. **Module is read-only**: metrics-viewer is NOT registered in ComponentId, COMPONENT_IDS, DEFAULT_COMPONENTS, install/uninstall flows, or component registry.
2. **Metric name→value mapping**: Detect OTLP metric objects and map metric name to data point value.
3. **Timer is route-scoped**: 30s interval starts on metrics-viewer navigation, stops on route change/quit/pause.
4. **--watch CLI fallback**: `cyberpunk metrics --watch --interval 30` provides non-TUI auto-refresh.
5. **Refresh indicators in all states**: loading/error/no-data states show "Last updated" and "Next refresh" when prior refresh data exists.
6. **`q` key support**: Added as back/exit key alongside Esc, consistent with common TUI patterns.
