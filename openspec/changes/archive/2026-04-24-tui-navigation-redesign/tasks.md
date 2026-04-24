# Tasks: TUI Navigation Redesign

## Phase 1: Foundation

- [x] 1.1 Create `src/tui/types.ts` — `RouteId`, `AppRoute`, `TUIState`, `TaskHooks`, `ScreenResult` types from design §Interfaces.
- [x] 1.2 Create `src/tui/router.ts` — `pushRoute`, `popRoute`, `replaceRoute`, `currentRoute`, `canGoBack`; back/quit guard logic.
- [x] 1.3 Create `src/tui/terminal.ts` — `enableRawMode`, `disableRawMode`, `readKey` (normalize escape sequences), `clearScreen`, `writeLines`.
- [x] 1.4 Create `tests/tui-router.test.ts` — unit tests for push/pop/replace/back/quit on the history stack.

## Phase 2: Core Screens

- [x] 2.1 Create `src/tui/screens/home.ts` — render home menu (install, uninstall, status, quit); update handles arrow keys and Enter dispatching route push.
- [x] 2.2 Create `src/tui/screens/install.ts` — render component list with toggle selection, preset picker, confirmation; empty-selection guard per spec.
- [x] 2.3 Create `src/tui/screens/uninstall.ts` — render installed-component list with toggle selection, confirmation; empty-selection guard.
- [x] 2.4 Create `src/tui/screens/status.ts` — render `collectStatus()` results; back-to-home action.
- [x] 2.5 Create `src/tui/screens/task.ts` — render progress log, active component step, spinner; hooks emit `onComponentStart`/`onComponentFinish` events.
- [x] 2.6 Create `src/tui/screens/results.ts` — render `InstallResult[]` summary rows; Enter opens result-detail.
- [x] 2.7 Create `src/tui/screens/result-detail.ts` — render single component result message; back returns to results.

## Phase 3: Adapters & Wiring

- [x] 3.1 Create `src/tui/adapters.ts` — `startInstallTask`, `startUninstallTask` wrappers that call `runInstall`/`runUninstall` with `TaskHooks`; `collectStatus` wrapper.
- [x] 3.2 Modify `src/commands/install.ts` — add optional `TaskHooks` parameter to `runInstall`; call `onComponentStart`/`onComponentFinish` around each component loop iteration; preserve default behavior when hooks omitted.
- [x] 3.3 Create `src/tui/app.ts` — `createApp()` returning `{init, update, view}`; dispatches key → current screen → route change or intent; redraw loop via terminal helpers.
- [x] 3.4 Modify `src/tui/index.ts` — replace `@clack/prompts` import and `runTUI()` body with app bootstrap: raw mode, initial `collectStatus`, main loop calling app update/view, cleanup on exit.
- [x] 3.5 Remove `@clack/prompts` from `package.json` dependencies.

## Phase 4: Testing & Verification

- [x] 4.1 Create `tests/tui-screens.test.ts` — snapshot-style string assertions for home, install, uninstall, status, task, results, result-detail render output.
- [x] 4.2 Create `tests/tui-adapters.test.ts` — mock `runInstall`/`runUninstall`, verify hook-driven state transitions and `lastResults` persistence.
- [x] 4.3 Update `tests/tui-preset-behavior.test.ts` — replace clack mocks with router/app dispatch assertions for preset install flow.
- [x] 4.4 Verify existing `tests/parse-args.test.ts` still passes — confirms `--install`, `--status`, etc. never invoke TUI (regression guard).
- [ ] 4.5 Manual smoke test: `bun run src/index.ts` → verify home renders, install flow completes, results reviewable, quit exits cleanly.
