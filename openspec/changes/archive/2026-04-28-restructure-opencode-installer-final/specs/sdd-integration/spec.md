# SDD Integration Delta

## ADDED Requirements

### Requirement: OpenCode SDD Readiness Detection

The system MUST detect OpenCode SDD readiness from the actual SDD shared and phase skill files it patches or depends on. Checking only `sdd-phase-common.md` is insufficient.

#### Scenario: Readiness satisfied
- GIVEN all required OpenCode SDD files exist
- WHEN `sdd-integration` status/doctor/install runs
- THEN readiness is satisfied and patching may proceed

#### Scenario: Required SDD asset missing
- GIVEN one or more required SDD skill/shared files are missing
- WHEN status/doctor/install runs
- THEN the result lists the missing paths and MUST NOT report integration as complete

### Requirement: Honest Install Availability

The `sdd-integration` component MUST install only when OpenCode SDD readiness is satisfied. If not ready, install MUST skip or mark unavailable with a clear message.

#### Scenario: Install skipped when not ready
- GIVEN `sdd-phase-common.md` exists but required SDD phase skills are missing
- WHEN `sdd-integration` install runs
- THEN it returns skipped/unavailable and names the missing required assets

### Requirement: Doctor Repair Refreshes Current Diagnostics

After TUI doctor repair completes, the displayed doctor report MUST reflect current diagnostics without requiring the installer to close and reopen.

#### Scenario: Repair refreshes stale doctor report
- GIVEN the doctor screen displays failures that repair can fix
- WHEN the user runs repair from the TUI doctor flow and it completes
- THEN diagnostics are re-run or the report is refreshed before showing the completed state

### Requirement: Canonical codebase-memory MCP Key

OpenCode MCP config MUST use canonical key `codebase-memory`; legacy duplicate key `codebase-memory-mcp` MUST be removed during install/repair/doctor fix while preserving the absolute executable command.

#### Scenario: Duplicate MCP keys are normalized
- GIVEN `opencode.json` contains both `codebase-memory` and `codebase-memory-mcp` pointing to `/Users/kevinlondono/.local/bin/codebase-memory-mcp`
- WHEN install, repair, or doctor fix runs for codebase-memory
- THEN only `codebase-memory` remains and its command still uses `/Users/kevinlondono/.local/bin/codebase-memory-mcp`
