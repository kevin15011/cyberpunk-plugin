# Design: Repo Test Stabilization

## Technical Approach

Stabilize repo verification with test-first isolation, not runtime redesign. The change keeps production behavior intact while making `upgrade`, `doctor`, `config`, and `tmux` tests run against temp HOME fixtures and deterministic repo/network doubles. This follows the proposal’s surgical scope and avoids broad runner changes.

## Architecture Decisions

### Decision: Isolate HOME per test harness boundary

| Option | Tradeoff | Decision |
|---|---|---|
| Refactor all components to stop capturing HOME at module load | Larger runtime change, out of scope | Reject |
| Set `process.env.HOME` before cache-busted imports and keep fixture IO inside temp dirs | Test-only, matches existing patterns in `doctor-scenarios` and `tmux-component` | Choose |

**Rationale**: `src/components/*` and some doctor helpers capture HOME at import time, while `src/config/load.ts` resolves HOME at call time. The stable harness is therefore: set HOME → import module once for that file → reset temp filesystem between tests.

### Decision: Replace live repo upgrade checks with deterministic command doubles

| Option | Tradeoff | Decision |
|---|---|---|
| Keep calling real `git fetch origin main` from tests | Flaky, can hang offline, depends on remote state | Reject |
| Add a narrow test seam around repo command execution/detection in `src/commands/upgrade.ts` and stub it in tests | Small production touch, but deterministic | Choose |

**Rationale**: `tests/upgrade-mode.test.ts` currently assumes the local checkout can reach `origin/main`. The reliable boundary is to verify dispatch and result mapping, not live remote fetch behavior.

### Decision: Centralize temp-home helpers only where duplication blocks reliability

| Option | Tradeoff | Decision |
|---|---|---|
| Rewrite each file ad hoc | Repeats path/setup bugs | Reject |
| Introduce one small `tests/helpers/*` fixture utility for temp HOME, config paths, and cleanup | One extra file, lower drift | Choose |

**Rationale**: `upgrade-mode.test.ts` and `config.test.ts` currently resolve “actual” config paths before HOME is overridden. A shared helper keeps path derivation aligned with runtime behavior.

## Data Flow

    test file
      -> create temp HOME + fixture paths
      -> install repo/network/command doubles
      -> cache-busted import of command/component
      -> command reads temp config / captured HOME paths
      -> assertions inspect temp files + returned result

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `openspec/changes/repo-test-stabilization/design.md` | Create | Technical design for stabilization work. |
| `tests/helpers/test-home.ts` | Create | Shared temp HOME/config-path fixture helpers and cleanup utilities. |
| `tests/upgrade-mode.test.ts` | Modify | Replace live repo assertions with deterministic repo command stubs and temp HOME-backed config setup. |
| `tests/config.test.ts` | Modify | Stop using real resolved config paths; derive config paths only after temp HOME setup. |
| `tests/doctor.test.ts` | Modify | Import doctor/load modules only after temp HOME setup; keep all reads/writes in temp fixtures. |
| `tests/doctor-scenarios.test.ts` | Modify | Keep single imported doctor instance per file, but move all fixture creation/reset through shared temp HOME helpers. |
| `tests/tmux-component.test.ts` | Modify | Ensure config fixture exists before install/uninstall assertions and reuse shared HOME setup. |
| `src/commands/upgrade.ts` | Modify (minimal) | Add a narrow internal override seam for repo command execution only if Bun-level mocking is insufficient. |

## Surface Reconciliation Notes

The implementation surface ended up slightly broader than the original minimum file table because the suite-level contamination root cause crossed module boundaries.

- `tests/cli-preset-execution.test.ts` moved from mocked config modules to real temp-HOME fixtures so it stops leaking module state into later suites.
- `src/components/{plugin,theme,theme-doctor,sounds,context-mode,rtk,tmux}.ts` now resolve HOME-derived paths at call time rather than freezing them at import time; this keeps the stabilization fix surgical while removing the cross-suite leak at its source.
- `src/commands/doctor.ts` and `tests/doctor.test.ts` remain in-scope because doctor proof depends on the same HOME-isolation boundary.
- This final apply batch adds only direct evidence tests in `tests/doctor.test.ts`, `tests/config.test.ts`, and `tests/upgrade-mode.test.ts`; no new user-facing runtime behavior is introduced.

## Interfaces / Contracts

```ts
interface UpgradeTestOverrides {
  getRepoDir?: () => string
  gitCommand?: (args: string, cwd?: string) => string
}
```

Test-only contract: defaults preserve current runtime behavior; tests may install overrides before importing or invoking repo upgrade paths. No user-facing API changes.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Semver/platform/config path behavior | Keep pure helper assertions with cache-busted imports. |
| Integration | `runUpgrade`, `checkUpgrade`, `runDoctor`, tmux install/uninstall | Use temp HOME fixtures plus deterministic repo/network doubles; assert returned objects and temp-file side effects. |
| E2E | None | Not added in this change; live remote verification remains deferred. |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] Confirm whether Bun can reliably stub the internal repo command path without a source seam; if not, add the minimal override API above.
