# Proposal: Tmux TPM Bootstrap

## Intent

Make `cyberpunk install --tmux` leave users with a TPM-ready tmux setup by bootstrapping TPM and plugin installation automatically when safe, while keeping the slice limited to config/bootstrap work only.

## Scope

### In Scope
- Clone TPM into `~/.tmux/plugins/tpm` during tmux install when missing and `git` is available.
- Run `install_plugins` after the managed tmux block is written; treat network/plugin failures as non-fatal warnings.
- Expose doctor/status signals for TPM presence and plugin installation readiness, with safe `--fix` handlers.

### Out of Scope
- Active tmux session reloads or `tmux source-file` automation.
- Broader tmux orchestration such as plugin updates, per-plugin health, or gitmux bootstrap.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `cyberpunk-install`: Extend tmux install behavior to bootstrap TPM/plugins as an idempotent post-config step.
- `doctor`: Extend tmux diagnostics to report TPM/plugin readiness and allow safe repair for missing TPM/plugins.

## Approach

Keep the existing marker-owned tmux config flow unchanged. After config install, check for `git`, clone TPM only if absent, then invoke TPM `install_plugins`. Doctor will add a `tmux:plugins` readiness check and make `tmux:tpm` fixable. Missing git, clone failure, or plugin install failure stay advisory unless the managed config itself is broken.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/tmux.ts` | Modified | Add TPM bootstrap/install flow and readiness checks |
| `src/components/types.ts` | Modified | Extend prerequisites/check typing if needed for `git` |
| `src/commands/doctor.ts` | Modified | Add fix handlers for TPM/plugin remediation |
| `README.md` | Modified | Remove manual TPM bootstrap steps |
| `openspec/specs/cyberpunk-install/spec.md` | Modified | Capture tmux bootstrap behavior |
| `openspec/specs/doctor/spec.md` | Modified | Capture tmux TPM/plugin diagnostics behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing `git` blocks TPM clone | Med | Detect first; report actionable warning |
| Network/plugin install failure | Med | Keep bootstrap non-fatal; preserve installed config |
| Existing custom TPM setup | Low | Clone only when TPM dir is absent |

## Rollback Plan

Revert the tmux bootstrap changes, restore prior tmux doctor behavior, and leave the managed tmux block lifecycle unchanged. Users keep any already-cloned TPM/plugins because rollback only removes cyberpunk-managed automation, not third-party repos.

## Dependencies

- `git` on PATH for TPM clone
- Network access when TPM or plugins must be fetched

## Success Criteria

- [ ] `cyberpunk install --tmux` clones TPM when missing without disturbing unmanaged tmux config.
- [ ] Doctor reports TPM/plugin readiness and `--fix` can recover missing TPM/plugins safely.
- [ ] No automatic active-session reload is introduced in this slice.
