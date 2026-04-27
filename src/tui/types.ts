// src/tui/types.ts — TUI type definitions for the navigation shell

import type { ComponentId, ComponentStatus, DoctorRunResult, InstallResult } from "../components/types"
import type { UpgradeStatus } from "../commands/upgrade"
import type { MetricsScreenState } from "../components/metrics-viewer"

/** Valid screen identifiers in the navigation shell */
export type RouteId = "home" | "install" | "uninstall" | "status" | "doctor" | "upgrade" | "task" | "results" | "result-detail" | "metrics-viewer"

/** Generic task kind for the shared task/results pipeline */
export type TaskKind = "install" | "uninstall" | "doctor-fix" | "upgrade"

/** A navigable route with optional params */
export interface AppRoute {
  id: RouteId
  params?: {
    action?: TaskKind
    resultIndex?: number
  }
}

/** Key events normalized from raw terminal input */
export type KeyEvent =
  | { type: "up" }
  | { type: "down" }
  | { type: "enter" }
  | { type: "back" }
  | { type: "space" }
  | { type: "tab" }
  | { type: "char"; ch: string }
  | { type: "ctrl-c" }
  | { type: "unknown" }

/** Internal phase tracking for multi-phase screens */
export type InstallPhase = "preset" | "manual" | "confirm"

/** Current state of the TUI shell */
export interface TUIState {
  statuses: ComponentStatus[]
  route: AppRoute
  history: AppRoute[]
  selectedComponents: ComponentId[]
  selectedPreset?: string
  cursor: number
  task?: {
    kind: TaskKind
    title: string
    step?: string
    log: string[]
    done: boolean
  }
  lastResults?: InstallResult[]
  /** Doctor screen state: loading indicator, cached report, fix confirmation gate */
  doctor?: { loading: boolean; report?: DoctorRunResult; confirmFix: boolean }
  /** Upgrade screen state: loading indicator, cached check status */
  upgrade?: { loading: boolean; status?: UpgradeStatus }
  /** Metrics viewer screen state: auto-refresh, data, pause controls */
  metrics?: MetricsScreenState
  /** Result view metadata: which task kind produced the results */
  resultView?: { kind: TaskKind; detailIndex?: number }
  quit: boolean
  message?: string
  /** Tracks which sub-phase the install screen is in */
  _installPhase?: InstallPhase
}

/** Optional hooks for task progress events */
export interface TaskHooks {
  onComponentStart?(id: ComponentId): void
  onComponentFinish?(result: InstallResult): void
}

/** Intent emitted by screens to the app dispatcher */
export type ScreenIntent =
  | { type: "navigate"; route: AppRoute }
  | { type: "back" }
  | { type: "quit" }
  | { type: "select-component"; id: ComponentId }
  | { type: "select-preset"; preset: string }
  | { type: "confirm" }
  | { type: "run-doctor" }
  | { type: "run-doctor-fix" }
  | { type: "run-upgrade" }
  | { type: "refresh-metrics" }
  | { type: "none" }

/** Result of a screen's update function */
export interface ScreenResult {
  state: TUIState
  intent: ScreenIntent
}

/** A screen module: render produces display lines, update handles key input */
export interface ScreenModule {
  render(state: TUIState): string[]
  update(state: TUIState, key: KeyEvent): ScreenResult
}
