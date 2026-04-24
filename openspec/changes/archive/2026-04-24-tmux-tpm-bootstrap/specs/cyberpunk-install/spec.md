# Delta for cyberpunk-install

## MODIFIED Requirements

### Requirement: Tmux Component Lifecycle

The system SHALL support `--tmux` for install and uninstall flows. Install MUST manage only the `# cyberpunk-managed:start` / `# cyberpunk-managed:end` block in `~/.tmux.conf`, preserving unmanaged content, and uninstall MUST remove only that managed block. After a successful tmux install writes the managed block, the system MUST check whether TPM exists at `~/.tmux/plugins/tpm`; if TPM is absent and `git` is available, it MUST bootstrap TPM and then attempt tmux plugin installation for the managed config. TPM bootstrap and plugin installation MUST be idempotent, MUST NOT alter unmanaged tmux content, and SHOULD surface clone or plugin-install failures as warnings without rolling back the managed config.

(Previously: Install only managed the tmux block and did not define TPM bootstrap or plugin installation behavior.)

#### Scenario: Install tmux into existing user config

- GIVEN `~/.tmux.conf` already contains user-defined content outside the managed markers
- WHEN `cyberpunk install --tmux` is run
- THEN the bundled tmux configuration is present inside one managed block and unmanaged content remains unchanged

#### Scenario: Uninstall tmux removes only managed content

- GIVEN `~/.tmux.conf` contains both unmanaged content and the cyberpunk-managed block
- WHEN `cyberpunk uninstall --tmux` is run
- THEN only the managed block is removed and unrelated user content remains in place

#### Scenario: Bootstrap TPM and install tmux plugins after config write

- GIVEN the managed tmux block is written, TPM is absent, and `git` is available
- WHEN `cyberpunk install --tmux` continues its post-config step
- THEN TPM is cloned into `~/.tmux/plugins/tpm` and plugin installation is attempted for the managed tmux config

#### Scenario: Keep managed tmux install when bootstrap is advisory only

- GIVEN the managed tmux block is written and `git` is missing or tmux plugin installation fails
- WHEN `cyberpunk install --tmux` completes
- THEN the managed tmux config remains installed and the bootstrap problem is reported as a warning
- AND no active-session reload is attempted
