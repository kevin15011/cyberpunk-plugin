# Tasks: cyberpunk-tui

## Bootstrap Phase

- [x] **task**: Create `package.json` with `@clack/prompts` dependency and build/dev scripts
- [x] **task**: Create `tsconfig.json` targeting ESNext, moduleResolution bun
- [x] **task**: Create `build.ts` script using `bun build --compile`
- [x] **task**: Create `src/` directory structure per design

## Core CLI Phase

- [x] **task**: Create `src/config/schema.ts` — `CyberpunkConfig` interface with defaults
- [x] **task**: Create `src/config/load.ts` — read config, auto-create dirs + file on first access
- [x] **task**: Create `src/config/save.ts` — atomic write via `.tmp` then rename
- [x] **task**: Create `src/cli/parse-args.ts` — parse `process.argv` into `ParsedArgs` interface
- [x] **task**: Create `src/cli/output.ts` — format results as text or `--json`
- [x] **task**: Create `src/index.ts` — entry point: argv parse → command dispatch
- [x] **task**: Create `src/commands/config.ts` — get/set/list/init config values
- [x] **task**: Create `src/commands/status.ts` — collect `Component[]` from all modules, return status

## TUI Phase

- [x] **task**: Create `src/tui/theme.ts` — Cyberpunk ANSI color constants
- [x] **task**: Create `src/tui/index.ts` — Interactive TUI with `@clack/prompts`, keyboard nav, component toggles

## Components Phase

- [x] **task**: Create `src/components/types.ts` — `ComponentId`, `InstallResult`, `ComponentStatus`, `ComponentModule` interfaces
- [x] **task**: Create `src/components/plugin.ts` — copy plugin to `~/.config/opencode/plugins/cyberpunk.ts`
- [x] **task**: Create `src/components/theme.ts` — write theme JSON + activate in `tui.json`
- [x] **task**: Create `src/components/sounds.ts` — generate `.wav` files via ffmpeg
- [x] **task**: Create `src/components/context-mode.ts` — npm install -g + write routing instructions
- [x] **task**: Create `src/commands/install.ts` — orchestrates component install/uninstall, returns `InstallResult[]`
- [x] **task**: Create `src/commands/upgrade.ts` — git fetch, compare versions, replace files preserving config

## Build Phase

- [ ] **task**: Create `cyberpunk-plugin.ts` — bundled slimmed plugin source (plugin component copies this)
- [ ] **task**: Modify `install.sh` — replace inline logic with binary download from GitHub Releases
- [x] **task**: Verify binary builds and runs via `bun build --compile`

## Refactor Phase

- [x] **task**: Refactor `cyberpunk.ts` — strip install/config logic, keep only `playSound()` + event handlers
- [x] **task**: Verify refactored plugin still plays sounds on `session.idle`, `session.error`, `session.compacted`, `permission.asked`

## Open Questions (deferred)

- [ ] Resolve tmux component decision — fifth component or remain outside CLI?
- [ ] Resolve CI strategy — GitHub Actions auto-build or manual?
- [ ] Resolve self-update strategy — CLI self-update or only components?
