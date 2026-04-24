# Delta for cyberpunk-install

## MODIFIED Requirements

### Requirement: Preset Scope and Preflight Disclosure

Supported install presets MUST include `minimal`, `full`, `wsl`, and `mac`. Before CLI or TUI confirmation for a preset install, the system MUST compute and show a live preflight summary using current component and platform knowledge. The summary MUST include the resolved component list, known dependency readiness for relevant components or preset-specific checks, already-installed components, advisory file touches where known, and practical warnings such as platform mismatch or tmux managed-block behavior. The summary MUST remain advisory: it SHALL NOT change the requested preset, auto-fix prerequisites, or broaden doctor behavior. If some file-touch or readiness detail is unknown, the system MUST continue with partial disclosure and present it as advisory.

(Previously: Preset disclosure showed static component contents with fixed dependency and tmux warnings before execution.)

#### Scenario: Show live preset guidance before confirmation

- GIVEN the user selects the `full` preset in CLI or TUI
- WHEN the command reaches preset confirmation
- THEN the system shows the resolved components plus live readiness for relevant dependencies and any already-installed components
- AND the system includes known file-touch disclosures and practical warnings before install proceeds

#### Scenario: Warn but allow mismatched wsl preset

- GIVEN the user runs `cyberpunk install --preset wsl` on a platform that is not detected as WSL
- WHEN preset preflight runs
- THEN the system warns that the preset is intended for WSL and still resolves `plugin`, `theme`, `sounds`, and `tmux`
- AND the system does not auto-fix prerequisites or attempt environment bootstrap beyond the warning message

#### Scenario: Continue with partial advisory disclosure

- GIVEN a selected preset includes a component whose file touches or readiness details are only partially known
- WHEN preset preflight is generated
- THEN the system shows the known disclosures, labels them as advisory, and leaves unknown details unstated
- AND the install flow remains available for user confirmation
