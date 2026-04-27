# Proposal: Metrics Viewer MVP

## Intent

Add a portable `metrics-viewer` for local OTEL file-exported telemetry, prioritizing LLM usage visibility without Prometheus, Grafana, SigNoz, Docker, or network services.

## Scope

### In Scope
- Read `${HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json` NDJSON from the existing collector file exporter.
- Summarize LLM prompt/input, completion/output, total, and cached tokens when present.
- Show reported/estimated cost, model/provider, request/event counts, and recent events when present.
- Provide CLI output and a TUI screen following existing component patterns.
- Gracefully handle missing/empty files, malformed lines, and telemetry with no token/cost fields.

### Out of Scope
- Prometheus/Grafana/SigNoz/Docker or remote telemetry backends.
- Full generic OTEL explorer, charts, alerts, or historical database.
- Reading rotated backup files beyond the primary file.

## Capabilities

### New Capabilities
- `metrics-viewer`: Local OTEL NDJSON telemetry viewer focused on LLM usage metrics and resilient empty/error states.

### Modified Capabilities
- `cyberpunk-tui`: Add metrics command/screen navigation while preserving non-interactive CLI behavior.

## Approach

Implement a lightweight TypeScript parser that reads the primary file line-by-line, skips malformed NDJSON, extracts known LLM usage attribute names opportunistically, and returns typed summary/recent-event data. Add `cyberpunk metrics` plus `metrics-viewer` TUI route/component. Use TDD with fake `HOME`, synthetic OTEL envelopes, and no new runtime dependencies.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/metrics-viewer.ts` | New | Parser, summary model, component module. |
| `src/tui/screens/metrics-viewer.ts` | New | Interactive viewer screen. |
| `src/config/schema.ts` | Modified | Add `metrics-viewer` component id. |
| `src/cli/parse-args.ts` | Modified | Add command/flag parsing. |
| `src/commands/status.ts` | Modified | Register component status. |
| `src/index.ts`, `src/tui/types.ts`, `src/tui/app.ts` | Modified | Dispatch and route metrics UI. |
| `tests/metrics-viewer.test.ts` | New | TDD coverage for parser and edge cases. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OTEL JSON attribute names vary by provider/plugin | Med | Extract common fields; show “not emitted” instead of failing. |
| Large 10MB file blocks TUI | Med | Stream or cap parsed recent events; poll every 2-3s. |
| No token/cost fields emitted | High | Still show file status, counts, model/provider/events if available. |

## Rollback Plan

Remove new metrics-viewer files, route/command registrations, component id additions, and tests. No telemetry pipeline or user data migration is changed.

## Dependencies

- Existing OTEL collector file exporter output.
- Bun/TypeScript only; no new infrastructure.

## Success Criteria

- [ ] `cyberpunk metrics` reports LLM usage summary or clear no-data states.
- [ ] TUI exposes a metrics-viewer screen without breaking existing routes.
- [ ] Tests cover missing, empty, malformed, token/cost-present, and token/cost-absent telemetry.
