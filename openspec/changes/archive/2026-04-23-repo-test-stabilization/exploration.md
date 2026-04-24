# Exploration: Repo Test Stabilization

## Current State

The repository has **249 tests across 17 files**, with **230 passing** and **19 failing** (3 unhandled errors). Failures cluster in 4 test files:

| File | Failures | Root Cause Category |
|------|----------|---------------------|
| `tests/upgrade-mode.test.ts` | 3 | Network/git-dependent (real `git fetch` calls) |
| `tests/doctor-scenarios.test.ts` | 9 | Bun module caching / HOME isolation |
| `tests/doctor.test.ts` | 1 | Bun module caching / HOME isolation |
| `tests/tmux-component.test.ts` | 2 | Config schema mismatch (tmux component) |
| `tests/config.test.ts` | 3 | Real config path pollution between tests |
| `tests/doctor-scenarios.test.ts` (tmux) | 1 | Same module caching issue |

**230 tests pass cleanly** — the majority of the test suite (pure unit tests, parse-args, presets, plugin registration logic, components, etc.) is stable.

## Root Cause Analysis

### Category A: Network/Git-Dependent Tests (`upgrade-mode.test.ts`, 3 failures)

Tests call the **real** `runUpgrade()` and `checkUpgrade()` functions which execute `git fetch origin main` and `git pull origin main`. These:
- **Time out** (5s) when network is unreachable or remote is not configured
- **Fail** when `git fetch` returns non-zero (no remote, auth issues)
- Are **not mocked** — the tests write a config with `installMode: "repo"` and expect the real git operations to succeed

**Not a regression** — these tests were always environment-dependent. They pass only when:
1. CWD is a git repo with `.git`
2. `origin` remote exists and is reachable
3. Network allows `git fetch`

### Category B: Bun Module Caching / HOME Isolation (`doctor-scenarios.test.ts`, 9 failures + `doctor.test.ts`, 1 failure)

**The core architectural problem.** Component modules (`theme.ts`, `sounds.ts`, `context-mode.ts`, `tmux.ts`) capture `HOME` at **module-level import time** via constants like:

```ts
const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const SOUNDS_DIR = join(HOME, ".config", "opencode", "sounds")
```

The test strategy uses cache-busted imports (`import("../src/commands/doctor.ts?" + Date.now())`) to force fresh module evaluation with `HOME=tempDir`. However:

1. `doctor.ts` has **static top-level imports** of all component modules
2. Bun's `?nonce` cache-busting **only invalidates the directly imported module**, not its transitive dependencies
3. If any component module was already imported by a **previous test file** (e.g., `tmux-component.test.ts` runs before `doctor-scenarios.test.ts`), it stays cached with the REAL HOME
4. The doctor then runs checks against the real filesystem, not the temp fixtures

**Evidence**: Tests that expect "fail" get "pass" because the real HOME has healthy state (theme activated, sounds present, MCP configured, tmux block present).

### Category C: Config Path Pollution (`config.test.ts`, 3 failures)

The "Config command success reporting" describe block uses `ACTUAL_CONFIG_PATH` (the real user config at `~/.config/cyberpunk/config.json`). Tests in this block:
- Write to the real config directory
- Are affected by config state left by other test files
- The `beforeEach` cleans the directory, but module-level caching of `loadConfig`/`saveConfig` means the config module may have stale state

Specific failures:
- `config set with valid top-level key` — `result.value` is `undefined` instead of `"binary"` (config was written but read-back failed)
- `config set with invalid nested key` — `success` is `true` instead of `false` (the key validation logic doesn't reject unknown keys)
- `config get with existing key` — `success` is `false` instead of `true` (config read returned wrong state)

### Category D: Tmux Config Schema Mismatch (`tmux-component.test.ts`, 2 failures)

Tests S7 and S8 expect `config.components.tmux` to exist after install/uninstall. The `tmux.ts` component correctly writes `config.components.tmux = { installed: true, ... }`. However, `readCyberpunkConfig()` in the test returns `null`, meaning the config file was never created.

**Root cause**: The tmux component calls `loadConfig()` → `ensureConfigExists()` → writes default config. But `loadConfig()` uses `getConfigPath()` which reads `process.env.HOME` at call time. The test sets HOME before the cache-busted import, so this should work. The issue is likely that `saveConfig()` fails silently or the config directory path resolution is inconsistent between the tmux module's captured `HOME` and the config module's dynamic `getHomeDir()`.

## Affected Areas

- `src/commands/upgrade.ts` — `checkRepoUpgrade()` / `runRepoUpgrade()` do real `git fetch`/`git pull`
- `src/commands/doctor.ts` — static imports of all component modules at top level
- `src/components/tmux.ts` — captures `HOME` at module level (line 11)
- `src/components/theme.ts` — captures `HOME` at module level (line 10)
- `src/components/sounds.ts` — captures `HOME` at module level (line 11)
- `src/components/context-mode.ts` — likely same pattern
- `src/components/rtk.ts` — likely same pattern
- `src/config/load.ts` — `getHomeDir()` reads `HOME` at call time (correct pattern)
- `src/config/save.ts` — uses `getConfigPath()` which calls `getHomeDir()` (correct pattern)
- `tests/doctor-scenarios.test.ts` — single shared `beforeAll` import, all tests share one tempDir
- `tests/upgrade-mode.test.ts` — no mocking for git operations in repo-mode tests
- `tests/config.test.ts` — uses real config path for command integration tests
- `tests/tmux-component.test.ts` — config file not being created despite HOME override

## Approaches

### Approach 1: Surgical Stabilization (Recommended)

**Scope**: Fix only the 19 failing tests with minimal code changes. No redesign.

**Actions**:
1. **upgrade-mode.test.ts** (3 failures): Skip or mock the 3 repo-mode tests that do real git operations. Add `test.skip` or mock `execSync` for git commands. These tests verify dispatch logic, not git behavior — the git behavior is tested elsewhere.
2. **doctor-scenarios.test.ts** (9 failures): Split into isolated test files per component, each with its own `beforeAll` that sets HOME and does a fresh import of only the needed component. Or: restructure to import all components within the `beforeAll` after setting HOME, ensuring no prior test file pollutes the cache.
3. **config.test.ts** (3 failures): Switch from real config path to temp HOME, matching the pattern used in the first describe block. Or fix the `setConfigValue` validation to reject unknown keys.
4. **tmux-component.test.ts** (2 failures): Ensure config directory exists before install, or verify that `loadConfig()` creates it. The issue may be a race between `ensureConfigExists()` directory creation and the test's `readCyberpunkConfig()` check.

**Pros**: Minimal changes, fast to implement, preserves existing test architecture
**Cons**: Doesn't fix the underlying module caching problem (just works around it)
**Effort**: Low-Medium

### Approach 2: Isolated Test Runner Pattern

**Scope**: Redesign test isolation so each test file runs in a subprocess with its own HOME.

**Actions**: Use Bun's `Bun.spawn()` or a test wrapper that runs each test file in isolation with a unique temp HOME. This eliminates all module caching cross-contamination.

**Pros**: Solves the root cause completely, no more HOME isolation issues
**Cons**: Significant redesign, slower test execution, changes how all tests work
**Effort**: High

### Approach 3: Dependency Injection for HOME

**Scope**: Refactor all component modules to accept HOME as a parameter instead of capturing it at module level.

**Actions**: Change `theme.ts`, `sounds.ts`, `tmux.ts`, etc. to use factory functions that accept a HOME parameter, or use a shared `getHomeDir()` function that reads `process.env.HOME` at call time (like `config/load.ts` already does).

**Pros**: Clean architecture, eliminates the class of bugs entirely
**Cons**: Touches every component module, risk of regressions, not a "stabilization" change
**Effort**: High

### Approach 4: Hybrid — Fix tests + add module cache isolation helper

**Scope**: Fix the failing tests (Approach 1) + add a shared test utility that clears Bun's module cache for specific paths before importing.

**Actions**: Same as Approach 1, plus create a `tests/helpers/isolate-module.ts` that does `Bun.clearModuleCache()` or equivalent for component paths before each test group.

**Pros**: Fixes current failures + prevents future ones, moderate effort
**Cons**: Bun doesn't expose a public `clearModuleCache()` API — would need workarounds
**Effort**: Medium

## Recommendation

**Approach 1 (Surgical Stabilization)** with elements of Approach 4.

Rationale:
- The goal is **stabilization**, not redesign. Approach 1 delivers the highest value with lowest risk.
- The module caching issue is well-understood and can be worked around by restructuring test imports (ensuring all components are imported AFTER HOME is set, within the same `beforeAll`).
- Network-dependent tests should be skipped/mocked — they test dispatch logic, not git behavior.
- Config path pollution is easily fixed by using temp HOME consistently.

**Specific task breakdown**:
1. Skip/mock the 3 `upgrade-mode.test.ts` repo-mode tests (or mock `execSync` for git commands)
2. Restructure `doctor-scenarios.test.ts` to import ALL component modules in `beforeAll` after setting HOME, before any other test file can pollute the cache
3. Fix `config.test.ts` "Config command success reporting" to use temp HOME
4. Fix `tmux-component.test.ts` S7/S8 by ensuring config directory exists before install
5. Add a test run ordering note or `--test-order` to ensure doctor tests run first (or in isolation)

## Risks

- **Bun module cache behavior may vary by version** — the `?nonce` cache-busting works differently across Bun versions. What works today may break on upgrade.
- **Test execution order matters** — if `doctor-scenarios.test.ts` runs before other component tests, it may pass; if after, it fails. This makes the fix fragile.
- **Skipping repo-mode upgrade tests reduces coverage** — the dispatch logic for repo mode won't be tested. Should be re-added later with proper mocking.
- **Real config path tests** in `config.test.ts` may interfere with the user's actual cyberpunk config if run on a dev machine.

## Ready for Proposal

**Yes.** The exploration is sufficient to create a change proposal with a clear task breakdown. The scope is well-bounded: fix 19 failing tests across 4 files with minimal code changes, no redesign of test strategy or component architecture.
