# Delta for cyberpunk-install

## ADDED Requirements

### Requirement: Preset-Based Install Selection

The install command MUST accept `--preset <name>` for named install presets, MUST resolve the preset into existing component IDs before execution, and MUST reject combining `--preset` with per-component flags or `--all`.

#### Scenario: Install minimal preset from CLI

- GIVEN the user runs `cyberpunk install --preset minimal`
- WHEN preset selection is resolved
- THEN the system installs only `plugin` and `theme` using existing component installers

#### Scenario: Reject conflicting install selectors

- GIVEN the user runs `cyberpunk install --preset full --theme`
- WHEN command validation runs
- THEN the system reports that `--preset` cannot be combined with component flags or `--all`

### Requirement: Preset Scope and Preflight Disclosure

Slice 1 presets MUST include only `minimal` and `full`. The system MUST show each preset's component contents before execution and MUST disclose optional dependency failures and tmux managed-block behavior. Environment-specific presets such as `wsl` and `mac` SHALL be deferred from slice 1 and MUST be rejected as unsupported preset names.

#### Scenario: Show full preset disclosures before install

- GIVEN the user selects the `full` preset
- WHEN the command reaches preflight confirmation
- THEN the system shows the preset component list and warns that optional dependencies may still fail per component
- AND the system states that tmux changes affect only the managed block in `~/.tmux.conf`

#### Scenario: Reject deferred preset names

- GIVEN the user runs `cyberpunk install --preset wsl`
- WHEN preset lookup runs
- THEN the system reports that `wsl` is not available in slice 1
