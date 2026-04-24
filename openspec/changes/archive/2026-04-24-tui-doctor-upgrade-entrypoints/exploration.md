# Exploration: tui-doctor-upgrade-entrypoints

## Current State

The cyberpunk CLI has a navigable TUI shell (`src/tui/`) with a route-based screen architecture. The home menu (`src/tui/screens/home.ts`) currently exposes **3 actions**: Install, Uninstall, and Status. The `doctor` and `upgrade` commands exist as fully-functional CLI commands (`src/commands/doctor.ts`, `src/commands/upgrade.ts`) with rich business logic, but **neither is exposed in the TUI home menu**.

The TUI follows a clean Elm-like architecture:
- **Router** (`router.ts`): Push/pop/replace history stack with `RouteId` type union
- **App dispatcher** (`app.ts`): `getScreen()` switch maps route IDs to screen modules; `update()` processes key events through screens and applies intents
- **Screen modules** (`screens/*.ts`): Each implements `{ render(state): string[], update(state, key): ScreenResult }`
- **Types** (`types.ts`): `RouteId`, `TUIState`, `ScreenIntent`, `ScreenModule`
- **Adapters** (`adapters.ts`): Thin wrappers connecting TUI to command functions with `TaskHooks`
- **Main loop** (`index.ts`): Raw mode bootstrap, key dispatch, task execution for install/uninstall

The `doctor` command (`runDoctor()`) returns a `DoctorRunResult` with checks grouped by component, optional `--fix` repairs, and a summary. The `upgrade` command has two paths (`checkUpgrade()` and `runUpgrade()`) dispatching by `installMode` (repo vs binary), returning `UpgradeStatus` or `UpgradeResult`.

Both commands are already wired in `src/index.ts` for non-interactive CLI usage and have full formatting functions in `src/cli/output.ts`.

## Affected Areas

- `src/tui/types.ts` — Must add `"doctor"` and `"upgrade"` to `RouteId` union; may need new state fields for doctor/upgrade results
- `src/tui/app.ts` — Must add cases in `getScreen()` switch for new routes
- `src/tui/screens/home.ts` — Must add "Doctor" and "Upgrade" menu items to `MENU_ITEMS`
- `src/tui/screens/` — New screen files needed: `doctor.ts`, `upgrade.ts` (and optionally `doctor-detail.ts`)
- `src/tui/adapters.ts` — New adapter functions: `runDoctorTask()`, `checkUpgradeTask()`, `runUpgradeTask()`
- `src/tui/index.ts` — May need task execution handling for upgrade (doctor is read-only or fix-only, no long-running task)
- `openspec/specs/cyberpunk-tui/spec.md` — Needs new requirements for doctor/upgrade TUI routes

## Approaches

### Approach 1: Simple read-only screens (MVP)

Add two new screens that call the existing commands and display formatted output. Doctor shows check results with optional fix toggle; upgrade shows version check with optional upgrade trigger.

- **Pros**: Minimal code changes, reuses existing command logic and output formatters, fast to implement
- **Cons**: Doctor output is dense (tabular text), may not fit terminal well; upgrade is a single-action screen
- **Effort**: Low

### Approach 2: Structured interactive screens

Build rich screens with cursor navigation: doctor shows checks as navigable list with per-check detail, space to toggle fixable items, Enter to run fix. Upgrade shows version comparison with Enter to trigger upgrade, progress screen for download.

- **Pros**: Consistent with existing TUI patterns (install/uninstall), richer UX, cursor navigation for details
- **Cons**: More code, needs new state fields (`doctorResult`, `upgradeResult`), needs new intent types
- **Effort**: Medium

### Approach 3: Hybrid — simple screens + shared task chrome

Doctor: simple read-only screen with summary + option to run `--fix` (triggers existing task screen). Upgrade: simple check screen with option to upgrade (triggers existing task screen for binary download progress).

- **Pros**: Reuses existing task/results screens, minimal new screen code, consistent UX
- **Cons**: Task screen is currently typed for install/uninstall actions; needs generalization
- **Effort**: Medium

## Recommendation

**Approach 2 (Structured interactive screens)** with elements of Approach 3. Rationale:

1. **Doctor screen**: Display checks grouped by component (matching CLI output structure), cursor navigation, Enter to expand check detail, `f` key to run fix on fixable checks. Reuses `runDoctor()` fully. Shows summary bar at bottom (OK/warnings/failures/fixed).

2. **Upgrade screen**: Show current vs latest version, up-to-date status, changed files list. Enter to trigger upgrade. Reuses existing task screen for progress (generalize task action type to include "upgrade").

3. **Minimum viable slice**:
   - Add `"doctor"` and `"upgrade"` to `RouteId`
   - Add menu items to home screen
   - Create `doctor.ts` screen: render doctor results, navigate checks, optional fix trigger
   - Create `upgrade.ts` screen: show version info, trigger upgrade
   - Add adapter functions in `adapters.ts`
   - Generalize task screen action type to support "upgrade"
   - Preserve all non-interactive CLI behavior (no changes to `src/index.ts` or `parse-args.ts`)

4. **Defer**:
   - Per-check detail screen for doctor (can show inline in v1)
   - Upgrade progress as a dedicated screen (can reuse task screen)
   - Doctor component filtering (TUI shows all components)

## Risks

- **Task screen coupling**: The task screen and `executeTask()` in `index.ts` are currently typed for install/uninstall only. Adding upgrade requires generalizing the `task.action` type and the `needsTaskExecution()` check.
- **Doctor output density**: Doctor can produce many checks across 6+ components. A flat list may overflow the terminal. Need pagination or scrolling.
- **State bloat**: Adding `doctorResult` and `upgradeResult` to `TUIState` increases state complexity. Consider using route params or screen-local state instead.
- **Fix confirmation**: Doctor `--fix` modifies system files. The TUI should confirm before running fixes, similar to install confirmation phase.
- **Binary upgrade network dependency**: Upgrade may hang on network calls. The TUI should show a loading indicator and handle timeouts gracefully.

## Ready for Proposal

**Yes** — sufficient understanding of the TUI architecture, existing command logic, and screen patterns to write a precise spec, design, and task breakdown. The change is well-scoped: 2 new screens, 2 new route IDs, home menu expansion, adapter additions, and minor task generalization.
