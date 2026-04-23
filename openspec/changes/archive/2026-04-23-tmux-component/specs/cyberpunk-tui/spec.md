# Delta for cyberpunk-tui

## ADDED Requirements

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
