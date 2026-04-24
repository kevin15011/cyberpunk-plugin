# Proposal: Repo Test Stabilization

## Intent

Restore reliable repo verification by fixing the current brittle test failures without redesigning runtime architecture or widening product behavior.

## Scope

### In Scope
- Stabilize repo/network-dependent upgrade tests with deterministic mocks or skips.
- Isolate HOME/config-sensitive tests so they run against temp fixtures only.
- Remove writes to real user config paths during tests.
- Repair tmux/config test harness setup needed for reliable repo verification.

### Out of Scope
- Refactoring component modules to remove module-level HOME capture.
- Broad test runner redesign, subprocess isolation, or product feature changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- None.

## Approach

Apply a surgical test-only stabilization pass: mock or skip real git/network flows in `tests/upgrade-mode.test.ts`, restructure doctor/tmux/config tests so imports occur only after temp HOME setup, and keep all config reads/writes inside isolated temp directories. Limit production-code changes to small harness-enabling fixes only if tests cannot be stabilized otherwise.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `tests/upgrade-mode.test.ts` | Modified | Remove live repo/network dependency from repo-mode assertions |
| `tests/doctor-scenarios.test.ts` | Modified | Rework HOME-sensitive imports/fixtures for deterministic results |
| `tests/doctor.test.ts` | Modified | Align doctor import/setup with isolated HOME strategy |
| `tests/config.test.ts` | Modified | Replace real config path usage with temp HOME-backed config |
| `tests/tmux-component.test.ts` | Modified | Ensure config/test setup is created before install assertions |
| `src/commands/doctor.ts` / component modules | Modified (minimal) | Only if required for narrow harness support |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bun module cache still leaks state across files | Med | Consolidate imports after HOME setup; verify full suite order-independently |
| Mocking reduces real git coverage | Low | Keep scope to dispatch verification and document deferred integration coverage |

## Rollback Plan

Revert the test-file changes for this change set and any minimal harness adjustments, then rerun the suite to confirm behavior returns to the prior baseline.

## Dependencies

- Existing Bun test runner and current OpenSpec specs for `cyberpunk-upgrade`, `cyberpunk-config`, `doctor`, and `cyberpunk-install`.

## Success Criteria

- [ ] The currently failing repo/network-, HOME-, and config-path-dependent tests pass deterministically in temp-only environments.
- [ ] No test writes to the real user `~/.config/cyberpunk` path.
- [ ] Repo verification is reliable again without broad architectural redesign.
