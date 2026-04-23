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
