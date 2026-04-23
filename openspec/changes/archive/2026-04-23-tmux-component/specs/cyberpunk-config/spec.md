# Delta for cyberpunk-config

## ADDED Requirements

### Requirement: Tmux Component State Persistence

The system SHALL persist `components.tmux` in the cyberpunk config model. Successful tmux install and uninstall flows MUST keep that state synchronized with the managed tmux component on disk.

#### Scenario: Config reflects tmux install

- GIVEN `components.tmux.installed` is `false`
- WHEN `cyberpunk install --tmux` succeeds
- THEN `components.tmux.installed` becomes `true` and tmux installation metadata is stored

#### Scenario: Config reflects tmux uninstall

- GIVEN `components.tmux.installed` is `true`
- WHEN `cyberpunk uninstall --tmux` succeeds
- THEN `components.tmux.installed` becomes `false` and tmux-specific path/version metadata is cleared
