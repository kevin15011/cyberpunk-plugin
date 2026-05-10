# Cyberpunk Install Delta

## ADDED Requirements

### Requirement: macOS OpenCode First Gate

The system MUST complete macOS + OpenCode install/status/doctor verification before work proceeds to any other macOS tool or target.

#### Scenario: OpenCode gate passes
- GIVEN the current host is macOS and tool is OpenCode
- WHEN the verification bundle runs
- THEN install/status/doctor/typecheck/tests complete with 0 CRITICAL and 0 WARNING findings

### Requirement: Aesthetic Components Are Opt-In

Normal presets MUST NOT include `theme` or `sounds`. These components MAY be installed by `cyberpunk-full` or by explicit Custom/manual selection.

#### Scenario: Normal preset excludes aesthetics
- GIVEN a user selects `minimal`, `token-saver-general`, `token-saver-dev`, or `developer-toolkit`
- WHEN preset resolution runs
- THEN resolved components exclude `theme` and `sounds`

#### Scenario: Full preset includes aesthetics
- GIVEN a user selects `cyberpunk-full`
- WHEN preset resolution runs
- THEN `theme` and `sounds` may be included with their existing warnings

### Requirement: Deterministic codebase-memory Verification

codebase-memory tests and executable resolution MUST NOT depend on the developer’s real `PATH` containing `codebase-memory-mcp`.

#### Scenario: Missing binary test is isolated
- GIVEN the test creates an empty isolated PATH
- WHEN codebase-memory doctor runs
- THEN it reports missing binary deterministically even if the user has `codebase-memory-mcp` installed globally

### Requirement: TUI Completed Flow Home Shortcut

Completed install, uninstall, repair, doctor, and similar process screens MUST expose a one-key shortcut back to Home/root.

#### Scenario: Completed flow returns home directly
- GIVEN a process screen has completed from nested phases
- WHEN the user presses the documented Home/root shortcut
- THEN the TUI returns directly to Home without requiring repeated Esc presses

### Requirement: Remove OTEL Install Surface

The kit MUST NOT present OTEL, `otel-collector`, telemetry capture, or metrics capture as supported installable features in components, presets, CLI flags/help, doctor/status/preflight, docs, or tests.

#### Scenario: Normal install surfaces omit OTEL
- GIVEN the user views CLI help, presets, preflight, status, doctor, or docs
- WHEN supported install features are listed
- THEN OTEL, `otel-collector`, telemetry plugin registration, and metrics capture are absent

#### Scenario: Legacy OTEL cleanup remains safe
- GIVEN an existing install has marker-managed OTEL env vars, plugin config, collector config, or collector service files
- WHEN uninstall/cleanup guidance or cleanup code runs
- THEN legacy OTEL state is safely removable without advertising OTEL as installable
