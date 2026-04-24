# Exploration: tmux-tpm-bootstrap

## Executive Summary

The existing tmux component (`src/components/tmux.ts`) manages marker-owned `~/.tmux.conf` with install/uninstall/status/doctor but **explicitly deferred** TPM auto-install and active-session reload. This change would add TPM bootstrap (git clone + `install_plugins`) and optionally safe session reload, completing the tmux experience so users get a working cyberpunk tmux setup with one command instead of 3-4 manual steps.

## Current State

### What the tmux component does today

The tmux component in `src/components/tmux.ts` (414 lines) implements:

| Capability | Behavior |
|---|---|
| **install()** | Reads `~/.tmux.conf`, inserts cyberpunk config between `# cyberpunk-managed:start/end` markers, atomic write with `.bak` backup, persists state to `~/.config/cyberpunk/config.json` |
| **uninstall()** | Removes only the managed block, preserves user config outside markers |
| **status()** | Checks tmux binary on PATH + managed block presence → `installed` \| `available` \| `error` |
| **doctor()** | 4 checks: `tmux:binary` (pass/warn), `tmux:config` (pass/fail, fixable), `tmux:tpm` (pass/warn), `tmux:gitmux` (pass/warn) |

### What was explicitly deferred (from `2026-04-23-tmux-component` archive)

From the original exploration's **OUT of scope** table:

| Deferred Capability | Original Reason |
|---|---|
| **TPM plugin install/management** | Requires git clone + `tpm install_plugins`; complex error handling; user may already have TPM |
| **Active-session reload** | `tmux source-file` requires detecting active sessions; risky if user is inside tmux |
| **Per-plugin status** | Individual TPM plugin health checks are complex |

From the original design's **Open Questions**:
- Missing `tmux` binary → `error` vs `available` (resolved: `error`)
- Empty `~/.tmux.conf` after uninstall → delete vs preserve (resolved: preserve)

### Current user experience gap

After `cyberpunk install --tmux`, the user must still manually:
1. `git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm`
2. `~/.tmux/plugins/tpm/bin/install_plugins` (or `install_plugins all`)
3. `tmux source-file ~/.tmux.conf` (if inside an active session)

The README documents these steps explicitly. The doctor warns about missing TPM but cannot fix it.

## Affected Areas

- `src/components/tmux.ts` — Add TPM bootstrap logic, session reload, new doctor checks
- `src/components/types.ts` — Potentially extend `DoctorContext.prerequisites` with `git`
- `src/commands/doctor.ts` — New fix handlers for `tmux:tpm` and `tmux:plugins`
- `src/commands/install.ts` — Optional: trigger TPM bootstrap after config install
- `README.md` — Remove or simplify manual TPM instructions
- `openspec/specs/cyberpunk-tui/spec.md` — Update component behavior expectations

## Approaches

### Approach A: TPM bootstrap + safe reload (Recommended)

Add TPM clone + `install_plugins` to the install flow, plus a safe `tmux source-file` reload when a tmux server is running.

| Aspect | Details |
|---|---|
| **TPM clone** | `git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm` — guarded by `test -d` check |
| **Plugin install** | `~/.tmux/plugins/tpm/bin/install_plugins` — runs after config is written so `@plugin` lines exist |
| **Session reload** | `tmux source-file ~/.tmux.conf` — only if `tmux list-sessions` shows a running server |
| **Doctor fixes** | `tmux:tpm` becomes fixable (clone TPM); new `tmux:plugins` check (run install_plugins) |
| **Pros** | Complete one-command experience; doctor can auto-fix TPM gaps; safe reload detection |
| **Cons** | Adds git dependency; `install_plugins` can be slow (clones 7+ repos); network required |
| **Effort** | Medium — ~150-200 new lines in tmux.ts, doctor fix handlers, prerequisite checks |

### Approach B: TPM bootstrap only (no reload)

Add TPM clone + `install_plugins` but leave session reload as manual (user presses `prefix + r`).

| Aspect | Details |
|---|---|
| **TPM clone** | Same as Approach A |
| **Plugin install** | Same as Approach A |
| **Session reload** | NOT included — user reloads manually |
| **Pros** | Simpler; zero risk of interfering with active sessions; still eliminates the biggest friction (manual git clone + install_plugins) |
| **Cons** | User still needs one manual step; plugins won't load until next tmux start or manual reload |
| **Effort** | Low-Medium — ~100-150 new lines |

### Approach C: TPM bootstrap + reload + plugin update

Full management: clone TPM, install plugins, reload sessions, and add `cyberpunk update --tmux` for plugin updates via `tpm bin/update_plugins`.

| Aspect | Details |
|---|
| **Scope** | Everything in A plus plugin update workflow |
| **Pros** | Complete lifecycle management |
| **Cons** | Significantly more complex; update_plugins requires running tmux; per-plugin status tracking; version pinning considerations |
| **Effort** | High — 300+ new lines, new command or flag |

### Recommendation

**Approach B (TPM bootstrap only, no reload)** as the minimal slice, with Approach A's reload as a follow-up. Rationale:

1. **Biggest user friction is TPM setup** — git clone + install_plugins is 2-3 minutes of waiting and potential errors. Eliminating this gives 80% of the value.
2. **Session reload is low-risk and low-value** — users already have `prefix + r` bound to reload. Adding auto-reload is nice but not essential.
3. **Keeps the change small and safe** — no tmux server interaction, no session detection complexity.
4. **Doctor can fix TPM gaps** — after this change, `cyberpunk doctor --fix` becomes a complete recovery path.

## Recommended Implementation Scope

### IN scope:
| Capability | Details |
|---|---|
| **TPM clone on install** | If `~/.tmux/plugins/tpm` doesn't exist, git clone it. Idempotent. |
| **TPM install_plugins on install** | Run `~/.tmux/plugins/tpm/bin/install_plugins` after config write. Non-blocking (`.nothrow()`). |
| **Doctor: tmux:tpm fixable** | Change `fixable: false` → `true`, add fix handler that clones TPM |
| **Doctor: tmux:plugins check** | New check — verifies at least one TPM plugin directory exists under `~/.tmux/plugins/` |
| **Doctor: tmux:plugins fixable** | Runs `install_plugins` if plugins are missing |
| **Prerequisite: git** | Add git to platform prerequisites or check inline |
| **Cross-platform safety** | `test -d` guard before clone; handle missing git gracefully |

### OUT of scope (remain deferred):
| Capability | Reason |
|---|---|
| **Active session reload** | Low value, user has `prefix + r`. Can be added later safely. |
| **Plugin update workflow** | Requires running tmux server, more complex state tracking. |
| **Per-plugin health checks** | Complex, low value for MVP. |
| **gitmux auto-install** | Different install paths per OS (brew vs go install vs binary). |

## Cross-Platform Safety Matrix

| Platform | TPM Clone | install_plugins | gitmux | Notes |
|---|---|---|---|---|
| **Linux** | ✅ Works | ✅ Works | ⚠️ Manual (go install / apt) | git usually present |
| **WSL** | ✅ Works | ✅ Works | ⚠️ Manual (same as Linux) | Same as Linux |
| **macOS** | ⚠️ Needs git (xcode-select) | ✅ Works | ✅ brew install gitmux | Check for git first |

**Key safety rules:**
1. Always check `git` availability before attempting TPM clone
2. Always check `~/.tmux/plugins/tpm` directory existence before clone (idempotent)
3. Run `install_plugins` with `.nothrow()` — network failures shouldn't crash install
4. Never run `install_plugins` if TPM wasn't just cloned AND doesn't already exist
5. Report TPM/plugin status as `warn` not `fail` — they're optional enhancements

## New Doctor Checks

| Check ID | Label | Status Logic | Fixable |
|---|---|---|---|
| `tmux:tpm` | TPM plugin manager | Dir exists → pass; missing → warn | **Yes** (clone via git) |
| `tmux:plugins` | TPM plugins installed | At least one plugin dir under `~/.tmux/plugins/` (excluding `tpm/`) → pass; none → warn | **Yes** (run install_plugins) |
| `tmux:gitmux` | gitmux binary | `which gitmux` → pass; missing → warn | No (remains manual) |
| `tmux:binary` | tmux binary | Unchanged from current | No |
| `tmux:config` | Config cyberpunk | Unchanged from current | Yes |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **git not installed** | Medium | Check before clone; return informative error/warning |
| **Network failure during clone** | Medium | `.nothrow()` error handling; status remains warn |
| **install_plugins is slow (7+ repos)** | Low | Run async/non-blocking; inform user it runs in background |
| **macOS xcode-select prompt** | Low | Detect and warn; user must run `xcode-select --install` first |
| **install_plugins fails on partial TPM** | Low | Check TPM exists before running; skip if TPM missing |
| **User has custom TPM setup** | Low | Only clone if `~/.tmux/plugins/tpm` doesn't exist |
| **WSL git credential issues** | Low | TPM uses HTTPS public repos — no auth needed |
| **Race condition: install runs while user is in tmux** | Low | install_plugins works regardless; user just needs to reload |

## Ready for Proposal

**Yes.** The investigation is complete with:
- Full understanding of what was deferred in the original tmux-component slice
- Clear gap analysis: 3 manual steps reduced to 0
- Recommended approach: TPM bootstrap only (no reload) for minimal safe slice
- Cross-platform safety matrix and error handling strategy
- New doctor check definitions with fix handlers
- No implementation blockers found
