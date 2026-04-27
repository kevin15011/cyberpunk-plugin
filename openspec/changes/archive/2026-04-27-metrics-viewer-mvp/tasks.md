# Tasks: Metrics Viewer MVP

## Phase 1: Types & Pure Parser (TDD Red → Green)

- [x] 1.1 RED: Write failing tests in `tests/metrics-viewer.test.ts` for `parseOtelNdjson()` — synthetic metric/log/span envelopes with token, cost, model, provider fields; assert `UsageSummary` aggregation and `RecentLlmEvent[]` extraction.
- [x] 1.2 RED: Add failing tests for candidate key extraction: `gen_ai.usage.input_tokens`, `llm.prompt_tokens`, `gen_ai.usage.output_tokens`, `llm.completion_tokens`, `gen_ai.usage.total_tokens`, `llm.total_tokens`, `gen_ai.usage.cache_tokens`, cached, cost, model (`gen_ai.request.model`, `llm.model`), provider (`gen_ai.provider.name`, `llm.vendor`), plus opencode-style short names.
- [x] 1.3 GREEN: Create `src/components/metrics-viewer.ts` — export `UsageSummary`, `RecentLlmEvent`, `MetricsViewerData`, `MetricsScreenState` interfaces per design. Implement `parseOtelNdjson(lines: string[]): { summary: UsageSummary; recentEvents: RecentLlmEvent[]; warnings: string[] }` with opportunistic key extraction. Make all 1.1–1.2 tests pass.
- [x] 1.4 RED: Add failing tests for missing file, empty file, all-malformed lines, valid-mixed-with-malformed, valid-but-no-token-cost fields. Assert `exists`, `empty`, `malformedLines`, `recordsWithoutUsage` are correct; no-data returns clear diagnostics, not errors.
- [x] 1.5 GREEN: Create `resolveMetricsPath(homeDir?: string): string` and `loadMetricsViewerData(path?: string): MetricsViewerData` in `src/components/metrics-viewer.ts` with capped file reader (cap bytes/events). Make 1.4 tests pass.

## Phase 2: Text/JSON Formatters (TDD)

- [x] 2.1 RED: Write failing tests for `formatMetricsText(data: MetricsViewerData): string` — assert summary cards appear first, recent events after, diagnostics section last; assert NO raw JSON braces/envelopes in output; assert `N/A`/`not emitted` for absent token/cost fields.
- [x] 2.2 RED: Add failing test for `formatMetricsJson(data: MetricsViewerData): string` — assert valid JSON with same contract as `MetricsViewerData`.
- [x] 2.3 GREEN: Implement `formatMetricsText()` and `formatMetricsJson()` in `src/components/metrics-viewer.ts`. Make 2.1–2.2 tests pass.

## Phase 3: CLI Command Integration

- [x] 3.1 RED: Write failing test in `tests/parse-args.test.ts` for `parseArgs(["metrics"])` resolving to `command: "metrics"`, `parseArgs(["metrics", "--json"])`, `parseArgs(["metrics", "--watch", "--interval", "30"])`.
- [x] 3.2 GREEN: Add `"metrics"` to `ParsedArgs.command` union and `COMMAND_ALIASES` in `src/cli/parse-args.ts`; add `--watch`, `--interval` flags; update `VALID_COMMANDS` set. Make 3.1 pass.
- [x] 3.3 Add `"metrics"` case to `src/index.ts` dispatch: call `loadMetricsViewerData()`, format via `formatMetricsText`/`formatMetricsJson`, console.log output. For `--watch`, loop with interval until SIGINT.
- [x] 3.4 Update `formatHelp()` in `src/cli/output.ts` to include `metrics (m)` command, `--json`, `--watch`, `--interval` flags.

## Phase 4: TUI Screen & Route (TDD)

- [x] 4.1 RED: Write failing test for metrics screen render: given `TUIState` with `metrics` state containing `MetricsViewerData`, assert output contains summary section, recent events, status line with last-updated/next-refresh or "paused"/"loading"/"error".
- [x] 4.2 RED: Add failing test for metrics screen update: `r` key triggers manual refresh intent, `p` toggles pause/resume, `Esc`/`q` triggers back intent.
- [x] 4.3 GREEN: Add `"metrics-viewer"` to `RouteId` union in `src/tui/types.ts`; add `metrics?: MetricsScreenState` to `TUIState`; add refresh-related intents to `ScreenIntent` union.
- [x] 4.4 GREEN: Create `src/tui/screens/metrics-viewer.ts` implementing `ScreenModule` — render summary cards, recent events table, diagnostics, controls status line; handle `r`/`p`/`Esc`/`q` keys. Make 4.1–4.2 pass.
- [x] 4.5 Register screen in `src/tui/app.ts` view/update dispatch; add navigation entry in `src/tui/screens/home.ts` for metrics.
- [x] 4.6 Add route-scoped refresh timer in `src/tui/index.ts` — start `setInterval(refreshIntervalMs)` when route is `metrics-viewer` and not paused; clear timer on route change or quit; call `loadMetricsViewerData` on interval, repaint after load.

## Phase 5: Verification & Polish

- [x] 5.1 Run `bun test tests/metrics-viewer.test.ts` — all parser, formatter, screen tests pass.
- [x] 5.2 Run `bun test` (full suite) — no regressions in existing tests.
- [x] 5.3 Run `bunx tsc --noEmit` — typecheck passes with new types.
- [ ] 5.4 Manual: `cyberpunk metrics` with no telemetry file shows clear no-data state; `cyberpunk metrics --json` outputs valid JSON.
- [ ] 5.5 Manual: TUI metrics screen shows summary-first, auto-refreshes, `r`/`p`/`Esc` work.
