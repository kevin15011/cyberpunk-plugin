# Delta for doctor

## ADDED Requirements

### Requirement: Tmux Doctor Checks

The doctor command SHALL report tmux health for binary availability, managed config ownership, TPM presence, and `gitmux` availability. Missing managed config MUST be fixable with `--fix`; missing TPM or `gitmux` SHOULD report warnings only and MUST NOT trigger TPM installation or active-session reload.

#### Scenario: Warn about optional tmux dependencies

- GIVEN tmux is installed and the managed config block exists but TPM or `gitmux` is missing
- WHEN `cyberpunk doctor` is run
- THEN tmux dependency checks report `warn` and no repair is attempted without `--fix`

#### Scenario: Fix missing managed tmux block safely

- GIVEN tmux is available but `~/.tmux.conf` lacks the cyberpunk-managed block
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN the managed block is restored without altering unmanaged content and no TPM install or session reload occurs
