# Tasks: Tmux Component

## Phase 1: Types & Config Foundation

- [x] 1.1 Add `"tmux"` to `ComponentId` union in `src/components/types.ts`
- [x] 1.2 Add `"tmux"` to `ComponentId` type, `COMPONENT_IDS` array, `COMPONENT_LABELS` map, and `createDefaultConfig()` in `src/config/schema.ts`
- [x] 1.3 Add `"tmux"` to `VALID_COMPONENTS` set in `src/cli/parse-args.ts` and add `--tmux` case to component flag switch

## Phase 2: Core Tmux Module

- [x] 2.1 Create `src/components/tmux.ts` with `getTmuxComponent()` factory implementing `ComponentModule` — `id`, `label`, `install()`, `uninstall()`, `status()`, `doctor()`
- [x] 2.2 Implement marker-managed block read/write helpers: `readManagedBlock()`, `insertManagedBlock()`, `removeManagedBlock()` using `# cyberpunk-managed:start` / `# cyberpunk-managed:end` markers
- [x] 2.3 Implement `install()`: read bundled `tmux.conf` asset, backup `~/.tmux.conf`, insert/replace managed block, update config state
- [x] 2.4 Implement `uninstall()`: backup `~/.tmux.conf`, remove managed block only, update config state
- [x] 2.5 Implement `status()`: check tmux binary on PATH + managed block presence → `installed` | `available` | `error`
- [x] 2.6 Implement `doctor()`: emit `tmux:binary`, `tmux:config`, `tmux:tpm`, `tmux:gitmux` checks; only `tmux:config` is fixable

## Phase 3: Command Wiring

- [x] 3.1 Register `getTmuxComponent` in `COMPONENT_FACTORIES` in `src/commands/install.ts`
- [x] 3.2 Add `getTmuxComponent` to `ALL_COMPONENTS` array in `src/commands/status.ts`
- [x] 3.3 Register `getTmuxComponent` in `COMPONENT_FACTORIES` in `src/commands/doctor.ts` and add `applyTmuxFix()` handler for `tmux:config` fix

## Phase 4: CLI & TUI Surface

- [x] 4.1 Add `--tmux` line to help text in `src/cli/output.ts` `formatHelp()`
- [x] 4.2 Verify TUI in `src/tui/index.ts` picks up tmux automatically via `collectStatus()` — no changes needed if component is registered

## Phase 5: Documentation

- [x] 5.1 Update `README.md` — replace manual tmux copy instructions with CLI-managed guidance (`cyberpunk install --tmux`) and note TPM remains manual/optional
