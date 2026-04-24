# Proposal: TUI Doctor Upgrade Entrypoints

## Intent

Expose `doctor` and `upgrade` from the navigable TUI so users can discover and run both workflows without leaving the shell, while preserving today's non-interactive CLI contracts for scripts and flags.

## Scope

### In Scope
- Add Home menu/sidebar entrypoints for Doctor and Upgrade.
- Add routed Doctor and Upgrade TUI screens that present current status and actions.
- Reuse existing task/result flow where possible, including generalizing task plumbing for upgrade execution.

### Out of Scope
- Redesigning doctor output into a multi-screen deep inspector.
- Changing CLI arg parsing, command names, JSON output, or other non-interactive behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cyberpunk-tui`: home navigation and routed task flows now include doctor and upgrade entrypoints inside the interactive shell.

## Approach

Add `doctor` and `upgrade` route IDs, wire them through the router/app screen switch, and expose them from the home menu. Implement focused screens that call existing doctor/upgrade adapters, render concise status summaries, and trigger fix/upgrade actions through shared task/result mechanics. Generalize task execution types only enough to support upgrade; keep doctor read/repair flow and upgrade check/apply logic backed by existing command modules.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/tui/screens/home.ts` | Modified | Add Doctor/Upgrade menu items |
| `src/tui/types.ts` | Modified | Add routes and minimal state/task typing |
| `src/tui/app.ts` | Modified | Route new screens |
| `src/tui/screens/doctor.ts` | New | Doctor summary/fix screen |
| `src/tui/screens/upgrade.ts` | New | Upgrade check/apply screen |
| `src/tui/adapters.ts` | Modified | Add doctor/upgrade task adapters |
| `src/tui/index.ts` | Modified | Reuse/generalize task execution for upgrade |
| `openspec/specs/cyberpunk-tui/spec.md` | Modified | Define TUI doctor/upgrade behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Upgrade task flow is coupled to install/uninstall types | Med | Generalize shared task action shape only where required |
| Doctor output overwhelms smaller terminals | Med | Ship MVP summary/scrolling layout, defer deep drill-down |
| Doctor fix can change user files | Low | Require explicit confirmation before running repair |

## Rollback Plan

Remove the new home entries, routes, screens, and upgrade task generalization; keep `src/index.ts` command wiring unchanged so direct CLI `doctor`/`upgrade` still work.

## Dependencies

- Existing `src/commands/doctor.ts`, `src/commands/upgrade.ts`, and current TUI task/result screens.

## Success Criteria

- [ ] Running `cyberpunk` shows Doctor and Upgrade as navigable TUI entrypoints.
- [ ] Users can check doctor status, optionally confirm a fix, and review results without leaving the shell.
- [ ] Users can check upgrade status and run upgrade through the shell using reused task/result flow.
- [ ] `cyberpunk doctor` and `cyberpunk upgrade` non-interactive behavior remains unchanged.
