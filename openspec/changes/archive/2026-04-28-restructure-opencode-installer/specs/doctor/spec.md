# Delta for Doctor

## MODIFIED Requirements

### Requirement: Plugin Component Checks

The system SHALL verify: (1) plugin file exists at target path, (2) plugin is registered in OpenCode config. The system MUST NOT check or apply Section E/F patching — that is owned by `sdd-integration`.

(Previously: Plugin doctor also checked Section E/F patching in `sdd-phase-common.md`.)

#### Scenario: Plugin file and registration pass

- GIVEN plugin file exists and is registered
- WHEN `cyberpunk doctor` runs
- THEN `plugin:file` and `plugin:registration` show `pass`
- AND no `plugin:patching` check is emitted

#### Scenario: Patching drift no longer in plugin checks

- GIVEN `sdd-phase-common.md` lacks Section E/F markers
- WHEN `cyberpunk doctor --plugin` runs
- THEN plugin doctor does NOT report a patching check
- AND the issue is reported under `sdd-integration:patching` instead

## ADDED Requirements

### Requirement: Codebase-Memory MCP Executable Path Fix

The codebase-memory doctor SHALL verify the MCP command resolves to an executable absolute path. On macOS/Linux, the bare command name `"codebase-memory-mcp"` MUST be resolved to its full path (e.g., via `which` or `readlink`). If the MCP config uses a bare name that fails at runtime, the check MUST report `fail` with `fixable: true`.

#### Scenario: Bare command name detected

- GIVEN `opencode.json` MCP entry has `"command": ["codebase-memory-mcp"]` (bare name)
- AND `which codebase-memory-mcp` succeeds
- WHEN `cyberpunk doctor --codebase-memory` runs
- THEN the check reports `fail` with message about absolute path requirement
- AND `fixable: true`

#### Scenario: Fix resolves to absolute path

- GIVEN the bare-name check fails and `--fix` is passed
- WHEN repair executes
- THEN the MCP command is updated to the absolute path (e.g., `["/usr/local/bin/codebase-memory-mcp"]`)
- AND `fixed: true`

#### Scenario: Binary not found on PATH

- GIVEN `which codebase-memory-mcp` fails
- WHEN `cyberpunk doctor --codebase-memory` runs
- THEN the check reports `fail` with `fixable: false`
- AND message advises installing codebase-memory-mcp first

### Requirement: SDD Integration Doctor Delegation

The doctor command SHALL include `sdd-integration` in its component iteration. When `sdd-integration` is installed, its doctor checks MUST appear in the combined report. When not installed, it MUST produce an empty result (no checks, no failures).

#### Scenario: SDD integration installed and checked

- GIVEN `sdd-integration` is installed
- WHEN `cyberpunk doctor` runs
- THEN `sdd-integration:patching` appears in results

#### Scenario: SDD integration not installed

- GIVEN `sdd-integration` is not installed
- WHEN `cyberpunk doctor` runs
- THEN no `sdd-integration` checks appear and no failure is reported

### Requirement: Doctor Repair Order Updated

The `--fix` repair sequence MUST include `sdd-integration` patching after plugin registration and before theme repair. The repair order SHALL be: config → plugin registration → sdd-integration patching → theme → sounds → context-mode → rtk → tmux → tui-plugins → codebase-memory.

#### Scenario: SDD integration fix runs in correct order

- GIVEN both `plugin:registration` and `sdd-integration:patching` are fixable
- WHEN `cyberpunk doctor --fix` runs
- THEN plugin registration is repaired before SDD patching
