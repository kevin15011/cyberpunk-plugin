# Design: Metrics Viewer MVP

## Technical Approach

Add a self-contained `metrics-viewer` module that reads `${HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json`, parses bounded NDJSON into normalized LLM usage data, and renders a clear summary-first view for CLI and TUI. The TUI will refresh automatically while the metrics route is active using the existing raw-mode repaint loop plus a route-scoped timer; CLI gets normal one-shot output and, if needed for parity, `metrics --watch --interval 30` as a pragmatic non-TUI fallback. Normal display MUST show cards/sections, tables, and diagnostics—not raw OTEL JSON.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Module shape | `src/components/metrics-viewer.ts` owns types, pure extraction, bounded loader, summary projection, and formatter helpers | Split parser/model/formatters now | Current components are compact modules; pure functions still keep tests focused. |
| TUI refresh | Add metrics state plus a route-scoped `setInterval` in `runTUI`; default `refreshIntervalMs = 30_000`; refresh only when `state.route.id === "metrics-viewer"` and not paused | Convert all screens to reactive framework; no refresh | Existing TUI is event-loop/repaint based, not naturally reactive, but already supports async doctor/upgrade loads and `clearScreen()`/`writeLines(view(state))`. A scoped timer is minimal and satisfies active-screen auto-refresh. |
| Controls | Metrics screen supports `r` manual refresh, `p` pause/resume, `Esc/q` exit/back; status line shows last updated and next refresh/paused/loading/error | Timer without controls | User needs confidence data is fresh and a way to stop background reads. |
| Layout | Render top summary cards/sections, then recent events list/table, then diagnostics | Dump normalized object or OTEL JSON | Clear visualization is the goal; diagnostics expose malformed/no-field counts without clutter. |
| Parsing | Read primary NDJSON only, cap bytes/events, skip malformed lines with counters | Full OTEL explorer or rotated files | Matches MVP and protects the TUI from 10MB rotation limits. |

## Data Flow

```text
CLI `metrics` ───────────────┐
CLI `metrics --watch` ─ loop ─┼─→ loadMetricsViewerData(path?) → parseOtelNdjson → normalize
TUI metrics route ─ timer/r ─┘           │
                                         └─→ summary cards → recent events → diagnostics
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/metrics-viewer.ts` | Create | Types, path resolver, capped file reader, pure parser/normalizer, refresh metadata helpers. |
| `src/tui/screens/metrics-viewer.ts` | Create | Render summary cards for tokens/cost/requests/models, recent events, diagnostics, and controls/status line. |
| `src/tui/types.ts` | Modify | Add `metrics?: MetricsScreenState` with data, loading/error, paused, lastUpdatedAt, nextRefreshAt, intervalMs. |
| `src/tui/app.ts`, `src/tui/router.ts`, `src/tui/screens/home.ts` | Modify | Register `metrics-viewer` route and navigation. |
| `src/tui/index.ts` | Modify | Start/clear metrics refresh timer based on active route; load on entry, on interval, and on `r`; repaint after async loads. |
| `src/cli/parse-args.ts`, `src/index.ts`, `src/cli/output.ts` | Modify | Add `metrics`, optional `--watch`, `--interval <seconds>`, text/JSON formatters; keep one-shot default. |
| `src/config/schema.ts`, `src/components/types.ts`, `src/components/registry.ts`, `src/commands/status.ts` | Modify | Register `metrics-viewer` component label/capability/status. |
| `tests/metrics-viewer.test.ts` | Create | Red-first bun:test coverage for parser, layout formatter, refresh state, CLI flags, and TUI route. |

## Interfaces / Contracts

```ts
export interface UsageSummary { inputTokens?: number; outputTokens?: number; totalTokens?: number; cachedTokens?: number; costUsd?: number; requestCount: number; eventCount: number; models: Record<string, number>; providers: Record<string, number>; malformedLines: number; recordsWithoutUsage: number; bytesRead: number; truncated: boolean }
export interface RecentLlmEvent { timestamp?: string; kind: "metric" | "log" | "span" | "unknown"; model?: string; provider?: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; costUsd?: number; name?: string }
export interface MetricsViewerData { path: string; exists: boolean; empty: boolean; summary: UsageSummary; recentEvents: RecentLlmEvent[]; warnings: string[] }
export interface MetricsScreenState { data?: MetricsViewerData; loading: boolean; paused: boolean; lastUpdatedAt?: number; nextRefreshAt?: number; refreshIntervalMs: number; error?: string }
```

Candidate keys remain opportunistic across `llm.*`, `gen_ai.*`, and short names for input/output/total/cached tokens, cost, model, and provider. Text formatters should use `N/A`/`not emitted` for absent fields.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Pure extraction and normalization | Synthetic metric/log/span envelopes with strict TypeScript interfaces. |
| Unit | Missing, empty, malformed, no-usage, cost-present files | Fake `HOME`, temp files, counters, no production code before failing tests. |
| Unit | Clear layout formatter | Assert cards/sections/table headings exist and raw JSON braces/envelopes are absent in text mode. |
| Integration | CLI/TUI route and refresh state | `parseArgs(["metrics", "--watch", "--interval", "30"])`, `getScreen("metrics-viewer")`, pause/manual refresh state transitions. |

## Migration / Rollout

No migration required. Rollout is additive; rollback removes the metrics module, route/command registrations, timer hook, and tests.

## Open Questions

- [ ] Whether `metrics --watch --interval 30` is required for MVP or only kept as fallback if TUI timer proves too invasive.
