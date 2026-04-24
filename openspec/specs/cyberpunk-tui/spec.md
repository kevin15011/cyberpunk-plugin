# Cyberpunk TUI Specification

## Purpose

Interactive CLI `cyberpunk` with a visual TUI that lets users select, install, uninstall, and inspect cyberpunk environment components without forcing anything on OpenCode load.

## CLI Interface

```
cyberpunk [command] [flags]
```

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| _(none)_ | — | Opens interactive TUI |
| `install` | `i` | Install flow (TUI or flag-driven) |
| `uninstall` | `u` | Uninstall flow (TUI or flag-driven) |
| `status` | `s` | Print installed/available state |
| `upgrade` | `up` | Pull and apply latest version |
| `config` | `c` | Read/write config values |
| `help` | `h` | Print help |

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON output |
| `--verbose` | Debug logging to stderr |
| `--help` | Print help |

## Data Models

```typescript
interface Component {
  id: "plugin" | "theme" | "sounds" | "context-mode"
  label: string
  status: "installed" | "available" | "error"
  error?: string
}

interface TUIState {
  components: Component[]
  selected: Set<string>   // ids with checkbox toggled
  cursor: number          // focused row
}
```

## Requirements

### Requirement: Interactive TUI Launch

When invoked with no arguments, the system SHALL render a full-screen navigable TUI shell with shared navigation chrome and routes for home, install, uninstall, status, task progress, and results/detail views.

#### Scenario: Open shell home screen

- GIVEN components have any installed or available state
- WHEN the user runs `cyberpunk` with no arguments
- THEN the TUI opens on a home screen that offers install, uninstall, and status navigation
- AND the shell remains active until the user explicitly leaves it

#### Scenario: Quit shell

- GIVEN the shell is open on any screen
- WHEN the user presses the shell quit control
- THEN the TUI exits cleanly with exit code 0

### Requirement: Component Selection

The TUI MUST let the user enter install or uninstall screens, change component selections there, and confirm the action from that screen. The system SHALL NOT start an interactive task if no component is selected.

#### Scenario: Select components from install screen

- GIVEN the user is on the install screen and "sounds" is not selected
- WHEN the user selects sounds and confirms the install action
- THEN the shell starts an install task for the selected components only

#### Scenario: Reject empty interactive action

- GIVEN the user is on an install or uninstall screen
- WHEN the user confirms with zero selected components
- THEN the shell shows an empty-selection message and remains on that screen

### Requirement: Non-Interactive Flags

The CLI MUST preserve the existing non-interactive command and flag behavior for scripted usage, and those invocations SHALL bypass the interactive shell entirely.

#### Scenario: Run non-interactive install path

- GIVEN user runs a non-interactive install invocation such as `cyberpunk --install --plugin`
- WHEN argument parsing resolves the request
- THEN only the requested command workflow runs and no interactive shell is rendered

#### Scenario: Run non-interactive status path

- GIVEN user runs a non-interactive status invocation
- WHEN output is produced
- THEN the command returns through the existing CLI contract without entering shell routing

#### Scenario: Install single component via flag

- GIVEN user runs `cyberpunk --install --plugin`
- THEN only the plugin component is installed, no TUI is rendered
- AND exit code is 0 on success

#### Scenario: Status as JSON

- GIVEN user runs `cyberpunk --status --json`
- THEN output is a JSON array of `Component` objects to stdout

### Requirement: Error Display in TUI

When an interactive task fails for one or more components, the shell SHALL show the failure in progress or results views and MUST remain navigable.

#### Scenario: Task failure remains reviewable

- GIVEN the user triggers an interactive install for "sounds"
- WHEN that task fails because a dependency is missing
- THEN the shell shows the failure on the progress or results view
- AND the user can still navigate to result details or back to the shell

### Requirement: Task Progress and Result Navigation

The interactive shell MUST route long-running install, uninstall, and status actions through a task progress screen and SHALL route completed actions to a results screen that can reopen per-component details and return to the shell.

#### Scenario: Review results after an install task

- GIVEN the user starts an install action from the shell
- WHEN the task completes
- THEN the shell shows a results screen summarizing each component outcome
- AND the user can return to the home screen without restarting `cyberpunk`

#### Scenario: Inspect one component result

- GIVEN a completed task has mixed success and failure outcomes
- WHEN the user opens a component entry from the results screen
- THEN the shell shows detail text for that component
- AND the user can navigate back to the results screen and the shell

### Requirement: Tmux Component Selection

The TUI and flag-driven command flows SHALL treat `tmux` as a first-class component alongside existing components. Interactive and non-interactive selections MUST include tmux without requiring manual config edits.

#### Scenario: Tmux appears in interactive component list

- GIVEN tmux is not currently installed
- WHEN the user opens the cyberpunk TUI
- THEN the component list includes a tmux row with an available status and selectable checkbox

#### Scenario: Tmux is routed through non-interactive flags

- GIVEN the user runs a flag-driven install or uninstall targeting tmux
- WHEN command selection is resolved
- THEN only the tmux component workflow is executed and no TUI is rendered

### Requirement: Preset-First Install Guidance

The install-oriented TUI flow MUST present preset choices before manual component multiselect. Supported preset choices MUST include `minimal`, `full`, `wsl`, and `mac`, and the user MAY continue to manual component selection instead of choosing a preset.

#### Scenario: Choose minimal preset in TUI

- GIVEN the user opens the install flow in the TUI
- WHEN the user chooses the `minimal` preset
- THEN the TUI proceeds with `plugin` and `theme` selected through the existing install workflow

#### Scenario: Continue to manual selection

- GIVEN the user opens the install flow in the TUI
- WHEN the user declines preset selection
- THEN the TUI continues to the existing manual component multiselect flow

### Requirement: Preset Confirmation Messaging

Before executing a preset-selected install, the TUI MUST show the preset contents and MUST warn about optional dependency failures and tmux managed-block updates using the same preset scope as the CLI. For `wsl` and `mac`, the TUI MUST surface any platform mismatch warning during confirmation, SHALL still allow the user to proceed, and MUST NOT imply any environment bootstrap beyond messaging.

#### Scenario: Confirm full preset warnings in TUI

- GIVEN the user selected the `full` preset in the TUI
- WHEN the confirmation step is shown
- THEN the TUI lists the preset components and warns that dependency checks may still fail per component
- AND the TUI states that tmux updates only the managed block in `~/.tmux.conf`

#### Scenario: Confirm mac preset mismatch warning in TUI

- GIVEN the user selected the `mac` preset in the TUI on a platform that is not detected as `darwin`
- WHEN the confirmation step is shown
- THEN the TUI lists `plugin`, `theme`, `sounds`, `context-mode`, and `rtk` and warns that the preset is intended for macOS
- AND the TUI still offers the existing confirmation path without any bootstrap step
