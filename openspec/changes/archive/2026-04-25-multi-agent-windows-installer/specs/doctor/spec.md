# Delta for doctor

## ADDED Requirements

### Requirement: Multi-Agent Diagnostics and Transparent Remediation

Doctor output MUST report platform detection, per-agent state (`installed`, `installable`, `unsupported`, `unknown`), prerequisite blockers, and component compatibility in a transparent way. Read-only doctor and status-style reporting MUST stay non-destructive; `--fix` MUST attempt only explicitly safe repairs and MUST leave unsupported or unknown states advisory.

#### Scenario: Unknown support remains advisory

- GIVEN Claude or Codex support cannot be verified for a component
- WHEN `cyberpunk doctor` is run
- THEN the check is reported as `unknown` or `unsupported` with remediation guidance
- AND no automatic fix is attempted for that check

#### Scenario: Windows blocker reports actionable remediation

- GIVEN a Windows prerequisite required for a selected component is missing
- WHEN `cyberpunk doctor` is run
- THEN doctor reports the blocker, affected command or component, and the next safe remediation step

### Requirement: OpenCode Diagnostics Stay Backward Compatible

The doctor command MUST preserve existing OpenCode diagnostics and repair behavior for supported OpenCode components while adding the new agent and Windows reporting model.

#### Scenario: Existing OpenCode doctor checks still run

- GIVEN OpenCode is the active or detected target
- WHEN `cyberpunk doctor` is run
- THEN the existing OpenCode-oriented checks still appear and behave as before
