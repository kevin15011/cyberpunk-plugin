# Exploration: TUI Navigation Redesign

## Current State

The current TUI (`src/tui/index.ts`) is built on `@clack/prompts` and follows a **prompt-sequential** pattern:

1. `console.clear()` + banner render
2. `clack.intro()` header
3. `clack.select()` main menu loop (install/uninstall/status/quit)
4. Each action triggers nested `clack.select()`, `clack.multiselect()`, `clack.confirm()`, `clack.spinner()`, `clack.note()` calls
5. Output accumulates in scrollback — each `console.log()` call adds lines that persist after the prompt completes
6. No screen redraw, no navigation history, no persistent layout

**Key limitation**: `@clack/prompts` is designed for wizard-style flows (one prompt at a time, output scrolls away). It cannot:
- Maintain a persistent layout (header, sidebar, content area)
- Navigate between "screens" without re-rendering everything
- Show a dashboard with live status at a glance
- Support keyboard shortcuts for navigation (e.g., `g` for dashboard, `d` for doctor)
- Display rich content (tables, formatted doctor results) within a fixed viewport

## Affected Areas

- `src/tui/index.ts` — **complete rewrite**. Current file is 236 lines of clack-based prompt chaining. Will be replaced by a screen-based architecture.
- `src/tui/theme.ts` — **reuse as-is**. ANSI color constants work with any terminal library.
- `src/cli/output.ts` — **partial reuse**. Formatter functions (`formatStatus`, `formatInstallResults`, `formatDoctorText`, etc.) produce strings that can be rendered inside screen content areas. The `console.log()` calls must be replaced with screen rendering.
- `src/cli/parse-args.ts` — **reuse as-is**. Non-interactive CLI dispatch is unaffected.
- `src/commands/*` — **reuse as-is**. All business logic (`runInstall`, `runUninstall`, `collectStatus`, `runDoctor`, `runConfigCommand`, `checkUpgrade`, `runUpgrade`, `buildPresetPreflight`) is pure function calls with no TUI coupling.
- `src/components/*` — **reuse as-is**. Component modules are independent of the TUI.
- `src/presets/*` — **reuse as-is**. Preset resolution and definitions are TUI-agnostic.
- `src/config/*` — **reuse as-is**. Config load/save is independent.
- `src/index.ts` — **minor update**. The `case "tui"` dispatch stays, but calls a new `runTUI()` entry point.
- `tests/tui-preset-behavior.test.ts` — **rewrite**. Tests mock `@clack/prompts`; new tests will need to mock the new TUI framework.
- `package.json` — **update**. Replace `@clack/prompts` with chosen library (+ React if using Ink).
- `build.ts` — **potential update**. If React is added, bundling may need adjustments for `react-reconciler`.

## Approaches

### 1. Ink (React for CLI)

**Description**: React-based terminal rendering engine. Uses Yoga layout (Flexbox for terminals), supports components, state management via React hooks.

| Aspect | Detail |
|--------|--------|
| Model | React components → terminal output via `react-reconciler` |
| Navigation | React Router or manual state-driven screen switching |
| Layout | Flexbox via Yoga — natural sidebar/content/dashboard layouts |
| Binary compatibility | Ink 7 requires React 19+ as peer dep; `bun build --compile` handles React fine |
| Bundle impact | ~25+ deps including `react`, `react-reconciler`, `yoga-layout`, `scheduler` |
| Learning curve | React knowledge required; team already uses React patterns elsewhere |
| Ecosystem | `ink-select-input`, `ink-table`, `ink-spinner`, `ink-big-text` available |
| Maintenance | Active (v7 released 2025), backed by Vadim Demedes |

**Pros**:
- Component model maps naturally to screens (Dashboard, Presets, Doctor, etc.)
- React state management handles navigation history cleanly
- Flexbox layout makes dashboard/sidebar trivial
- Hot-reload via `ink-dev` during development
- Strong ecosystem of pre-built terminal components

**Cons**:
- Requires adding React as a dependency (new paradigm for this repo)
- Larger binary size (~5-10MB increase from React + reconciler + yoga)
- `bun build --compile` with React needs testing (React's dynamic imports may cause issues)
- Overkill for a 9-screen CLI app

**Effort**: Medium-High

### 2. Blessed + Blessed-Contrib

**Description**: Mature terminal UI library with widget system (boxes, lists, tables, trees, charts). Pure JS, no React needed.

| Aspect | Detail |
|--------|--------|
| Model | Imperative widget tree (`screen.append(box)`, `box.push(list)`) |
| Navigation | Manual screen switching (`screen.remove()`, `screen.append()`) |
| Layout | Absolute positioning + percentage sizing |
| Binary compatibility | Pure JS, no peer deps, compiles cleanly with Bun |
| Bundle impact | ~14 deps for blessed-contrib, much lighter than Ink+React |
| Learning curve | Moderate — imperative API, but well-documented |
| Ecosystem | Blessed-contrib adds dashboards, charts, logs, tables |
| Maintenance | Blessed: stale (v0.1.81, 2019). Blessed-contrib: moderate activity |

**Pros**:
- No React dependency — stays closer to current repo patterns
- Rich widget set out of the box (lists, tables, trees, markdown rendering)
- Smaller binary footprint
- Proven in production (npm-cli, termui-style apps)
- Blessed-contrib has dashboard widgets that match the desired screen layout

**Cons**:
- Imperative API is harder to test and reason about than React
- Blessed core is unmaintained since 2019 (though stable)
- No component reusability pattern — more boilerplate per screen
- Layout system is less flexible than Flexbox

**Effort**: Medium

### 3. Custom ANSI + State Machine (minimal deps)

**Description**: Build a lightweight screen router using raw ANSI escape sequences + a simple state machine. Keep `src/tui/theme.ts` colors, add cursor positioning, screen clearing, and a `render(screenName, state)` function.

| Aspect | Detail |
|--------|--------|
| Model | State machine: `{ currentScreen, history, screenState }` → `render()` |
| Navigation | `navigateTo(screen)`, `goBack()`, `render()` clears and redraws |
| Layout | Manual cursor positioning (`\x1b[row;colH`) + line-by-line rendering |
| Binary compatibility | Zero new deps — only uses existing theme constants |
| Bundle impact | None |
| Learning curve | Low — just ANSI escape codes and a switch statement |
| Ecosystem | None — build everything from scratch |
| Maintenance | You own it all |

**Pros**:
- Zero new dependencies — smallest binary
- Full control over rendering and performance
- No framework overhead or learning curve
- Matches the "keep it simple" ethos of the current codebase
- Easy to test (pure render functions)

**Cons**:
- Must build all widgets from scratch (lists, tables, scrollable content)
- Manual cursor math is error-prone (terminal resize handling, line wrapping)
- No hot-reload or dev tools
- Scaling to many screens becomes boilerplate-heavy
- No built-in keyboard input handling beyond raw `process.stdin`

**Effort**: Medium (but high ongoing maintenance)

### 4. Ink (React) — Recommended

After weighing all options, **Ink with React** is the recommended choice for the following reasons:

1. **Screen architecture maps to React components**: Each screen (Dashboard, Presets, Doctor, etc.) is a natural React component. Props carry state, hooks handle local UI state.
2. **Navigation is trivial**: A single `App` component with `useState` for `currentScreen` renders the appropriate child. Back navigation is a simple history stack.
3. **Layout is declarative**: The sidebar + content layout is a 2-line Flexbox component.
4. **Reusable widgets**: Lists, tables, spinners, and confirmations already exist as Ink packages.
5. **Testability**: React components are trivially testable with `ink-testing-library`.
6. **Future-proof**: If the TUI grows (e.g., interactive component config, real-time status), React scales naturally.

The binary size concern is mitigated by:
- Bun's tree-shaking during `bun build`
- The current binary is already ~15-30MB; a 5-10MB increase is acceptable for a UX overhaul
- React 19 is smaller than previous versions

## Recommended Architecture

```
src/tui/
├── app.tsx              # Root Ink app: state store + router + layout shell
├── router.ts            # Screen registry + navigation (push/pop)
├── store.ts             # App state (statuses, config, selected preset, etc.)
├── screens/
│   ├── dashboard.tsx    # Overview: component status grid, quick actions
│   ├── presets.tsx      # List of presets with descriptions
│   ├── preset-detail.tsx # Selected preset: preflight + confirm + install
│   ├── components.tsx   # Component list with toggle/install
│   ├── component-detail.tsx # Single component: status, actions, info
│   ├── doctor.tsx       # Doctor check list with fix buttons
│   ├── doctor-result.tsx # Post-fix results display
│   ├── tmux.tsx         # Tmux config viewer/editor
│   ├── release.tsx      # Upgrade check + execute
│   └── task-view.tsx    # Long-running task output (spinner + log)
├── widgets/
│   ├── sidebar.tsx      # Navigation sidebar with keyboard shortcuts
│   ├── header.tsx       # Banner + current screen title
│   ├── status-bar.tsx   # Footer with help hints
│   ├── component-list.tsx  # Reusable list with checkboxes
│   ├── table.tsx        # Reusable table (for doctor results)
│   └── confirm-dialog.tsx # Confirmation modal
└── theme.ts             # Reuse existing ANSI colors (wrap for Ink text components)
```

### State Store

A simple observable store (no Redux needed):

```typescript
interface AppState {
  statuses: ComponentStatus[]
  config: CyberpunkConfig
  currentScreen: ScreenId
  screenHistory: ScreenId[]
  selectedPreset: PresetId | null
  selectedComponent: ComponentId | null
  activeTask: { type: string; running: boolean; result: unknown } | null
}
```

Screens read from the store and dispatch actions (`install()`, `navigate()`, `refresh()`). The store triggers re-renders via Ink's `useApp` + `rerender()`.

### Router

Simple push/pop navigation:

```typescript
function navigateTo(screen: ScreenId) { ... }
function goBack() { ... }
function getScreenComponent(screen: ScreenId) { ... }
```

### Non-Interactive CLI Preservation

The `src/index.ts` dispatch for non-TUI commands (`install`, `status`, `doctor`, etc.) remains **completely unchanged**. Only the `case "tui"` branch is replaced. The `@clack/prompts` dependency is removed entirely.

## Minimum Viable First Slice

**Include in Slice 1:**
1. Infrastructure: Ink setup, React dependency, build pipeline update
2. Shell: App root, router, sidebar, header, status-bar
3. Dashboard screen: Component status grid + quick action navigation
4. Components screen: List with install/uninstall toggle
5. Presets screen: List + detail with preflight + confirm + install
6. Task view: Spinner + result display for long-running operations
7. Basic keyboard navigation (arrows, enter, escape, number shortcuts)

**Defer to later slices:**
- Doctor screen (complex — many checks, fix flow, results display)
- Component detail screen (nice-to-have, not essential)
- Tmux screen (view-only, low priority)
- Release/upgrade screen (can use non-interactive CLI for now)
- Doctor result screen
- Advanced keyboard shortcuts (vim-style, search/filter)
- Terminal resize handling (Ink handles this, but edge cases need testing)

## Risks

1. **React + Bun compile compatibility**: Ink 7 requires React 19. Bun's `--compile` flag must handle React's module system. This needs a spike/POC before committing.
2. **Binary size increase**: Adding React + Ink + ~30 deps could increase binary by 5-10MB. Acceptable but worth measuring.
3. **Existing tests break**: `tests/tui-preset-behavior.test.ts` mocks `@clack/prompts` directly. All TUI tests need rewriting for the new framework.
4. **Terminal compatibility**: Ink uses Yoga layout which may behave differently on small terminals (< 80 cols) or non-UTF8 locales.
5. **Scope creep**: The screen list (9 screens) is ambitious. Without strict slicing, the change could balloon.
6. **User muscle memory**: Current TUI users know the clack flow. New navigation model needs clear onboarding (help screen, visible shortcuts).

## Ready for Proposal

**Yes.** The exploration is sufficient to move to `sdd-propose`. The key decisions are:

- **Library**: Ink (React for CLI) — best fit for screen-based architecture
- **Reuse**: All business logic (`commands/`, `components/`, `presets/`, `config/`) stays as-is
- **Scope**: 6 screens + infrastructure in slice 1, 3 screens deferred
- **Risk mitigation**: POC spike for Bun + React compile compatibility before full implementation

The orchestrator should tell the user: *"Exploration complete. Recommend Ink (React) for the new TUI with a 6-screen first slice. All existing business logic is reusable. Main risk is Bun compile compatibility with React — needs a quick POC. Ready to create a proposal."*
