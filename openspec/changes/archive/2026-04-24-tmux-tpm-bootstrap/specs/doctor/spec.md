# Delta for doctor

## MODIFIED Requirements

### Requirement: Tmux Doctor Checks

The doctor command SHALL report tmux health for binary availability, managed config ownership, TPM presence, tmux plugin installation readiness, and `gitmux` availability. Missing managed config MUST be fixable with `--fix`. Missing TPM or plugin readiness SHOULD report warnings in read-only mode. With `--fix`, missing TPM MUST be repairable by bootstrapping TPM when `git` is available, and missing plugin readiness MUST be repairable by invoking tmux plugin installation against the managed config. Missing `git`, TPM clone failure, or plugin installation failure MUST remain advisory results and MUST NOT modify unmanaged tmux content or trigger active-session reload.

(Previously: Doctor reported binary, managed config, TPM, and `gitmux`, but missing TPM stayed warning-only and plugin readiness was not checked.)

#### Scenario: Warn about optional tmux dependencies

- GIVEN tmux is installed and the managed config block exists but TPM, plugin readiness, or `gitmux` is missing
- WHEN `cyberpunk doctor` is run
- THEN tmux dependency checks report `warn` and no repair is attempted without `--fix`

#### Scenario: Fix missing managed tmux block safely

- GIVEN tmux is available but `~/.tmux.conf` lacks the cyberpunk-managed block
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN the managed block is restored without altering unmanaged content and no TPM install or session reload occurs

#### Scenario: Repair missing TPM or plugin readiness with fix mode

- GIVEN tmux is available, the managed block exists, TPM is missing or plugins are not installed, and `git` is available
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN TPM is cloned when needed and tmux plugin installation is attempted for the managed config
- AND unmanaged tmux content remains unchanged

#### Scenario: Leave bootstrap failures advisory during doctor repair

- GIVEN tmux plugin readiness fails and `git` is missing or TPM bootstrap/plugin installation cannot complete
- WHEN `cyberpunk doctor --fix --tmux` is run
- THEN doctor reports the tmux bootstrap problem without claiming it was fixed
- AND no active-session reload is attempted
