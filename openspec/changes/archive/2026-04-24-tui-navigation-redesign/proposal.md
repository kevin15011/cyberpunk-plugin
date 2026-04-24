# Proposal: TUI Navigation Redesign

## Intent

Replace the current prompt-by-prompt TUI with a navigable screen shell so users can move between install, uninstall, status, and result views without re-entering linear flows. Preserve the existing non-interactive CLI contract for scripts and automation.

## Scope

### In Scope
- Add a screen-based TUI shell with shared header/footer, back/quit controls, and central state.
- Introduce routing for core screens: home, install, uninstall, status, task progress, and results/details.
- Support task/result navigation so users can review outcomes and return to the shell without restarting.

### Out of Scope
- Rewriting component install/uninstall/status logic.
- Expanding non-interactive commands, adding new components, or redesigning doctor/config flows.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `cyberpunk-tui`: change interactive behavior from linear prompts to a persistent navigable shell while keeping flag-driven CLI bypass intact.

## Approach

Keep command execution and output formatting logic in existing command modules. Replace `src/tui/index.ts` with a Bubble Tea-style shell composed of screen models/routes, adapter layers for existing install/status actions, and result views that can drill into per-component outcomes before returning home.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/tui/index.ts` | Modified | Replace prompt loop with app shell bootstrap |
| `src/tui/` | New/Modified | Add routing, screen models, shared navigation/state |
| `src/index.ts` | Modified | Keep `tui` entrypoint wired to new shell |
| `src/commands/install.ts` | Modified | Expose task-friendly progress/result hooks if needed |
| `openspec/specs/cyberpunk-tui/spec.md` | Modified | Update interactive TUI requirements |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UI rewrite breaks current install flows | Med | Reuse existing command functions and keep shell as orchestration only |
| Navigation scope grows into full redesign | Med | Limit MVP to shell, routing, core screens, and results navigation |

## Rollback Plan

Revert the TUI shell changes and restore the current `@clack/prompts`-driven `src/tui/index.ts`, leaving non-interactive commands untouched.

## Dependencies

- Existing command modules remain the source of truth for install, uninstall, and status operations.

## Success Criteria

- [ ] `cyberpunk` opens a persistent shell with navigable core screens instead of chained prompts.
- [ ] Users can run install/uninstall/status flows, inspect results, and return to the shell without restarting.
- [ ] Flag-driven commands continue to bypass the TUI and behave as before.
