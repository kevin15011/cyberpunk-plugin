# Design: Tmux TPM Bootstrap

## Technical Approach

Extend the existing marker-managed tmux installer rather than adding a new workflow. `getTmuxComponent().install()` remains responsible for writing `~/.tmux.conf`; after a successful or skipped config write it will run a best-effort TPM bootstrap step that checks for `git`, clones TPM only when `~/.tmux/plugins/tpm` is absent, and invokes TPM install/update scripts. Doctor/status reuse the same tmux helper layer so config ownership remains authoritative while TPM/network issues stay advisory.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Bootstrap hook point | Run TPM bootstrap after managed block install/refresh | Separate command; bootstrap before config write | Keeps `install --tmux` one-step and guarantees plugin declarations exist before TPM install runs. |
| Failure model | Treat missing `git`, clone failure, and TPM script failure as warnings/messages, not install errors | Fail whole tmux install | Proposal and doctor spec require config/bootstrap scope only; managed config must succeed independently of network/git state. |
| Doctor repair scope | `--fix` may restore config, clone TPM when missing, and rerun plugin install/update; never reload active tmux sessions | Keep current config-only fix; auto `tmux source-file` | Aligns with new readiness goal while preserving out-of-scope session orchestration boundary. |
| Readiness signal | Represent TPM/plugin readiness in tmux doctor checks and degrade tmux `status()` with advisory detail, not hard failure | Add per-plugin health; fail component status on plugin fetch issues | Fits existing status/doctor model and avoids introducing network-dependent state into normal status collection. |

## Data Flow

```text
install --tmux
  -> write/refresh managed ~/.tmux.conf block
  -> check git availability
  -> if TPM missing: git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
  -> if TPM present: run bin/install_plugins or scripts/install_plugins.sh all
  -> optionally run update_plugins all when TPM already existed
  -> return success/skipped plus advisory message(s)

doctor --fix --tmux
  -> tmux doctor() emits checks: binary, config, tpm, plugins, gitmux
  -> applyTmuxFix dispatches by check id
  -> repair config first, then bootstrap TPM/plugins best-effort
  -> mark fixed only when targeted repair succeeds; leave warnings otherwise
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/tmux.ts` | Modify | Add path/command helpers for git, TPM clone, install/update scripts, plugin-readiness check, and richer install/doctor/status messages. |
| `src/components/types.ts` | Modify | Extend doctor prerequisites to include `git` and allow install/status messaging needed for advisory bootstrap results. |
| `src/components/platform.ts` | Modify | Surface `git` prerequisite once for shared doctor context. |
| `src/commands/doctor.ts` | Modify | Add tmux fix handlers for `tmux:tpm` / `tmux:plugins`, preserve non-fatal continuation semantics, and keep config-before-bootstrap ordering. |
| `tests/tmux-component.test.ts` | Modify | Cover install idempotency, missing-git warning path, clone/script failure advisories, and doctor check expansion. |
| `tests/doctor*.test.ts` | Modify | Cover tmux fix ordering and partial fix outcomes without touching real HOME. |
| `README.md` | Modify | Replace manual TPM bootstrap instructions with automatic/best-effort behavior and troubleshooting guidance. |

## Interfaces / Contracts

```ts
type TmuxBootstrapResult = {
  tpmState: "present" | "cloned" | "missing-git" | "clone-failed"
  pluginsState: "ready" | "installed" | "updated" | "script-missing" | "install-failed"
  warnings: string[]
}
```

`tmux.doctor()` will add `tmux:plugins` (`pass|warn`, `fixable: true` when TPM exists or git is available) and make `tmux:tpm` fixable when repair is actionable. `status()` may remain `installed` when config is owned, but should expose advisory error text only for hard config/binary issues.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Marker-preserving install plus bootstrap helper branching | Bun tests with temp HOME and stubbed `execSync` outcomes. |
| Unit | Doctor repair ordering and partial success | Existing doctor fixture pattern, asserting later fixes still run after clone/install failures. |
| Integration | End-to-end tmux install/doctor on isolated fixtures | Reuse HOME-isolated tests; assert no real user files or live tmux reloads. |
| E2E | None | Not available in current project. |

## Migration / Rollout

No migration required. Existing users keep their managed tmux block; first subsequent `install --tmux` or `doctor --fix --tmux` attempts TPM bootstrap opportunistically.

## Open Questions

- [ ] Should existing TPM installs run `update_plugins all` every time, or only during doctor fix / explicit reinstall?
- [ ] Which TPM script path is most stable across versions (`bin/install_plugins` vs `scripts/install_plugins.sh`), and should we probe both in order?
