# Tasks: TUI Doctor Upgrade Entrypoints

## Phase 1: Foundation (types + state)

- [x] 1.1 Extend `RouteId` in `src/tui/types.ts` to include `"doctor" | "upgrade"`.
- [x] 1.2 Add `TaskKind = "install" | "uninstall" | "doctor-fix" | "upgrade"` type to `src/tui/types.ts`.
- [x] 1.3 Replace `task.action: "install" | "uninstall"` with `task.kind: TaskKind` and `task.title: string` in `TUIState.task`; update `AppRoute.params.action` to `TaskKind`.
- [x] 1.4 Add `doctor?: { loading: boolean; report?: DoctorRunResult; confirmFix: boolean }` and `upgrade?: { loading: boolean; status?: UpgradeStatus }` state slices to `TUIState`.
- [x] 1.5 Add `resultView?: { kind: TaskKind; detailIndex?: number }` to `TUIState` for multi-kind result routing.
- [x] 1.6 Add `ScreenIntent` variants: `{ type: "run-doctor" }`, `{ type: "run-doctor-fix" }`, `{ type: "run-upgrade" }`.

## Phase 2: Core Screens (create)

- [x] 2.1 Create `src/tui/screens/doctor.ts`: on enter, load doctor summary via adapter; render grouped checks; show "Fix issues" CTA when fixable failures exist; implement two-step confirm (Enter → confirm state → Enter again fires `run-doctor-fix` intent).
- [x] 2.2 Create `src/tui/screens/upgrade.ts`: on enter, load upgrade status via adapter; render version info; show "Apply upgrade" CTA when update available; Enter fires `run-upgrade` intent.

## Phase 3: Wiring (router + app + home + adapters + index)

- [x] 3.1 Update `src/tui/router.ts`: reset `doctor`/`upgrade` state slices in `pushRoute` when navigating away from those screens.
- [x] 3.2 Update `src/tui/app.ts`: add `doctorScreen`/`upgradeScreen` imports and cases in `getScreen`; handle new `ScreenIntent` variants (`run-doctor`, `run-doctor-fix`, `run-upgrade`) in `applyIntent`.
- [x] 3.3 Update `src/tui/screens/home.ts`: add "Doctor" and "Upgrade" entries to `MENU_ITEMS` before "Salir".
- [x] 3.4 Update `src/tui/adapters.ts`: add `loadDoctorSummary()` (calls `runDoctor({ fix: false })`), `startDoctorFixTask()` (calls `runDoctor({ fix: true })`), `loadUpgradeStatus()` (calls `checkUpgrade()`), `startUpgradeTask()` (calls `runUpgrade()`).
- [x] 3.5 Update `src/tui/index.ts`: extend `needsTaskExecution` to detect doctor-fix and upgrade task triggers; extend `executeTask` to dispatch by `TaskKind`, calling the new adapters and setting `resultView.kind`.

## Phase 4: Task/Results Generalization

- [x] 4.1 Update `src/tui/screens/task.ts`: render title from `task.title` instead of hardcoded INSTALANDO/DESINSTALANDO; map `TaskKind` to display labels (DOCTOR FIX, UPGRADE, INSTALANDO, DESINSTALANDO).
- [x] 4.2 Update `src/tui/screens/results.ts`: render results header and rows based on `resultView.kind`; show doctor-fix and upgrade result summaries alongside install/uninstall.
- [x] 4.3 Update `src/tui/screens/result-detail.ts`: render detail for doctor checks/fixes and upgrade outcomes using `resultView.kind` instead of assuming `InstallResult` only.

## Phase 5: Unit Tests

- [x] 5.1 Test doctor screen: no auto-fix on first Enter, confirmation gating, back clears confirm state.
- [x] 5.2 Test upgrade screen: renders up-to-date vs update-available states, fires correct intent.
- [x] 5.3 Test task screen: renders correct labels per TaskKind (install, uninstall, doctor-fix, upgrade).
- [x] 5.4 Test adapters: stub `runDoctor`, `checkUpgrade`, `runUpgrade` and verify returned payloads.
- [x] 5.5 Test results + result-detail screens: verify rendering for doctor-fix and upgrade kinds.
