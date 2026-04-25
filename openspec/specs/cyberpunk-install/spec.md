# Cyberpunk Install Specification

## Purpose

Handles installation and uninstallation of individual cyberpunk components. Each component is an independent module with `install()` and `uninstall()` functions. Supports both interactive (TUI-driven) and non-interactive (flag-driven) modes.

## CLI Interface

```
cyberpunk install [--plugin] [--theme] [--sounds] [--context-mode] [--all] [--json]
cyberpunk uninstall [--plugin] [--theme] [--sounds] [--context-mode] [--all] [--json]
```

### Flags

| Flag | Description |
|------|-------------|
| `--plugin` | Install/uninstall OpenCode plugin only |
| `--theme` | Install/uninstall cyberpunk theme only |
| `--sounds` | Install/uninstall sound pack only |
| `--context-mode` | Install/uninstall context-mode integration only |
| `--all` | Apply to all four components |
| `--json` | JSON output |

## Data Models

```typescript
interface InstallResult {
  component: ComponentId
  action: "install" | "uninstall"
  status: "success" | "skipped" | "error"
  message?: string
  path?: string   // file that was created/removed
}

type ComponentId = "plugin" | "theme" | "sounds" | "context-mode"
```

## Requirements

### Requirement: Plugin Component Install

The system SHALL copy `cyberpunk.ts` from the package into `~/.config/opencode/plugins/cyberpunk.ts`. If the file already exists and is identical, it MUST report `skipped`.

#### Scenario: Fresh plugin install

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` does not exist
- WHEN `cyberpunk install --plugin` is run
- THEN the file is copied and `InstallResult.status` is `"success"`

#### Scenario: Plugin already installed (identical)

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` exists and matches the source
- WHEN `cyberpunk install --plugin` is run
- THEN `InstallResult.status` is `"skipped"` and no file is overwritten

### Requirement: Theme Component Install

The system SHALL create the cyberpunk theme in `~/.config/opencode/themes/`. If files exist and differ, the system SHOULD back up the existing file before overwriting.

#### Scenario: Theme install with backup

- GIVEN a custom theme file already exists at the target path
- WHEN `cyberpunk install --theme` is run
- THEN the existing file is backed up with a `.bak` suffix
- AND the new theme file is written

### Requirement: Sounds Component Install

The system SHALL generate sound files via ffmpeg into `~/.config/opencode/sounds/`. If ffmpeg is unavailable, it MUST report an error and skip.

#### Scenario: Sounds install success

- GIVEN ffmpeg is available on PATH
- WHEN `cyberpunk install --sounds` is run
- THEN four `.wav` files are generated in `~/.config/opencode/sounds/`

#### Scenario: Sounds install no ffmpeg

- GIVEN ffmpeg is not on PATH
- WHEN `cyberpunk install --sounds` is run
- THEN `InstallResult.status` is `"error"` with message referencing ffmpeg

### Requirement: Context-Mode Component Install

The system SHALL ensure context-mode is installed globally (via npm) and that routing instructions exist at `~/.config/opencode/instructions/context-mode-routing.md`.

#### Scenario: Context-mode install from scratch

- GIVEN npm is available and context-mode is not installed
- WHEN `cyberpunk install --context-mode` is run
- THEN `npm install -g context-mode` is executed and routing file is written

### Requirement: Uninstall Component

The system SHALL remove the files created by install for the specified component(s). Uninstall MUST NOT remove files it did not create.

#### Scenario: Uninstall plugin

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` exists
- WHEN `cyberpunk uninstall --plugin` is run
- THEN the file is removed and status is `"success"`

#### Scenario: Uninstall non-existent component

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` does not exist
- WHEN `cyberpunk uninstall --plugin` is run
- THEN `InstallResult.status` is `"skipped"`

### Requirement: Install All

When `--all` is specified, the system SHALL install all four components sequentially and report a combined result.

#### Scenario: All succeed

- GIVEN all dependencies (ffmpeg, npm) are available
- WHEN `cyberpunk install --all` is run
- THEN four `InstallResult` objects are returned, all with `status: "success"`

#### Scenario: Partial failure

- GIVEN ffmpeg is missing but npm is available
- WHEN `cyberpunk install --all` is run
- THEN three components succeed and sounds reports `"error"`
- AND exit code is 1

### Requirement: OpenCode Registration After Plugin Install

After a successful plugin file copy, the system SHALL invoke the plugin-registration helper to add `./plugins/cyberpunk` to the OpenCode config `plugin` array.

#### Scenario: Registration follows successful plugin install

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` is copied successfully
- WHEN the install result status is `"success"`
- THEN the registration helper is invoked to update OpenCode config

#### Scenario: Registration skipped on install failure

- GIVEN the plugin file copy fails
- WHEN the install result status is `"error"`
- THEN the registration helper is NOT invoked

### Requirement: OpenCode Unregistration After Plugin Uninstall

After a successful plugin file removal, the system SHALL invoke the plugin-registration helper to remove `./plugins/cyberpunk` from the OpenCode config `plugin` array.

#### Scenario: Unregistration follows successful plugin uninstall

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` is removed successfully
- WHEN the uninstall result status is `"success"`
- THEN the unregistration helper is invoked to update OpenCode config

#### Scenario: Unregistration skipped on uninstall skip

- GIVEN the plugin file does not exist
- WHEN the uninstall result status is `"skipped"`
- THEN the unregistration helper is NOT invoked



### Requirement: ComponentModule Doctor Method

The `ComponentModule` interface SHALL include an optional `doctor()` method returning `Promise<DoctorResult>`. Modules that do not implement `doctor()` MUST be treated as having zero checks (empty `DoctorResult`).

#### Scenario: Module with doctor implementation

- GIVEN a component module implements `doctor()`
- WHEN the doctor command collects results
- THEN the module's `DoctorResult` is included in the report

#### Scenario: Module without doctor implementation

- GIVEN a component module does not implement `doctor()`
- WHEN the doctor command collects results
- THEN the module produces an empty `DoctorResult` (no checks, no failures)

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

### Requirement: Tmux Verification Harness Preparation

Automated verification for tmux install and related doctor assertions MUST prepare temporary tmux/config fixtures before execution, MUST verify only the managed cyberpunk-owned content within those isolated fixtures, and MUST NOT touch real user tmux or cyberpunk config files.

#### Scenario: Tmux install verification provisions fixture first

- GIVEN tmux install verification is about to assert managed config behavior
- WHEN the harness executes the install flow
- THEN the temporary tmux config fixture already exists with any required seed content
- AND assertions target that fixture instead of the real user files

#### Scenario: Tmux verification preserves unmanaged content in fixture

- GIVEN the temporary tmux fixture contains unmanaged user content around the managed block
- WHEN install or doctor verification runs
- THEN only cyberpunk-managed content is asserted or changed
- AND unmanaged fixture content remains intact

### Requirement: Standalone Installer Guidance Summary

The standalone binary installer MUST provide shell-aware PATH guidance, MUST avoid duplicating an already-present PATH export, and MUST end with a concise verification-oriented summary covering binary access and any unresolved prerequisites.

#### Scenario: Shell-aware PATH help for missing binary path

- GIVEN `install.sh` places the binary in a directory not currently reachable on PATH
- WHEN the installer finishes on a recognized shell profile target
- THEN it explains which shell profile to update and how to reload or restart the shell
- AND the completion summary includes a command the user can run to verify `cyberpunk` is callable

#### Scenario: No duplicate PATH export added

- GIVEN the target PATH export line is already present in the selected shell profile
- WHEN `install.sh` provides PATH setup guidance
- THEN the installer does not append a duplicate export line
- AND the completion summary still reports the verification step

### Requirement: Standalone Installer Dependency and macOS First-Run Guidance

The standalone binary installer MUST provide actionable ffmpeg follow-up guidance when ffmpeg is unavailable, MUST attempt macOS quarantine removal when applicable, and MUST continue with manual guidance if automated first-run help cannot be completed.

#### Scenario: Missing ffmpeg is surfaced as follow-up guidance

- GIVEN the binary install succeeds but ffmpeg is not available on PATH
- WHEN `install.sh` reaches post-install guidance
- THEN the installer explains that ffmpeg is still required for sound generation features
- AND the completion summary marks ffmpeg setup as a remaining user action instead of reporting install failure

#### Scenario: macOS quarantine removal falls back to guidance

- GIVEN the installer is running on macOS for a downloaded binary
- WHEN quarantine removal is attempted
- THEN the installer reports whether the automatic step succeeded
- AND if the step cannot run, it provides the user with manual first-run guidance before exit

### Requirement: Agent-Aware Compatibility and Backward Compatibility

The install flow MUST preserve current OpenCode component behavior when no new target is selected, and MUST apply agent/platform compatibility filtering when a target is detected or chosen. Unsupported or unknown components MUST be skipped with rationale instead of being installed speculatively.

#### Scenario: Legacy OpenCode flow stays intact

- GIVEN a user runs an existing OpenCode install flow without agent-specific overrides
- WHEN install selection is resolved
- THEN the same OpenCode-capable components and registration behavior remain available

#### Scenario: Unsupported target component is withheld

- GIVEN Claude or Codex is selected and plugin or theme support is not verified
- WHEN install selection is resolved
- THEN unsupported components are excluded with an explanation
- AND compatible items such as RTK or context-mode are only offered when their compatibility state allows it

### Requirement: Windows-Safe Planning Output

Install planning MUST expose dry-run friendly output that shows selected target, compatibility state, prerequisites, and intended paths before mutation. On Windows, execution MUST use the shared path and shell abstraction.

#### Scenario: Windows install dry-run explains plan

- GIVEN the user requests install planning on Windows
- WHEN the plan is rendered
- THEN the output lists target agent, selected components, prerequisite gaps, and intended paths
- AND no install side effects occur
