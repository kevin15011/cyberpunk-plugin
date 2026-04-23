# Delta for cyberpunk-tui

## ADDED Requirements

### Requirement: Preset-First Install Guidance

The install-oriented TUI flow MUST present preset choices before manual component multiselect. Slice 1 MUST offer `minimal` and `full`, and the user MAY continue to manual component selection instead of choosing a preset.

#### Scenario: Choose minimal preset in TUI

- GIVEN the user opens the install flow in the TUI
- WHEN the user chooses the `minimal` preset
- THEN the TUI proceeds with `plugin` and `theme` selected through the existing install workflow

#### Scenario: Continue to manual selection

- GIVEN the user opens the install flow in the TUI
- WHEN the user declines preset selection
- THEN the TUI continues to the existing manual component multiselect flow

### Requirement: Preset Confirmation Messaging

Before executing a preset-selected install, the TUI MUST show the preset contents and MUST warn about optional dependency failures and tmux managed-block updates using the same slice-1 preset scope as the CLI. Deferred presets such as `wsl` and `mac` SHALL NOT be presented as selectable options.

#### Scenario: Confirm full preset warnings in TUI

- GIVEN the user selected the `full` preset in the TUI
- WHEN the confirmation step is shown
- THEN the TUI lists the preset components and warns that dependency checks may still fail per component
- AND the TUI states that tmux updates only the managed block in `~/.tmux.conf`

#### Scenario: Deferred presets absent from TUI

- GIVEN the user is choosing a preset in slice 1
- WHEN preset options are rendered
- THEN `wsl` and `mac` are not shown as selectable presets
