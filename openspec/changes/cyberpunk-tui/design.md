# Design: cyberpunk-tui

## Technical Approach

Transform the flat `cyberpunk-plugin` repo (single `cyberpunk.ts` + `install.sh`) into a compiled CLI binary `cyberpunk` with an interactive TUI. The existing `cyberpunk.ts` OpenCode plugin is refactored to only handle runtime concerns (sound playback, event hooks), delegating all install/config logic to the new CLI. Each component (plugin, theme, sounds, context-mode) becomes an independent module with `install()`/`uninstall()`/`status()` functions.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Build target | `bun build --compile` to standalone binary | `pkg`, `nexe`, raw TS via `tsx` | Bun produces single-file binary with zero runtime deps; project already uses Bun APIs (`Bun.file`) |
| TUI framework | `@clack/prompts` | `inquirer`, `blessed`, custom ANSI | Lightweight, same ecosystem as OpenCode, good checkbox/select support, no native deps |
| CLI parsing | Manual `process.argv` switch | `commander`, `yargs` | Only 6 commands + flags — a dependency-free parser keeps binary small |
| Config format | JSON at `~/.config/cyberpunk/config.json` | TOML, YAML, JS module | JSON is native to TS, no parser dep, matches OpenCode convention (`opencode.json`) |
| Component interface | `{ id, install(), uninstall(), status() }` per module | Giant switch/case in one file | Independent modules enable tree-shaking, testing, and future components |
| Install bootstrap | `curl \| bash` script that downloads binary from GitHub Releases | `npm install -g`, brew cask | Zero-requirement bootstrap; binary download is fastest, no node/bun needed on target |

## Data Flow

```
User runs `cyberpunk`
       │
       ▼
  cli/index.ts parses argv
       │
       ├─ no args ──→ tui/index.ts renders interactive menu
       │                    │
       │                    ▼  user toggles + confirms
       │              commands/install.ts
       │                    │
       │                    ▼
       │              component modules ──→ config.write() ──→ filesystem
       │
       ├─ `install --plugin` ──→ components/plugin.ts ──→ config.write()
       ├─ `status --json`    ──→ all components.status() ──→ stdout
       ├─ `upgrade`          ──→ commands/upgrade.ts ──→ git fetch + file replace
       └─ `config key val`   ──→ config module read/write
```

Config sync: every install/uninstall call writes to `config.json` before returning. Status reads from filesystem + config cross-check.

## Directory Structure

```
cyberpunk-plugin/
├── src/
│   ├── index.ts                    # Entry point: parse argv, dispatch command
│   ├── cli/
│   │   ├── parse-args.ts           # argv parser → { command, flags, components }
│   │   └── output.ts               # format output (text vs --json)
│   ├── tui/
│   │   ├── index.ts                # Main TUI loop: render, input, dispatch
│   │   └── theme.ts                # ANSI colors/styles for TUI (reuse cyberpunk palette)
│   ├── commands/
│   │   ├── install.ts              # Orchestrates component install/uninstall
│   │   ├── status.ts               # Collects status from all components
│   │   ├── upgrade.ts              # Git-based upgrade logic
│   │   └── config.ts               # Config get/set/list/init
│   ├── components/
│   │   ├── types.ts                # ComponentId, ComponentResult interfaces
│   │   ├── plugin.ts               # OpenCode plugin install (copy cyberpunk-plugin.ts)
│   │   ├── theme.ts                # Theme JSON + tui.json activation
│   │   ├── sounds.ts               # ffmpeg sound generation
│   │   └── context-mode.ts         # npm install -g + routing instructions
│   └── config/
│       ├── schema.ts               # CyberpunkConfig interface + defaults
│       ├── load.ts                 # Read + parse config, auto-create if missing
│       └── save.ts                 # Write config atomically
├── cyberpunk.ts                    # REFACTORED OpenCode plugin (runtime only)
├── cyberpunk-plugin.ts             # Bundled plugin source (what gets copied to ~/.config)
├── install.sh                      # curl|bash bootstrap → downloads binary
├── tmux.conf                       # Existing tmux config (unchanged)
├── build.ts                        # Build script: bun build --compile
├── package.json                    # NEW: deps + scripts
└── tsconfig.json                   # NEW: TS config for src/
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/index.ts` | Create | CLI entry: argv parse → command dispatch |
| `src/cli/parse-args.ts` | Create | Parse `process.argv` into typed command object |
| `src/cli/output.ts` | Create | Format results as text or `--json` |
| `src/tui/index.ts` | Create | Interactive TUI with `@clack/prompts` |
| `src/tui/theme.ts` | Create | Cyberpunk ANSI color constants |
| `src/commands/install.ts` | Create | Orchestrates component install/uninstall, returns `InstallResult[]` |
| `src/commands/status.ts` | Create | Collects `Component[]` from all modules |
| `src/commands/upgrade.ts` | Create | Git fetch, compare versions, replace files preserving config |
| `src/commands/config.ts` | Create | Get/set/list config values with dot-path support |
| `src/components/types.ts` | Create | `ComponentId`, `InstallResult`, `Component` interfaces |
| `src/components/plugin.ts` | Create | Copy `cyberpunk-plugin.ts` to `~/.config/opencode/plugins/` |
| `src/components/theme.ts` | Create | Write theme JSON + activate in `tui.json` |
| `src/components/sounds.ts` | Create | Generate sounds via ffmpeg |
| `src/components/context-mode.ts` | Create | npm install -g + write routing instructions |
| `src/config/schema.ts` | Create | `CyberpunkConfig` interface with defaults |
| `src/config/load.ts` | Create | Load config, auto-create dirs + file on first access |
| `src/config/save.ts` | Create | Atomic write: write to `.tmp` then rename |
| `cyberpunk.ts` | Modify | Strip install/config logic; keep only event handlers + sound playback |
| `cyberpunk-plugin.ts` | Create | Bundled version of the slimmed plugin for CLI to copy |
| `install.sh` | Modify | Replace inline logic with binary download from GitHub Releases |
| `build.ts` | Create | `bun build --compile ./src/index.ts --outfile cyberpunk` |
| `package.json` | Create | Dependencies: `@clack/prompts`; scripts: `build`, `dev` |
| `tsconfig.json` | Create | Target ESNext, moduleResolution bun |

## Interfaces / Contracts

```typescript
// src/components/types.ts
type ComponentId = "plugin" | "theme" | "sounds" | "context-mode"

interface InstallResult {
  component: ComponentId
  action: "install" | "uninstall"
  status: "success" | "skipped" | "error"
  message?: string
  path?: string
}

interface ComponentStatus {
  id: ComponentId
  label: string
  status: "installed" | "available" | "error"
  error?: string
}

interface ComponentModule {
  id: ComponentId
  label: string
  install(): Promise<InstallResult>
  uninstall(): Promise<InstallResult>
  status(): Promise<ComponentStatus>
}
```

```typescript
// src/config/schema.ts
interface CyberpunkConfig {
  version: number
  components: Record<ComponentId, {
    installed: boolean
    version?: string
    installedAt?: string
    path?: string
  }>
  lastUpgradeCheck?: string
  repoUrl?: string
}
```

```typescript
// src/cli/parse-args.ts
interface ParsedArgs {
  command: "tui" | "install" | "uninstall" | "status" | "upgrade" | "config" | "help"
  components: ComponentId[]
  flags: {
    json: boolean
    verbose: boolean
    all: boolean
    check: boolean
    list: boolean
    init: boolean
  }
  configKey?: string
  configValue?: string
}
```

## Build Strategy

```bash
# build.ts
import { build } from "bun"

await build({
  entrypoint: "./src/index.ts",
  outdir: ".",
  target: "bun",
  compile: true,        // standalone binary
  naming: "cyberpunk",
})
```

Produces a single `cyberpunk` binary (~15-30MB). Distribute via GitHub Releases as `cyberpunk-<os>-<arch>`.

The `install.sh` bootstrap:
```bash
#!/bin/bash
set -e
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
curl -fsSL "https://github.com/kevin15011/cyberpunk-plugin/releases/latest/download/cyberpunk-${OS}-${ARCH}" \
  -o /usr/local/bin/cyberpunk
chmod +x /usr/local/bin/cyberpunk
cyberpunk  # opens TUI
```

## OpenCode Plugin Refactor

The existing `cyberpunk.ts` (~700 lines) does install + config + SDD bootstrap + event handling on every OpenCode load. After this change:

1. **Remove** from `cyberpunk.ts`: `install()`, `installSddAssets()`, `installContextModeAssets()`, `patchSddContinueCommand()`, `patchOpencodeConfig()`, theme writing, sound generation, `ensureSound()`, `ensureFile()`, `ensureManagedFile()`
2. **Keep** in `cyberpunk.ts`: `playSound()`, event handler (`session.idle`, `session.error`, `session.compacted`, `permission.asked`), sound path constants
3. **Move** SDD assets, context-mode routing, and config patching to the CLI `components/` modules — they install on demand when the user runs `cyberpunk install --context-mode`
4. The slimmed plugin becomes `cyberpunk-plugin.ts` (~50 lines), bundled into the binary for the plugin component to copy

The refactored plugin **never writes files** and **never patches config**. It only plays sounds on events.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `parse-args.ts` — all command/flag combos | Bun test runner, assert output shape |
| Unit | `config/load.ts`, `config/save.ts` — read/write | Temp dir, verify file creation |
| Unit | Each component `status()` | Mock filesystem paths, check return |
| Integration | `install --all` then `status` | Temp homedir, verify files created + config updated |
| Integration | `upgrade` with mock git | Stub `git fetch`, verify file replacement + config preserved |
| Manual | TUI interaction | Run binary, verify keyboard nav, toggles, quit |

No automated test infrastructure exists yet; unit tests use `Bun.test` (zero config).

## Migration / Rollout

1. Add `package.json` + `tsconfig.json` + `build.ts` — existing files untouched
2. Build binary, attach to GitHub Release as new artifact
3. New `install.sh` downloads binary instead of copying `.ts` files
4. Existing `install.sh` still works for users who don't upgrade
5. Users who already have the old plugin: `cyberpunk upgrade` replaces the fat plugin with the slim one

No forced migration — both paths coexist.

## Open Questions

- [ ] Should `tmux.conf` become a fifth component (`tmux`) or remain outside the CLI?
- [ ] GitHub Actions CI to auto-build binaries on release, or manual build?
- [ ] Should the CLI self-update (`cyberpunk upgrade` updates itself) or only update components?
