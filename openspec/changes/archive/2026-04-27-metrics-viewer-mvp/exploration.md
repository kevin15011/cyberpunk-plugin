# Exploration: metrics-viewer-mvp

## Current State

The project already has a complete OTEL telemetry pipeline:

- **`src/components/otel.ts`** — Registers the OpenCode OTEL plugin, writes env vars (`OPENCODE_OTLP_ENDPOINT=http://localhost:4317`) to shell profiles. Pure helpers exported for testing.
- **`src/components/otel-collector.ts`** — Downloads `otelcol-contrib` binary, writes collector config with a **file exporter** that outputs to `${env:HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json`. Config includes OTLP receivers on gRPC:4317 and HTTP:4318, with pipelines for traces, metrics, and logs. File exporter has rotation (10MB max, 3 backups). Sets up systemd --user service or fallback bash script.
- **Collector config format** (line 323-351 of `otel-collector.ts`):
  ```yaml
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 127.0.0.1:4317 }
        http: { endpoint: 127.0.0.1:4318 }
  exporters:
    file:
      path: ${env:HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json
      rotation: { max_megabytes: 10, max_backups: 3 }
  service:
    pipelines:
      traces: { receivers: [otlp], exporters: [file] }
      metrics: { receivers: [otlp], exporters: [file] }
      logs: { receivers: [otlp], exporters: [file] }
  ```

The file exporter writes OTLP JSON format (one JSON object per line, NDJSON). Each line is a `ResourceMetrics`, `ResourceSpans`, or `ResourceLogs` protobuf-serialized-to-JSON envelope.

No Prometheus, Grafana, SigNoz, or Docker-based visual backend exists. The user chose **MVP: portable metrics-viewer only**.

## Affected Areas

| File | Why affected |
|------|-------------|
| `src/components/types.ts` | May need new types for parsed telemetry data |
| `src/config/schema.ts` | New `ComponentId` for `metrics-viewer` |
| `src/cli/parse-args.ts` | Add `metrics-viewer` to `VALID_COMPONENTS`, add `--metrics-viewer` flag |
| `src/cli/output.ts` | Add formatting for metrics-viewer output |
| `src/commands/status.ts` | Add `getMetricsViewerComponent()` to `ALL_COMPONENTS` |
| `src/index.ts` | Add `metrics` or `metrics-viewer` command case |
| `src/tui/types.ts` | Add `metrics-viewer` to `RouteId`, new screen state in `TUIState` |
| `src/tui/app.ts` | Add `metricsViewerScreen` to `getScreen()` switch |
| `src/tui/screens/metrics-viewer.ts` | **NEW** — TUI screen for displaying metrics |
| `src/components/metrics-viewer.ts` | **NEW** — Component module (install/uninstall/status/doctor) |
| `tests/metrics-viewer.test.ts` | **NEW** — Tests with fake HOME |

## Approaches

### Approach 1: CLI command + TUI screen (recommended)

Add a `metrics` command (`cyberpunk metrics`) that reads the telemetry JSON file, parses it, and displays a summary table in the terminal. Also add a `metrics-viewer` TUI screen accessible from the home menu for interactive viewing with auto-refresh.

- **Pros**: Follows existing patterns (every feature has both CLI and TUI paths). Reuses component architecture (install/uninstall/status/doctor). Fits naturally into the existing command-dispatch + TUI navigation model.
- **Cons**: Requires new component registration, new screen, new command.
- **Effort**: Medium

### Approach 2: CLI command only

Add only a `cyberpunk metrics` command. No TUI integration.

- **Pros**: Simplest implementation. No TUI state changes needed.
- **Cons**: Loses the interactive experience that defines the cyberpunk TUI. User would need to manually re-run the command to see updates.
- **Effort**: Low

### Approach 3: TUI panel only

Add only a TUI screen, no standalone CLI command.

- **Pros**: Tight integration with the existing TUI flow.
- **Cons**: Breaks the pattern where every feature has a CLI path. Cannot be scripted or used in CI.
- **Effort**: Low-Medium

### Approach 4: Extend existing `status` command

Add metrics info to the existing `cyberpunk status` output.

- **Pros**: No new command needed.
- **Cons**: Status is about component installation state, not runtime telemetry data. Would conflate two different concerns. Status already shows all 10 components — adding metrics would make it unwieldy.
- **Effort**: Low (but wrong abstraction)

## Recommendation

**Approach 1: CLI command + TUI screen.**

Rationale:
- Matches the project's established pattern: every component has a `ComponentModule` (install/uninstall/status/doctor), a CLI command, and a TUI screen.
- The `metrics-viewer` component would be a lightweight addition that reads the existing telemetry file — no new infrastructure needed.
- CLI path enables scripting (`cyberpunk metrics --json` for piping).
- TUI screen enables interactive viewing with auto-refresh (poll the file every N seconds).

## Minimum Useful Visual Output

For MVP, the metrics-viewer should display:

1. **File status**: path, size, last-modified, whether collector is running
2. **Metric count summary**: total metrics, traces, logs entries in the file
3. **Top metrics by name**: sorted by count or most recent
4. **Recent entries**: last 10-20 telemetry entries with timestamp, resource name, metric/trace/log type

Format: terminal table with color coding (existing `src/tui/theme.ts` provides `cyan`, `green`, `red`, `yellow`, `gray`, `bold`, `pink`).

## OTEL File Exporter Input Format

The file exporter writes **NDJSON** (newline-delimited JSON). Each line is a JSON object representing one of:
- `resourceMetrics` — OTLP MetricsData serialized to JSON
- `resourceSpans` — OTLP TracesData serialized to JSON
- `resourceLogs` — OTLP LogsData serialized to JSON

The file rotates at 10MB with 3 backups (`.1`, `.2`, `.3`).

**Absent file**: File may not exist if collector has never run or state directory was never created. Must handle gracefully — show "No telemetry data yet" message.

**Empty file**: File exists but has zero bytes. Same handling as absent.

**Corrupt file**: Partial writes or truncated JSON lines. Must skip malformed lines and continue parsing valid ones.

**Rotation files**: Backups at `opencode-telemetry.json.1`, `.2`, `.3`. MVP can read only the primary file; rotation support is a future enhancement.

## Testing Approach

Follow the existing test pattern from `tests/otel.test.ts` and `tests/otel-collector.test.ts`:

1. **Fake HOME**: Use `tmpdir()` + unique timestamp to create isolated temp directory. Set `process.env.HOME = TEMP_HOME` in `beforeEach`, restore in `afterEach`.
2. **Fake telemetry files**: Write synthetic NDJSON files to `${TEMP_HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json` with known content.
3. **Pure helpers**: Extract parsing logic into pure functions (no side effects) — test them directly without mocking.
4. **Edge cases**: Test absent file, empty file, malformed JSON, rotation files, large files.
5. **Run with**: `bun test tests/metrics-viewer.test.ts`

Example test structure:
```typescript
describe("metrics-viewer: parseTelemetryFile", () => {
  test("returns empty array for absent file", ...)
  test("returns empty array for empty file", ...)
  test("skips malformed lines, parses valid ones", ...)
  test("extracts metric names and counts", ...)
})
```

## Risks and Constraints

1. **OTLP JSON format complexity**: The protobuf-to-JSON serialization is verbose and nested. Parsing requires understanding the OTLP data model (ResourceMetrics → ScopeMetrics → Metric → DataPoints). **Mitigation**: Start with a minimal parser that extracts only the fields needed for display (metric name, timestamp, value). Ignore deeply nested attributes.

2. **File rotation**: The collector rotates files at 10MB. If the viewer only reads the primary file, it may miss data in backups. **Mitigation**: MVP reads only the primary file. Document this limitation. Rotation support can be added later.

3. **Large files**: A 10MB NDJSON file could have thousands of lines. Reading and parsing synchronously would block the TUI. **Mitigation**: Use streaming line-by-line parsing (Bun's `File.stream()` or `readline`). For CLI, read all at once (acceptable for one-shot output).

4. **No real-time streaming**: The file exporter is batch-based, not streaming. There's inherent latency between a metric being generated and appearing in the file. **Mitigation**: Document this. For MVP, poll the file every 2-3 seconds in TUI mode.

5. **Component registration overhead**: Adding a new component requires changes to schema.ts, parse-args.ts, status.ts, and potentially presets. **Mitigation**: The `metrics-viewer` component is optional — it doesn't need to be in any preset. Users can install it explicitly with `cyberpunk install --metrics-viewer`.

6. **Binary size**: The compiled binary (`bun build --compile`) will grow with new code. **Mitigation**: The metrics-viewer is pure TypeScript with no new dependencies — minimal size impact.

## Ready for Proposal

**Yes.** The exploration is complete. The recommended approach (CLI command + TUI screen as a new component) is well-scoped for an MVP and follows all existing patterns in the codebase. The next step is `sdd-propose` to create a formal change proposal with scope, approach, and rollback plan.
