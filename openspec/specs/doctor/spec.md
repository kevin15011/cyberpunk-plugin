# Doctor Specification

## Purpose

Diagnostics and auto-repair system. Runs health checks across all installed components and platform prerequisites, reports structured results, and optionally applies safe repairs.

## CLI Interface

```
cyberpunk doctor [--fix] [--json] [--verbose] [components...]
```

| Flag | Description |
|------|-------------|
| `--fix` | Apply repairs for detected issues |
| `--json` | Output results as JSON |
| `--verbose` | Show raw values and repair details |
| `--plugin --theme --sounds --context-mode --rtk --all` | Scope to specific components |

## Data Models

```typescript
interface DoctorCheck {
  id: string           // e.g. "plugin:patching", "platform:ffmpeg"
  label: string
  status: "pass" | "fail" | "warn"
  message: string
  fixable: boolean
  fixed?: boolean      // true after successful --fix
}

interface DoctorResult {
  component: ComponentId | "platform" | "config"
  checks: DoctorCheck[]
}
```

## Requirements

### Requirement: Doctor Command Invocation

The system SHALL register `doctor` as a top-level command. Without `--fix`, all checks MUST be read-only. Exit code MUST be 0 when all checks pass, 1 when any check fails.

#### Scenario: All checks pass

- GIVEN all components are correctly installed and configured
- WHEN `cyberpunk doctor` is run
- THEN exit code is 0 and every check shows `pass`

#### Scenario: At least one check fails

- GIVEN the plugin file is missing
- WHEN `cyberpunk doctor` is run
- THEN exit code is 1 and the plugin file check shows `fail`

### Requirement: Platform Prerequisite Checks

The system MUST verify availability of `ffmpeg`, `npm` (or `bun`), and `curl` on PATH. Missing prerequisites MUST report `warn` (not `fail`) and `fixable: false`.

#### Scenario: ffmpeg missing

- GIVEN ffmpeg is not on PATH
- WHEN `cyberpunk doctor` is run
- THEN the platform.ffmpeg check shows `warn` with message advising installation

### Requirement: Plugin Component Checks

The system SHALL verify: (1) plugin file exists at target path, (2) plugin is registered in OpenCode config, (3) Section E/F patching is applied in `sdd-phase-common.md`.

#### Scenario: Patching drift detected

- GIVEN `sdd-phase-common.md` exists but Section E markers are absent
- WHEN `cyberpunk doctor` is run
- THEN the `plugin:patching` check shows `fail` with `fixable: true`

### Requirement: Theme Component Checks

The system SHALL verify: (1) theme JSON file exists, (2) `tui.json` has `theme: "cyberpunk"`.

#### Scenario: Theme file exists but tui.json deactivado

- GIVEN `cyberpunk.json` exists but `tui.json` has a different theme
- WHEN `cyberpunk doctor` is run
- THEN `theme:activation` shows `fail` with `fixable: true`

### Requirement: Sounds Component Checks

The system SHALL verify ffmpeg availability and that all four `.wav` files exist.

#### Scenario: Partial sound files

- GIVEN only two of four `.wav` files exist
- WHEN `cyberpunk doctor` is run
- THEN `sounds:files` shows `fail` listing missing files with `fixable: true`

### Requirement: Context-Mode Component Checks

The system SHALL verify: (1) npm available, (2) context-mode installed globally, (3) routing file exists, (4) MCP configured in `opencode.json`.

#### Scenario: MCP missing from opencode.json

- GIVEN context-mode is installed but MCP entry is absent
- WHEN `cyberpunk doctor` is run
- THEN `context-mode:mcp` shows `fail` with `fixable: true`

### Requirement: RTK Component Checks

The system SHALL verify: (1) rtk binary on PATH, (2) routing file exists, (3) RTK plugin registered in OpenCode config.

#### Scenario: rtk installed but not registered

- GIVEN rtk binary is on PATH but `./plugins/rtk` is absent from plugin array
- WHEN `cyberpunk doctor` is run
- THEN `rtk:registration` shows `fail` with `fixable: true`

### Requirement: Config Integrity Check

The system SHALL verify the cyberpunk config file is JSON-parseable and contains required fields (`version`, `components`).

#### Scenario: Corrupted config

- GIVEN the config file contains invalid JSON
- WHEN `cyberpunk doctor` is run
- THEN the `config:integrity` check shows `fail` with `fixable: false`

### Requirement: Auto-Repair with --fix

When `--fix` is passed, the system MUST attempt repair for each check where `fixable: true`. Repairs MUST execute in order: patch → register → regenerate → report. Each repair MUST be atomic; a failure MUST NOT block subsequent repairs.

#### Scenario: Fix plugin patching drift

- GIVEN `plugin:patching` fails and `--fix` is passed
- WHEN repair executes
- THEN Section E/F is re-applied and the check shows `fixed: true`

#### Scenario: Fix with partial failure

- GIVEN `plugin:patching` and `context-mode:mcp` both fail
- WHEN patching fix succeeds but MCP fix fails
- THEN `plugin:patching` shows `fixed: true` and `context-mode:mcp` shows `fixed: false`

### Requirement: Tmux Doctor Checks

The doctor command SHALL report tmux health for binary availability, managed config ownership, TPM presence, tmux plugin installation readiness, and `gitmux` availability. Missing managed config MUST be fixable with `--fix`. Missing TPM or plugin readiness SHOULD report warnings in read-only mode. With `--fix`, missing TPM MUST be repairable by bootstrapping TPM when `git` is available, and missing plugin readiness MUST be repairable by invoking tmux plugin installation against the managed config. Missing `git`, TPM clone failure, or plugin installation failure MUST remain advisory results and MUST NOT modify unmanaged tmux content or trigger active-session reload.

(Previously: Doctor reported binary, managed config, TPM, and `gitmux`, but missing TPM stayed warning-only and plugin readiness was not checked.)

#### Scenario: Warn about optional tmux dependencies

- GIVEN tmux is installed and the managed config block exists but TPM, plugin readiness, or `gitmux` is missing
- WHEN `cyberpunk doctor` is run
- THEN tmux dependency checks report `warn` and no repair is attempted without `--fix`

#### Scenario: Fix missing managed tmux block safely

- GIVEN tmux is available but `~/.tmux.conf` lacks the cyberpunk-managed block
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN the managed block is restored without altering unmanaged content and no TPM install or session reload occurs

#### Scenario: Repair missing TPM or plugin readiness with fix mode

- GIVEN tmux is available, the managed block exists, TPM is missing or plugins are not installed, and `git` is available
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN TPM is cloned when needed and tmux plugin installation is attempted for the managed config
- AND unmanaged tmux content remains unchanged

#### Scenario: Leave bootstrap failures advisory during doctor repair

- GIVEN tmux plugin readiness fails and `git` is missing or TPM bootstrap/plugin installation cannot complete
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN doctor reports the tmux bootstrap problem without claiming it was fixed
- AND no active-session reload is attempted

### Requirement: Structured Output

Default output MUST remain human-readable, grouped by component or platform area, and include an actionable next-step summary for any non-pass results. With `--json`, output MUST remain a valid JSON array of `DoctorResult` objects without schema changes. With `--verbose`, each check MUST include raw diagnostic values.

#### Scenario: JSON output

- GIVEN `--json` flag is passed
- WHEN doctor completes
- THEN stdout is valid JSON matching `DoctorResult[]` schema

#### Scenario: Grouped actionable text output

- GIVEN doctor finishes with warnings or failures in multiple areas
- WHEN `cyberpunk doctor` is run without `--json`
- THEN stdout groups checks by area and ends with clear next actions derived from the reported issues

### Requirement: Runtime and Playback Drift Checks

The system SHALL detect high-value runtime drift beyond existing PATH prerequisites. Doctor MUST report OpenCode CLI availability and a platform-appropriate playback dependency check, and SHOULD give platform-aware installation guidance while defaulting to generic Linux guidance when platform detection is uncertain.

#### Scenario: Runtime binary missing

- GIVEN the cyberpunk plugin is installed but the OpenCode CLI is not available to the current runtime
- WHEN `cyberpunk doctor` is run
- THEN a runtime-related check shows `fail` or `warn` with actionable platform-aware guidance

#### Scenario: Playback dependency missing on detected platform

- GIVEN platform detection succeeds and the required playback dependency for that platform is unavailable
- WHEN `cyberpunk doctor` is run
- THEN the platform group reports the missing dependency with the next install action for that platform

### Requirement: Plugin Source Drift Detection

The system SHALL detect when the installed plugin asset no longer matches the bundled plugin source expected by the current cyberpunk release. Source drift MUST be reported as actionable diagnostics and MAY be fixable only through the existing safe plugin repair path.

#### Scenario: Installed plugin drifts from bundled source

- GIVEN the target plugin file exists but differs from the bundled plugin source for the running release
- WHEN `cyberpunk doctor` is run
- THEN doctor reports plugin source drift and identifies the safe next action

### Requirement: Sound File Validity Checks

The system SHALL validate both presence and basic integrity of managed sound files. Missing or invalid managed sound files MUST be reported distinctly, and invalid files MAY reuse the existing safe sound regeneration repair path when `--fix` is used.

#### Scenario: Corrupt managed sound file

- GIVEN all managed sound filenames exist but one file is unreadable or invalid for expected playback use
- WHEN `cyberpunk doctor` is run
- THEN doctor reports that sound as invalid instead of only present

#### Scenario: Fix invalid managed sound file

- GIVEN a managed sound file is invalid and the existing sound regeneration repair path is available
- WHEN `cyberpunk doctor --fix --sounds` is run
- THEN doctor regenerates only through that safe repair path and marks the repaired check `fixed: true`

### Requirement: Doctor Verification Fixture Isolation

Automated verification of doctor behavior MUST establish temporary HOME/config fixtures before loading HOME-sensitive doctor dependencies so diagnostic outcomes are deterministic and independent of suite execution order. Verification MUST NOT read or write the real user cyberpunk config path.

#### Scenario: Doctor tests load against prepared fixtures

- GIVEN doctor verification requires config- or HOME-derived inputs
- WHEN the test harness loads doctor behavior
- THEN the required temporary fixture state is created first
- AND doctor results are computed from that fixture state only

#### Scenario: Doctor verification is order-independent

- GIVEN another test file previously mutated HOME-related process state
- WHEN doctor verification runs in the same suite
- THEN it resets to its own isolated fixture inputs
- AND it produces the same pass/fail results as a standalone run
