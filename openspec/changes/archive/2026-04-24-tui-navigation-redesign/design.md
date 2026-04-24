# Design: TUI Navigation Redesign

## Technical Approach

Replace the current `@clack/prompts` wizard with an internal Bubble Tea-style loop in `src/tui/`: one app model, a small router/history stack, pure screen renderers, and a single input dispatcher backed by raw terminal mode. Existing command/business logic remains the source of truth; the TUI becomes orchestration only, using adapter functions to translate command results into screen state. Non-interactive CLI parsing and output stay unchanged outside the `runTUI()` path.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| TUI framework | Ink/React; blessed; internal ANSI loop | Internal ANSI loop with typed model/update/view helpers | Matches the repo’s dependency-light Bun CLI, avoids React/bundling risk, and fits the proposal’s Bubble Tea-style shell. |
| Navigation model | Direct nested prompts; global mutable mode flag; stack router | `route + history + params` stack | Supports back/quit/results navigation without restarting flows and keeps screen transitions explicit/testable. |
| Task execution | Reimplement install/uninstall logic in TUI; only show final results; add optional command hooks | Reuse commands with optional task hooks/events | Preserves current business behavior while enabling progress/task views and result drill-down. |

## Data Flow

`src/index.ts`
  → `parseArgs()`
  → `runTUI()` only for interactive `tui`
  → app model bootstraps with `collectStatus()`
  → key input dispatches router/state actions
  → screen emits intent (`install`, `uninstall`, `status`, `open-result`)
  → TUI adapter calls existing command/preflight functions
  → task events update task view
  → final result stored in state, shell returns to results/detail/home

Sequence for install from the shell:

1. Home screen routes to install.
2. Install screen chooses preset or manual component set.
3. Confirmation screen shows `buildPresetPreflight()` details when applicable.
4. Task screen starts `runInstall(..., hooks)`.
5. Per-component hooks append progress lines and update active step.
6. Completion stores `InstallResult[]`, refreshes `collectStatus()`, and routes to results.
7. Results/detail screens allow review, back, or return home.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/tui/index.ts` | Modify | Replace clack loop with shell bootstrap and terminal lifecycle. |
| `src/tui/app.ts` | Create | App model/update loop, redraw scheduling, and shared shell layout. |
| `src/tui/router.ts` | Create | Route ids, route params, push/pop/replace helpers, and back rules. |
| `src/tui/screens/*.ts` | Create | Home, install, uninstall, status, task, results, and result-detail screen render/update helpers. |
| `src/tui/terminal.ts` | Create | Raw input handling, key normalization, screen clear/redraw helpers. |
| `src/tui/adapters.ts` | Create | Wrap `collectStatus`, `runInstall`, `runUninstall`, and preset preflight for TUI intents. |
| `src/commands/install.ts` | Modify | Add optional progress/task hooks without changing default CLI behavior. |
| `tests/tui-*.test.ts` | Modify/Create | Replace clack mocks with shell/router/task behavior tests. |

## Interfaces / Contracts

```ts
type RouteId = "home" | "install" | "uninstall" | "status" | "task" | "results" | "result-detail"

interface AppRoute {
  id: RouteId
  params?: { action?: "install" | "uninstall"; resultIndex?: number }
}

interface TUIState {
  statuses: ComponentStatus[]
  route: AppRoute
  history: AppRoute[]
  selectedComponents: ComponentId[]
  selectedPreset?: string
  task?: { action: "install" | "uninstall" | "status"; step?: ComponentId; log: string[]; done: boolean }
  lastResults?: InstallResult[]
}

interface TaskHooks {
  onComponentStart?(id: ComponentId): void
  onComponentFinish?(result: InstallResult): void
}
```

`runInstall()`/`runUninstall()` keep their current return values; hooks are optional and ignored by non-interactive callers.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Router push/pop, back/quit guards, screen selection state | Bun tests against pure `router.ts` and screen update helpers. |
| Unit | Task adapter event ordering and result persistence | Mock command modules and assert hook-driven state transitions. |
| Unit | Terminal rendering of shell/header/footer/result detail | Snapshot-style string assertions from pure render functions. |
| Integration | `runTUI()` boot, install/uninstall flow, return-to-home behavior | Stub stdin key events and mocked command adapters. |
| Regression | Flag-driven CLI bypass | Keep `parse-args`/CLI tests proving `--install`, `--status`, etc. never invoke TUI. |

## Migration / Rollout

No migration required. Rollout is a normal release: remove `@clack/prompts`, add new `src/tui/*` modules, keep `src/index.ts` command dispatch stable, and preserve existing text/JSON command contracts for scripted usage.

## Open Questions

- [ ] Whether the first slice should include a dedicated result-detail screen or fold details into the results list when terminal height is constrained.
