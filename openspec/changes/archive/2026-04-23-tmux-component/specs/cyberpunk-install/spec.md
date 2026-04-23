# Delta for cyberpunk-install

## ADDED Requirements

### Requirement: Tmux Component Lifecycle

The system SHALL support `--tmux` for install and uninstall flows. Install MUST manage only the `# cyberpunk-managed:start` / `# cyberpunk-managed:end` block in `~/.tmux.conf`, preserving unmanaged content, and uninstall MUST remove only that managed block.

#### Scenario: Install tmux into existing user config

- GIVEN `~/.tmux.conf` already contains user-defined content outside the managed markers
- WHEN `cyberpunk install --tmux` is run
- THEN the bundled tmux configuration is present inside one managed block and unmanaged content remains unchanged

#### Scenario: Uninstall tmux removes only managed content

- GIVEN `~/.tmux.conf` contains both unmanaged content and the cyberpunk-managed block
- WHEN `cyberpunk uninstall --tmux` is run
- THEN only the managed block is removed and unrelated user content remains in place
