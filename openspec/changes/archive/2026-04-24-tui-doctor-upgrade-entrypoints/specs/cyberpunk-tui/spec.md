# Delta for Cyberpunk TUI

## ADDED Requirements

### Requirement: Doctor Workflow in TUI

The interactive shell MUST expose a Doctor route that shows the current doctor summary and SHALL require explicit confirmation before running any repair action from the shell.

#### Scenario: Review doctor summary from the shell

- GIVEN the user is on the TUI home screen
- WHEN the user opens Doctor
- THEN the shell shows the current doctor status summary without leaving the TUI

#### Scenario: Confirm a doctor repair before execution

- GIVEN doctor reports an actionable issue in the shell
- WHEN the user chooses the repair action
- THEN the shell asks for explicit confirmation before applying the fix
- AND the user can review the post-run outcome without leaving the shell

### Requirement: Direct Doctor and Upgrade CLI Behavior

The system MUST preserve the existing non-interactive `cyberpunk doctor` and `cyberpunk upgrade` behavior while adding TUI entrypoints for the same workflows.

#### Scenario: Run direct doctor command

- GIVEN the user runs `cyberpunk doctor`
- WHEN argument parsing resolves the request
- THEN the existing doctor command behavior runs without rendering the TUI shell

#### Scenario: Run direct upgrade command

- GIVEN the user runs `cyberpunk upgrade`
- WHEN output and exit status are produced
- THEN the existing upgrade command behavior is preserved without rendering the TUI shell

## MODIFIED Requirements

### Requirement: Interactive TUI Launch

When invoked with no arguments, the system SHALL render a full-screen navigable TUI shell with shared navigation chrome and routes for home, install, uninstall, status, doctor, upgrade, task progress, and results/detail views.

(Previously: the shell only exposed home, install, uninstall, status, task progress, and results/detail routes.)

#### Scenario: Open shell home screen

- GIVEN components have any installed or available state
- WHEN the user runs `cyberpunk` with no arguments
- THEN the TUI opens on a home screen that offers install, uninstall, status, doctor, and upgrade navigation
- AND the shell remains active until the user explicitly leaves it

#### Scenario: Quit shell

- GIVEN the shell is open on any screen
- WHEN the user presses the shell quit control
- THEN the TUI exits cleanly with exit code 0

### Requirement: Task Progress and Result Navigation

The interactive shell MUST route long-running install, uninstall, status, and upgrade actions through a task progress screen when execution begins and SHALL route completed actions to a results screen that can reopen per-component details and return to the shell.

(Previously: only install, uninstall, and status actions were required to use the shared task progress and results flow.)

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

#### Scenario: Review results after an upgrade task

- GIVEN the user starts an upgrade action from the shell
- WHEN the upgrade completes or fails
- THEN the shell shows the shared results flow with the upgrade outcome
- AND the user can return to the shell without restarting `cyberpunk`
