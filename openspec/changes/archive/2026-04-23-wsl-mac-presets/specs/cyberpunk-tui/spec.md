# Delta for cyberpunk-tui

## MODIFIED Requirements

### Requirement: Preset-First Install Guidance

The install-oriented TUI flow MUST present preset choices before manual component multiselect. Supported preset choices MUST include `minimal`, `full`, `wsl`, and `mac`, and the user MAY continue to manual component selection instead of choosing a preset.
(Previously: Slice 1 offered only `minimal` and `full` before manual selection.)

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
(Previously: Confirmation used the slice-1 preset scope and `wsl`/`mac` were not selectable.)

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
