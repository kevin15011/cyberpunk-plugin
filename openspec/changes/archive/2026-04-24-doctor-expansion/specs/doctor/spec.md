# Delta for Doctor

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Structured Output

Default output MUST remain human-readable, grouped by component or platform area, and include an actionable next-step summary for any non-pass results. With `--json`, output MUST remain a valid JSON array of `DoctorResult` objects without schema changes. With `--verbose`, each check MUST include raw diagnostic values.

(Previously: Default output was a flat human-readable table without grouped next-step guidance.)

#### Scenario: JSON output

- GIVEN `--json` flag is passed
- WHEN doctor completes
- THEN stdout is valid JSON matching `DoctorResult[]` schema

#### Scenario: Grouped actionable text output

- GIVEN doctor finishes with warnings or failures in multiple areas
- WHEN `cyberpunk doctor` is run without `--json`
- THEN stdout groups checks by area and ends with clear next actions derived from the reported issues
