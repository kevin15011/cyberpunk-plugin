// src/tui/types.ts — TUI type definitions for the navigation shell

import type { ComponentId, ComponentStatus, InstallResult } from "../components/types"

/** Valid screen identifiers in the navigation shell */
export type RouteId = "home" | "install" | "uninstall" | "status" | "task" | "results" | "result-detail"

/** A navigable route with optional params */
export interface AppRoute {
  id: RouteId
  params?: {
    action?: "install" | "uninstall"
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
    action: "install" | "uninstall"
    step?: ComponentId
    log: string[]
    done: boolean
  }
  lastResults?: InstallResult[]
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
