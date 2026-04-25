# Windows Installer Distribution Specification

## Purpose

Define Windows binary distribution and PowerShell install behavior for cyberpunk.

## Requirements

### Requirement: Windows-Safe Entry Points

The system SHALL provide a Windows executable and a PowerShell installer/update entry point. Windows install, dry-run, status, and doctor flows MUST use shared path and shell abstractions for path resolution, command lookup, quoting, and environment reporting.

#### Scenario: Dry-run stays read-only on Windows

- GIVEN a user invokes a Windows dry-run path
- WHEN execution planning completes
- THEN the output lists the commands, paths, and targets that would be used
- AND no files, PATH entries, or agent configs are modified

#### Scenario: Command resolution uses Windows-safe lookup

- GIVEN a required prerequisite is available only through Windows command resolution rules
- WHEN the installer checks prerequisites
- THEN the prerequisite is detected through the shared abstraction
- AND the same result is reused by status and doctor output

### Requirement: Safe Failure and Remediation

When a Windows install or update cannot proceed, the system MUST fail safely, MUST NOT leave partial configuration changes without disclosure, and MUST report a professional remediation message. Technical output MAY include raw command and path detail without changing the primary guidance.

#### Scenario: Blocked PowerShell execution reports next step

- GIVEN the installer is blocked by execution policy or a missing prerequisite
- WHEN the installer stops
- THEN the result identifies the blocker, affected target, and next remediation step
- AND the output does not claim success or hide skipped work
