# Metrics Viewer Specification

## Purpose

Provide local LLM usage visibility from the OTEL collector file exporter without requiring any remote backend or extra observability stack.

## Requirements

### Requirement: Local Telemetry Source

The system MUST read telemetry from `${HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json` by default, SHOULD read only the primary file for MVP, and MUST NOT require Prometheus, Grafana, SigNoz, Docker, or network services.

#### Scenario: Default file is used

- GIVEN the default telemetry file exists under the active `HOME`
- WHEN the user opens the metrics viewer
- THEN the viewer reads that file as the telemetry source

#### Scenario: File is missing or empty

- GIVEN the default telemetry file is absent or zero bytes
- WHEN the user opens the metrics viewer
- THEN the viewer shows a clear no-data state without failing

### Requirement: Defensive OTEL NDJSON Parsing

The system MUST treat the exporter output as NDJSON OTEL envelopes, MUST continue past malformed lines, and MUST preserve valid records from the same file.

#### Scenario: Malformed line is skipped

- GIVEN a telemetry file contains valid OTEL lines and one malformed JSON line
- WHEN the file is parsed
- THEN the malformed line is reported or counted as skipped
- AND valid lines still contribute to the result

### Requirement: LLM Usage Normalization

The system MUST normalize likely OTEL semantic-convention and plugin-specific fields for prompt or input tokens, completion or output tokens, total tokens, cached tokens when present, cost when present, and model or provider when present.

#### Scenario: Multiple naming conventions map to one summary

- GIVEN telemetry uses mixed attribute names for prompt, completion, total, cached, cost, model, or provider
- WHEN the viewer builds a usage summary
- THEN equivalent fields are merged into one normalized result

### Requirement: Usage-Focused Presentation

The normal viewer output MUST present an aggregate LLM usage summary before recent events, MUST separate summary, recent events, and diagnostic or no-data states clearly, and MUST NOT dump raw OTEL JSON in the normal view.

#### Scenario: Summary is shown before recent events

- GIVEN parsed telemetry contains LLM usage totals and recent events
- WHEN the viewer renders the normal view
- THEN the user sees the summary section before the recent-events section
- AND raw OTEL envelopes are not shown as the primary output

### Requirement: Refresh Status While Visible

While the metrics viewer screen is visible, the system MUST auto-refresh by default every 30 seconds and MUST show a last-updated indicator and/or next-refresh indicator.

#### Scenario: Visible screen refreshes automatically

- GIVEN the metrics viewer screen remains visible with a readable telemetry file
- WHEN 30 seconds elapse after the prior refresh
- THEN the screen refreshes its displayed data
- AND the refresh status indicator is updated

### Requirement: Clear Missing-Usage Messaging

The system MUST distinguish no-data, diagnostic, and valid-but-no-usage states. If telemetry emits no token or cost fields, the viewer MUST show clear unavailable or not-emitted messaging instead of treating the state as a parse failure.

#### Scenario: Valid telemetry has no token or cost fields

- GIVEN a valid OTEL line contains no token or cost attributes
- WHEN the viewer renders results
- THEN the event may still appear in recent events
- AND the summary explains that token or cost data was not emitted

### Requirement: Isolated MVP Verification

Automated verification MUST use `bun:test` with fake `HOME` and state fixtures, and MUST cover missing file, empty file, malformed lines, auto-refresh status, and valid OTEL with and without token or cost fields.

#### Scenario: Tests use fake home state

- GIVEN automated tests execute for metrics viewer behavior
- WHEN telemetry fixtures are created
- THEN all fixture files live under a fake `HOME` tree only
