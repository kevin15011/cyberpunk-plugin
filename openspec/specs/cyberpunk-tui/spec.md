# Cyberpunk TUI Specification

## Purpose

Interactive CLI `cyberpunk` with a visual TUI that lets users select, install, uninstall, and inspect cyberpunk environment components without forcing anything on OpenCode load.

## CLI Interface

```
cyberpunk [command] [flags]
```

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| _(none)_ | — | Opens interactive TUI |
| `install` | `i` | Install flow (TUI or flag-driven) |
| `uninstall` | `u` | Uninstall flow (TUI or flag-driven) |
| `status` | `s` | Print installed/available state |
| `upgrade` | `up` | Pull and apply latest version |
| `config` | `c` | Read/write config values |
| `help` | `h` | Print help |

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON output |
| `--verbose` | Debug logging to stderr |
| `--help` | Print help |

## Data Models

```typescript
interface Component {
  id: "plugin" | "theme" | "sounds" | "context-mode"
  label: string
  status: "installed" | "available" | "error"
  error?: string
}

interface TUIState {
  components: Component[]
  selected: Set<string>   // ids with checkbox toggled
  cursor: number          // focused row
}
```

## Requirements

### Requirement: Interactive TUI Launch

When invoked with no arguments, the system SHALL render a full-screen TUI showing all four components with checkboxes, status indicators, and keyboard navigation.

#### Scenario: Open TUI with mixed component state

- GIVEN components "plugin" is installed and "theme" is not installed
- WHEN user runs `cyberpunk` with no arguments
- THEN the TUI renders with `[✓] Plugin de OpenCode  ✓ instalado` and `[ ] Tema cyberpunk  — disponible`

#### Scenario: Quit TUI

- GIVEN the TUI is open
- WHEN user presses `q` or `Esc`
- THEN the TUI exits cleanly with exit code 0

### Requirement: Component Selection

The TUI MUST allow toggling components via `Space` and confirming via `Enter`. The system SHALL NOT proceed if no component is selected.

#### Scenario: Toggle and confirm

- GIVEN the TUI is open and "sounds" is unchecked
- WHEN user presses `Space` on the sounds row then `Enter` on "INSTALAR"
- THEN the system invokes the install command for sounds only

#### Scenario: No selection

- GIVEN the TUI is open
- WHEN user presses `Enter` with zero selected components
- THEN the TUI displays "Ningún componente seleccionado" and remains open

### Requirement: Non-Interactive Flags

The CLI MUST support `--install`, `--uninstall`, `--status`, and `--upgrade` flags for scripted usage, bypassing the TUI entirely.

#### Scenario: Install single component via flag

- GIVEN user runs `cyberpunk --install --plugin`
- THEN only the plugin component is installed, no TUI is rendered
- AND exit code is 0 on success

#### Scenario: Install all via flag

- GIVEN user runs `cyberpunk --install --all`
- THEN all components are installed sequentially

#### Scenario: Status as JSON

- GIVEN user runs `cyberpunk --status --json`
- THEN output is a JSON array of `Component` objects to stdout

### Requirement: Error Display in TUI

When a component operation fails, the TUI SHALL show `[✗]` with the error message and MUST NOT crash.

#### Scenario: Install failure

- GIVEN the user triggers install for "sounds"
- WHEN ffmpeg is not found on the system
- THEN the row shows `[✗] Sonidos  ✗ error: ffmpeg not found`
- AND the TUI remains interactive
