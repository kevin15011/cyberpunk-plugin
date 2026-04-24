// src/tui/app.ts — App model: init, update, view. Dispatches key → screen → route/intent

import type { KeyEvent, ScreenIntent, ScreenModule, TUIState } from "./types"
import { pushRoute, popRoute, replaceRoute, route, initialState } from "./router"
import { homeScreen } from "./screens/home"
import { installScreen } from "./screens/install"
import { uninstallScreen } from "./screens/uninstall"
import { statusScreen } from "./screens/status"
import { doctorScreen } from "./screens/doctor"
import { upgradeScreen } from "./screens/upgrade"
import { taskScreen } from "./screens/task"
import { resultsScreen } from "./screens/results"
import { resultDetailScreen } from "./screens/result-detail"
import type { ComponentStatus } from "../components/types"

/** Get the screen module for a given route */
export function getScreen(routeId: string): ScreenModule {
  switch (routeId) {
    case "home": return homeScreen
    case "install": return installScreen
    case "uninstall": return uninstallScreen
    case "status": return statusScreen
    case "doctor": return doctorScreen
    case "upgrade": return upgradeScreen
    case "task": return taskScreen
    case "results": return resultsScreen
    case "result-detail": return resultDetailScreen
    default: return homeScreen
  }
}

/** Create the initial TUI app state */
export function createApp(statuses: ComponentStatus[]): TUIState {
  return initialState(statuses)
}

/** Render the current screen as an array of lines */
export function view(state: TUIState): string[] {
  const screen = getScreen(state.route.id)
  return screen.render(state)
}

/** Process a key event through the current screen and return state + raw intent */
export function updateWithIntent(state: TUIState, key: KeyEvent): { state: TUIState; intent: ScreenIntent } {
  const screen = getScreen(state.route.id)
  const result = screen.update(state, key)

  // Apply the intent to produce the next state
  const next = applyIntent(result.state, result.intent)
  return { state: next, intent: result.intent }
}

/** Process a key event through the current screen and apply the intent */
export function update(state: TUIState, key: KeyEvent): TUIState {
  return updateWithIntent(state, key).state
}

/** Apply a screen intent to produce the final state */
function applyIntent(state: TUIState, intent: ScreenIntent): TUIState {
  switch (intent.type) {
    case "navigate":
      return pushRoute(state, intent.route)
    case "back":
      return popRoute(state)
    case "quit":
      return { ...state, quit: true }
    case "run-doctor":
      return pushRoute(state, route("doctor"))
    case "run-doctor-fix":
    case "run-upgrade":
      // These intents are handled by the task executor in index.ts,
      // not by the app router — return state unchanged
      return state
    case "select-component":
    case "select-preset":
    case "confirm":
    case "none":
    default:
      return state
  }
}
