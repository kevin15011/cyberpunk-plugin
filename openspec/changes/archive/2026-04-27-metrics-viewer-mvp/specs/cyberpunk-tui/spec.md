# Delta for Cyberpunk TUI

## ADDED Requirements

### Requirement: Metrics Route and Direct Metrics Command

The interactive shell MUST expose a metrics-viewer route for local telemetry inspection, and the CLI SHALL preserve direct `cyberpunk metrics` behavior as a non-interactive path that does not require entering the shell.

#### Scenario: Open metrics screen from the shell

- GIVEN the user is in the cyberpunk TUI
- WHEN the user opens metrics-viewer navigation
- THEN the shell shows the metrics-viewer screen without leaving the TUI

#### Scenario: Run direct metrics command

- GIVEN the user runs `cyberpunk metrics`
- WHEN argument parsing resolves the request
- THEN metrics output is returned through the CLI contract without rendering the TUI shell

### Requirement: Metrics Viewer Screen Controls

The interactive shell MUST preserve existing back or exit controls on the metrics-viewer screen. The screen SHOULD expose manual refresh and pause or resume controls when those controls are consistent with existing TUI interaction patterns.

#### Scenario: Trigger manual refresh from metrics screen

- GIVEN the user is on the metrics-viewer screen
- WHEN the user invokes the screen's manual refresh control
- THEN the metrics data refreshes immediately without leaving the TUI

#### Scenario: Leave or pause the metrics screen

- GIVEN the metrics-viewer screen is visible with auto-refresh active
- WHEN the user invokes the shared exit or back control, or a screen pause control if present
- THEN the user can stop watching the screen without a confusing refresh loop
