# SDD Integration Specification

## Purpose

Optional component that owns SDD patching of `sdd-phase-common.md`, doctor checks for Section E/F markers, and preflight validation. Decoupled from the runtime sound plugin.

## Requirements

### Requirement: SDD Integration Component Identity

The system SHALL register `sdd-integration` as a distinct `ComponentId`. It MUST NOT share identity with `opencode-event-sounds` (formerly `plugin`). The component label MUST be `"SDD Integration"`.

#### Scenario: Component registered independently

- GIVEN the component registry is initialized
- WHEN `sdd-integration` is looked up
- THEN it has its own factory, label, and install/uninstall/doctor methods

### Requirement: Owns Section E/F Patching

The `sdd-integration` component SHALL own all patching of `~/.config/opencode/skills/_shared/sdd-phase-common.md`. Only this component MAY apply or modify the `<!-- cyberpunk:start:section-e -->` / `<!-- cyberpunk:end:section-e -->` marker block. The `opencode-event-sounds` component MUST NOT patch this file.

#### Scenario: Install applies Section E/F markers

- GIVEN `sdd-phase-common.md` exists without cyberpunk markers
- WHEN `sdd-integration` install runs
- THEN Section E/F content is injected wrapped in markers

#### Scenario: Patch is idempotent

- GIVEN markers exist with matching content
- WHEN `sdd-integration` install runs
- THEN the file is NOT modified

#### Scenario: Plugin does not patch

- GIVEN `opencode-event-sounds` install runs
- WHEN install completes
- THEN `sdd-phase-common.md` is NOT touched by that component

### Requirement: Opt-In Installation

The system MUST install `sdd-integration` only when explicitly selected via preset inclusion, CLI flag (`--sdd-integration`), or TUI selection. It MUST NOT auto-install alongside `opencode-event-sounds`.

#### Scenario: Not installed by default

- GIVEN a user installs `opencode-event-sounds` only
- WHEN install completes
- THEN `sdd-integration` is NOT installed

#### Scenario: Installed via preset

- GIVEN the `developer-toolkit` preset includes `sdd-integration`
- WHEN the user selects that preset
- THEN `sdd-integration` is installed

### Requirement: SDD Integration Doctor Checks

The `sdd-integration` doctor SHALL verify: (1) `sdd-phase-common.md` exists, (2) Section E/F markers present, (3) marker content matches template. Drift MUST be `fixable: true` with `--fix`.

#### Scenario: Marker drift detected

- GIVEN markers exist but content differs from template
- WHEN `cyberpunk doctor --sdd-integration` runs
- THEN `sdd-integration:patching` shows `fail` with `fixable: true`

#### Scenario: Fix restores markers

- GIVEN `sdd-integration:patching` fails and `--fix` is passed
- WHEN repair executes
- THEN markers are replaced and `fixed: true`

### Requirement: Uninstall Removes Markers

The `sdd-integration` uninstall SHALL remove the managed marker block from `sdd-phase-common.md` while preserving all other content.

#### Scenario: Uninstall cleans markers

- GIVEN markers exist in `sdd-phase-common.md`
- WHEN `sdd-integration` uninstall runs
- THEN the marker block is removed and surrounding content preserved
