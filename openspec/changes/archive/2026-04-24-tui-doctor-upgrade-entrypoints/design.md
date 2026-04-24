# Design: TUI Doctor Upgrade Entrypoints

## Technical Approach

Add `doctor` and `upgrade` as first-class TUI routes, but keep command execution in the existing `src/commands/*` modules. The TUI will gain two new summary screens: Doctor loads and renders a grouped `DoctorRunResult` in read-only mode, while Upgrade loads and renders `checkUpgrade()` status. From those summaries, explicit actions enter the existing task/result pipeline only for mutating work: `runDoctor({ fix: true })` and `runUpgrade()`.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Route shape | Inline modal state; dedicated routes | Dedicated `doctor` and `upgrade` routes | Matches current router/screen split and keeps home navigation simple. |
| Task pipeline scope | Separate doctor/upgrade progress UIs; generalize shared task shell | Generalize `task`/`results` for multiple task kinds | Reuses current progress/results screens with the smallest structural change. |
| Doctor fix safety | Immediate fix on Enter; extra confirmation | Two-step confirm inside Doctor screen | Doctor can modify user files; explicit confirmation matches proposal risk mitigation. |
| State expansion | Add many screen-local booleans; add small typed slices | Add minimal `doctor`, `upgrade`, and generic task/result metadata | Keeps current app model intact while avoiding route-param overload. |

## Data Flow

### Doctor

`home -> doctor screen -> runDoctor({ fix:false }) -> render grouped checks`

If fixable failures exist:

`Enter on "Fix issues" -> confirm state -> Enter again -> task screen -> runDoctor({ fix:true }) -> results screen -> optional detail -> home`

### Upgrade

`home -> upgrade screen -> checkUpgrade() -> render version/status`

If update exists:

`Enter on "Apply upgrade" -> task screen -> runUpgrade() -> results screen -> home`

The task executor remains in `src/tui/index.ts`, but it will dispatch by a new generic task kind instead of assuming install/uninstall only.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/tui/types.ts` | Modify | Add `doctor`/`upgrade` routes, generic task kind, and small state slices for doctor + upgrade payloads. |
| `src/tui/router.ts` | Modify | Preserve/reset new state slices on push/pop where needed. |
| `src/tui/app.ts` | Modify | Route `doctor` and `upgrade` screens. |
| `src/tui/screens/home.ts` | Modify | Add Doctor and Upgrade menu entries. |
| `src/tui/screens/doctor.ts` | Create | Render doctor summary, fix CTA, and confirmation step. |
| `src/tui/screens/upgrade.ts` | Create | Render upgrade status/check summary and upgrade CTA. |
| `src/tui/screens/task.ts` | Modify | Show task labels/logs for `doctor-fix` and `upgrade`. |
| `src/tui/screens/results.ts` | Modify | Render install/uninstall, doctor, or upgrade result summaries. |
| `src/tui/screens/result-detail.ts` | Modify | Render detail text for doctor checks/fixes and upgrade outcomes, not only component installs. |
| `src/tui/adapters.ts` | Modify | Add `loadDoctorSummary`, `startDoctorFixTask`, `loadUpgradeStatus`, and `startUpgradeTask`. |
| `src/tui/index.ts` | Modify | Extend lazy-loading and task execution to doctor/upgrade entrypoints. |

## Interfaces / Contracts

```ts
type RouteId =
  | "home" | "install" | "uninstall" | "status"
  | "doctor" | "upgrade" | "task" | "results" | "result-detail"

type TaskKind = "install" | "uninstall" | "doctor-fix" | "upgrade"

interface TUIState {
  doctor?: { loading: boolean; report?: DoctorRunResult; confirmFix: boolean }
  upgrade?: { loading: boolean; status?: UpgradeStatus }
  task?: { kind: TaskKind; title: string; step?: string; log: string[]; done: boolean }
  resultView?: { kind: TaskKind; detailIndex?: number }
}
```

`doctor.report` stores the read-only summary shown on the Doctor screen and becomes the source for doctor results/detail after a fix run. `upgrade.status` stores `checkUpgrade()` output before mutation. Existing install/uninstall selection state stays unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Doctor screen intents and confirmation gating | `bun:test` screen-state tests: no auto-fix, confirm required, back clears confirm state. |
| Unit | Upgrade screen intents | Mock `UpgradeStatus` for up-to-date vs update-available rendering/actions. |
| Unit | Generic task/result rendering | Assert task labels and results/detail output for install, doctor-fix, and upgrade kinds. |
| Unit | TUI adapters | Stub `runDoctor`, `checkUpgrade`, `runUpgrade` and verify returned state payloads. |
| Manual | Shell navigation | Run `cyberpunk`, open Doctor/Upgrade, execute fix/upgrade flows, return to home without leaving TUI. |

## Migration / Rollout

No migration required. This is a TUI-only entrypoint expansion; direct `cyberpunk doctor` and `cyberpunk upgrade` dispatch in `src/index.ts` stays unchanged.

## Open Questions

- [ ] Should the Upgrade screen require a second explicit confirm step, or is the check screen plus action button sufficient for MVP?
