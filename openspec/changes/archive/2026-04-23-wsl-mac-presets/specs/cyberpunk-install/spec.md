# Delta for cyberpunk-install

## MODIFIED Requirements

### Requirement: Preset Scope and Preflight Disclosure

Supported install presets MUST include `minimal`, `full`, `wsl`, and `mac`. The system MUST show each preset's component contents before execution and MUST disclose optional dependency failures and tmux managed-block behavior. For `wsl` and `mac`, the system SHALL detect the current platform and, on mismatch, MUST warn without blocking execution or attempting environment bootstrap beyond messaging.
(Previously: Slice 1 exposed only `minimal` and `full`, and `wsl`/`mac` were rejected as deferred presets.)

#### Scenario: Show full preset disclosures before install

- GIVEN the user selects the `full` preset
- WHEN the command reaches preflight confirmation
- THEN the system shows the preset component list and warns that optional dependencies may still fail per component
- AND the system states that tmux changes affect only the managed block in `~/.tmux.conf`

#### Scenario: Warn but allow mismatched wsl preset

- GIVEN the user runs `cyberpunk install --preset wsl` on a platform that is not detected as WSL
- WHEN preset lookup and disclosure run
- THEN the system warns that the preset is intended for WSL and still resolves `plugin`, `theme`, `sounds`, and `tmux`
- AND the system does not attempt any platform bootstrap beyond the warning message
