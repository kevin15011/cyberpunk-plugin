# Design: Tmux Component

## Technical Approach

Treat tmux as another `ComponentModule` so install/status/doctor/TUI continue to flow through the existing registries. Slice 1 adds `src/components/tmux.ts`, persists `components.tmux` in `~/.config/cyberpunk/config.json`, and manages only the cyberpunk-owned block inside `~/.tmux.conf` using deterministic `# cyberpunk-managed:start/end` markers around the bundled `tmux.conf` asset.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| tmux config ownership | Overwrite whole `~/.tmux.conf`; manage a bounded block | Manage one marker-wrapped block in place | Matches proposal risk mitigation and preserves user-owned config outside the managed region. |
| Install source | Inline TS string; read bundled asset file | Read repo `tmux.conf` and wrap it before write | Keeps one source of truth for tmux defaults and README examples. |
| Status semantics | Config-only; file-only; binary + file markers | `installed` requires tmux binary plus managed block | Aligns with proposal: installed means usable, while missing binary becomes actionable error. |
| Doctor fix scope | Auto-install TPM/gitmux; fix only managed config | Fix only missing/drifted managed block | TPM and `gitmux` are external dependencies; slice 1 keeps repair safe and non-destructive. |

## Data Flow

### Install / uninstall sequence

`parseArgs/runTUI` → `runInstall()` / `runUninstall()` → tmux factory → `src/components/tmux.ts` → read `~/ .tmux.conf` state → replace/remove marker block → atomic write + `.bak` backup → `saveConfig()`.

### Status / doctor sequence

`status` / `doctor` → tmux module → check `tmux` on PATH, marker block presence, TPM dir, `gitmux` on PATH → emit `ComponentStatus` or `DoctorCheck[]`.

```text
CLI/TUI
  -> commands/install|status|doctor
    -> components/tmux
      -> ~/.tmux.conf markers + ~/.tmux/plugins/tpm + PATH probes
      -> ~/.config/cyberpunk/config.json
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/tmux.ts` | Create | Marker-managed install/uninstall/status/doctor logic for tmux. |
| `src/components/types.ts` | Modify | Extend `ComponentId` union to include `tmux`. |
| `src/config/schema.ts` | Modify | Add `tmux` to IDs, labels, defaults, and persisted component state. |
| `src/commands/install.ts` | Modify | Register tmux factory in install/uninstall orchestration. |
| `src/commands/status.ts` | Modify | Include tmux in status collection order. |
| `src/commands/doctor.ts` | Modify | Register tmux doctor checks and add a safe tmux fix handler after config repair. |
| `src/cli/parse-args.ts` | Modify | Accept `--tmux` and include tmux in `--all`. |
| `src/cli/output.ts` | Modify | Help text inherits new component label automatically; add explicit `--tmux` line. |
| `src/tui/index.ts` | Modify | Surface tmux in install/uninstall/status flows via collected status list. |
| `README.md` | Modify | Replace manual copy instructions with CLI-managed tmux guidance and explain TPM remains manual/optional. |

## Interfaces / Contracts

```ts
type ComponentId = "plugin" | "theme" | "sounds" | "context-mode" | "rtk" | "tmux"

type TmuxDoctorCheckId =
  | "tmux:binary"
  | "tmux:config"
  | "tmux:tpm"
  | "tmux:gitmux"

interface ManagedTmuxBlock {
  start: "# cyberpunk-managed:start"
  end: "# cyberpunk-managed:end"
  body: string // bundled tmux.conf contents
}
```

Write contract: if `~/.tmux.conf` exists, only the marker block is inserted/replaced/removed; content outside the block is preserved byte-for-byte. Install writes a backup before mutation. Uninstall removes only the managed block and leaves the file otherwise intact.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Marker insert/replace/remove behavior | Temp HOME + fixture `~/.tmux.conf` cases: missing file, existing unmanaged file, repeated install, uninstall. |
| Unit | Status/doctor probes | Stub PATH/filesystem states for binary, TPM, `gitmux`, and markers. |
| Integration | CLI wiring | `parseArgs`, `runInstall`, `collectStatus`, and `runDoctor --fix` with tmux selected in temp HOME. |
| Manual | TUI visibility | Confirm tmux appears in multiselects and status output with expected labels/messages. |

## Migration / Rollout

No migration required. Existing users can adopt tmux later; first install creates or patches `~/.tmux.conf` non-destructively and records `components.tmux`. Slice 1 does not clone TPM or reload active tmux sessions.

## Open Questions

- [ ] Should missing `tmux` binary be reported as `error` in `status()` when markers exist, or `available` with an error message? Design assumes `error` to match “installed but unusable.”
- [ ] Should uninstall delete an otherwise-empty `~/.tmux.conf`, or preserve the empty file for maximal non-destructive behavior? Design assumes preserve.
