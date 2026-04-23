# Exploration: tmux-component

## Executive Summary

The existing `tmux.conf` (113 lines, cyberpunk HUD theme) is a **bundled asset** currently installed only via manual README instructions. It can be productized as a 6th component (`"tmux"`) following the established `ComponentModule` pattern with minimal architectural changes. The safe first slice covers **install/uninstall/status/doctor** with **non-destructive config merging** — no TPM/plugin management, no active-session reload in slice 1.

## Current State

### How the system works today

1. **Existing tmux asset**: `tmux.conf` at repo root — a complete cyberpunk-themed tmux configuration with:
   - Terminal settings (256color, mouse, history, vi mode)
   - 8 TPM plugins: `tpm`, `tmux-sensible`, `tmux-resurrect`, `tmux-continuum`, `tmux-cpu`, `tmux-yank`, `gitmux`
   - Keybindings: `Ctrl-a` prefix, `h/j/k/l` navigation, `|/-` splits, `r` reload
   - Cyberpunk HUD status bar with CPU, RAM, git branch, clock
   - Visual bell, neon colors

2. **Current installation**: Manual README instructions only:
   ```bash
   cp tmux.conf ~/.tmux.conf
   git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
   ~/.tmux/plugins/tpm/bin/install_plugins all
   tmux source-file ~/.tmux.conf
   ```

3. **Current uninstall**: README says `rm ~/.tmux.conf` — **destructive**, wipes any user customizations.

4. **OpenSpec history**: `cyberpunk-tui` design doc explicitly deferred this as an open question:
   > "Should `tmux.conf` become a fifth component (`tmux`) or remain outside the CLI?"
   The `toolkit-doctor-repair` proposal also listed "tmux or preset integration" as a future consideration.

### Component architecture (established pattern)

Each component follows this interface in `src/components/types.ts`:
```typescript
interface ComponentModule {
  id: ComponentId
  label: string
  install(): Promise<InstallResult>
  uninstall(): Promise<InstallResult>
  status(): Promise<ComponentStatus>
  doctor?(ctx: DoctorContext): Promise<DoctorResult>
}
```

Adding a component requires changes in exactly **6 locations**:
| Location | Change |
|----------|--------|
| `src/config/schema.ts` | Add `"tmux"` to `ComponentId` union, `COMPONENT_IDS`, `COMPONENT_LABELS` |
| `src/components/tmux.ts` | New file implementing `getTmuxComponent()` |
| `src/commands/install.ts` | Add factory to `COMPONENT_FACTORIES` |
| `src/commands/status.ts` | Add `getTmuxComponent` to `ALL_COMPONENTS` |
| `src/commands/doctor.ts` | Add factory + fix handler in repair order |
| `src/cli/parse-args.ts` | Add `"--tmux"` to component flags + `VALID_COMPONENTS` |
| `src/cli/output.ts` | No change — uses `COMPONENT_LABELS` dynamically |

## Affected Areas

- `src/config/schema.ts` — ComponentId type, COMPONENT_IDS array, COMPONENT_LABELS map
- `src/components/tmux.ts` — **NEW** component module
- `src/commands/install.ts` — COMPONENT_FACTORIES registry
- `src/commands/status.ts` — ALL_COMPONENTS array
- `src/commands/doctor.ts` — COMPONENT_FACTORIES + repair order + applyTmuxFix handler
- `src/cli/parse-args.ts` — VALID_COMPONENTS set + case for `--tmux` flag
- `tmux.conf` — Source asset (read-only, no changes needed)
- `README.md` — Update manual install section to reference CLI
- `openspec/specs/cyberpunk-tui/spec.md` — Update component count references
- `~/.config/cyberpunk/config.json` — New `tmux` component state entry

## Approaches

### Approach A: Full component with config merging (Recommended)

Install `tmux.conf` content by **appending** cyberpunk sections to the user's existing `~/.tmux.conf` (or creating it if absent), using marker comments for idempotent management.

| Aspect | Details |
|--------|---------|
| **Install** | If `~/.tmux.conf` doesn't exist → write full config. If exists → append cyberpunk sections between `<!-- cyberpunk:start -->` / `<!-- cyberpunk:end -->` markers. Install TPM if not present. |
| **Uninstall** | Remove only content between markers. If file was created by us (empty before), delete it. |
| **Status** | Check: markers present in config, TPM installed, gitmux available. |
| **Doctor** | Checks: config markers, TPM presence, gitmux binary, plugin installation state. |
| **Pros** | Non-destructive to user's existing tmux config; idempotent; follows established marker pattern (same as plugin.ts sdd-phase-common.md patching); clean uninstall |
| **Cons** | More complex than simple file copy; marker-based merging requires careful parsing |
| **Effort** | Medium — new component file (~200-300 lines), 6 registry updates |

### Approach B: Simple file copy (replace user config)

Copy `tmux.conf` to `~/.tmux.conf`, backing up existing file as `~/.tmux.conf.bak`.

| Aspect | Details |
|--------|---------|
| **Install** | Backup existing `~/.tmux.conf` → write full cyberpunk config |
| **Uninstall** | Restore from backup or delete |
| **Pros** | Simple; matches current README behavior; easy to implement |
| **Cons** | **Destructive** — replaces entire user config; backup may be stale; users with existing tmux setups will lose customizations; high risk for a first slice |
| **Effort** | Low — ~100 lines |

### Approach C: Symlink to bundled config

Create `~/.tmux.conf` as a symlink to the repo's `tmux.conf`.

| Aspect | Details |
|--------|---------|
| **Pros** | Updates propagate when repo updates |
| **Cons** | Requires repo to stay on disk; breaks if user moves repo; no customization possible; symlink behavior varies across WSL/macOS |
| **Effort** | Low |

### Recommendation

**Approach A** — marker-based config merging. This is the safest path because:
1. It's **non-destructive** — users keep their existing tmux config
2. It follows the **established marker pattern** already used in `plugin.ts` for `sdd-phase-common.md` patching
3. It enables **clean uninstall** without data loss
4. It's **idempotent** — running install twice doesn't duplicate content
5. It leaves room for future slices (TPM plugin management, active-session reload)

## Safe Scope Boundaries for First Slice

### IN scope (slice 1):
| Capability | Details |
|------------|---------|
| **Install** | Append cyberpunk sections to `~/.tmux.conf` using markers; create file if absent |
| **Uninstall** | Remove only managed sections between markers |
| **Status** | Check if markers present, TPM exists, gitmux available |
| **Doctor** | 3-4 checks: config integrity, TPM presence, gitmux binary |
| **Config tracking** | Record in `~/.config/cyberpunk/config.json` |
| **TUI integration** | Appears as 6th checkbox in multiselect |
| **CLI flags** | `cyberpunk install --tmux`, `cyberpunk status --tmux` |

### OUT of scope (deferred to later slices):
| Capability | Reason |
|------------|--------|
| **TPM plugin install/management** | Requires git clone + `tpm install_plugins`; complex error handling; user may already have TPM |
| **Active-session reload** | `tmux source-file` requires detecting active sessions; risky if user is inside tmux |
| **Per-plugin status** | Individual TPM plugin health checks are complex |
| **Config customization** | Letting users pick which sections to install |
| **WSL-specific paths** | Can be handled in a follow-up |

## Cross-Platform Considerations

| Dimension | Linux | macOS | WSL |
|-----------|-------|-------|-----|
| **tmux binary** | Usually pre-installed | `brew install tmux` | Same as Linux host |
| **Config path** | `~/.tmux.conf` | `~/.tmux.conf` | `~/.tmux.conf` (WSL home) |
| **TPM path** | `~/.tmux/plugins/tpm` | Same | Same |
| **gitmux** | `go install` or package mgr | `brew install gitmux` | Same as Linux |
| **tmux-cpu plugin** | Works | Works (CPU stats via different backend) | Works |
| **Terminal colors** | 256color widely supported | iTerm2/Terminal.app support RGB | Depends on Windows Terminal config |
| **`which` command** | Available | Available | Available |

**Key risk**: `tmux` itself may not be installed. The component should check for tmux availability and return `status: "error"` if tmux is not on PATH.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **User loses existing tmux config** | **High** | Use marker-based appending, never overwrite. Always backup before any write. |
| **TPM installation fails silently** | Medium | TPM install is out of scope for slice 1. Just check presence. |
| **gitmux not installed → status bar broken** | Medium | Doctor check warns if gitmux missing. Status bar still works, just shows empty gitmux field. |
| **User runs install while inside tmux** | Low | Slice 1 does NOT reload tmux. User must manually `prefix + r` or restart tmux. |
| **WSL path differences** | Low | `~/.tmux.conf` is consistent across platforms. WSL-specific issues deferred. |
| **macOS tmux version incompatibility** | Low | `pane-border-lines heavy` requires tmux 3.2+. Most modern installs have this. Doctor could check version. |
| **Marker collision with user content** | Low | Use distinctive markers: `# cyberpunk-managed:start` / `# cyberpunk-managed:end` |
| **Config file permissions** | Low | Standard `644` permissions; same as existing components. |

## Implementation Notes

### Tmux config sectioning strategy

The `tmux.conf` can be logically split into sections for granular management:
```
# cyberpunk-managed:start:general
# (terminal settings, mouse, history, vi mode)
# cyberpunk-managed:end:general

# cyberpunk-managed:start:keybindings
# (prefix, splits, navigation, resize, reload)
# cyberpunk-managed:end:keybindings

# cyberpunk-managed:start:colors
# (all cyberpunk color definitions)
# cyberpunk-managed:end:colors

# cyberpunk-managed:start:status
# (status bar left/right format)
# cyberpunk-managed:end:status
```

However, for **slice 1**, a single managed block is sufficient:
```
# cyberpunk-managed:start
# (entire tmux.conf content)
# cyberpunk-managed:end
```

### Doctor checks (slice 1)

| Check ID | Label | Status Logic | Fixable |
|----------|-------|-------------|---------|
| `tmux:binary` | tmux binary | `which tmux` → pass/fail | No |
| `tmux:config` | Config gestionado | Markers present in `~/.tmux.conf` → pass/fail | Yes (install) |
| `tmux:tpm` | TPM plugin manager | `~/.tmux/plugins/tpm/tpm` exists → pass/warn | No (out of scope) |
| `tmux:gitmux` | gitmux binary | `which gitmux` → pass/warn | No |

### Status detection logic

- `installed`: markers present in `~/.tmux.conf` AND tmux binary available
- `available`: tmux binary available but markers not present
- `error`: tmux binary not found

## Ready for Proposal

**Yes.** The investigation is complete with:
- Clear understanding of the existing tmux asset (113-line config file)
- Established component pattern to follow (6 registry changes + new module)
- Recommended approach: marker-based config merging (non-destructive, idempotent)
- Defined safe scope boundaries for slice 1 (install/uninstall/status/doctor only)
- Identified cross-platform considerations and risks
- No implementation blockers found
