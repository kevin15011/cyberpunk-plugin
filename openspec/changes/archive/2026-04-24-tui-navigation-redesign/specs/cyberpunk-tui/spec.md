# Delta for cyberpunk-tui

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Interactive TUI Launch

When invoked with no arguments, the system SHALL render a full-screen navigable TUI shell with shared navigation chrome and routes for home, install, uninstall, status, task progress, and results/detail views.
(Previously: launching `cyberpunk` opened a single component checklist screen with inline status rows.)

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
(Previously: selection happened on the initial checklist screen and `Enter` immediately triggered install.)

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
(Previously: the spec only required flag-driven bypass of the original checklist TUI.)

#### Scenario: Run non-interactive install path

- GIVEN user runs a non-interactive install invocation such as `cyberpunk --install --plugin`
- WHEN argument parsing resolves the request
- THEN only the requested command workflow runs and no interactive shell is rendered

#### Scenario: Run non-interactive status path

- GIVEN user runs a non-interactive status invocation
- WHEN output is produced
- THEN the command returns through the existing CLI contract without entering shell routing

### Requirement: Error Display in TUI

When an interactive task fails for one or more components, the shell SHALL show the failure in progress or results views and MUST remain navigable.
(Previously: failures were rendered directly on the original checklist rows.)

#### Scenario: Task failure remains reviewable

- GIVEN the user triggers an interactive install for "sounds"
- WHEN that task fails because a dependency is missing
- THEN the shell shows the failure on the progress or results view
- AND the user can still navigate to result details or back to the shell
