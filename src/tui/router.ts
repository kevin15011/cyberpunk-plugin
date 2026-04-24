// src/tui/router.ts — Route history stack with push/pop/replace and back/quit guards

import type { AppRoute, RouteId, TUIState } from "./types"

/** Create a new AppRoute */
export function route(id: RouteId, params?: AppRoute["params"]): AppRoute {
  return { id, params }
}

/** Push a new route onto the history stack */
export function pushRoute(state: TUIState, next: AppRoute): TUIState {
  return {
    ...state,
    history: [...state.history, state.route],
    route: next,
    cursor: 0,
    message: undefined,
    // Reset install phase when navigating away from install screen
    ...(next.id !== "install" ? { _installPhase: undefined } : {}),
    // Reset doctor state when navigating away from doctor screen
    ...(next.id !== "doctor" ? { doctor: undefined } : {}),
    // Reset upgrade state when navigating away from upgrade screen
    ...(next.id !== "upgrade" ? { upgrade: undefined } : {}),
  }
}

/** Pop back to the previous route, if history exists */
export function popRoute(state: TUIState): TUIState {
  if (state.history.length === 0) {
    return { ...state, quit: true }
  }
  const previous = state.history[state.history.length - 1]
  return {
    ...state,
    history: state.history.slice(0, -1),
    route: previous,
    cursor: 0,
    message: undefined,
  }
}

/** Replace the current route without pushing history */
export function replaceRoute(state: TUIState, next: AppRoute): TUIState {
  return {
    ...state,
    route: next,
    cursor: 0,
    message: undefined,
  }
}

/** Get the current route */
export function currentRoute(state: TUIState): AppRoute {
  return state.route
}

/** Whether there are previous routes to go back to */
export function canGoBack(state: TUIState): boolean {
  return state.history.length > 0
}

/** Handle back/quit: if canGoBack, pop; otherwise set quit */
export function handleBackOrQuit(state: TUIState): TUIState {
  if (canGoBack(state)) {
    return popRoute(state)
  }
  return { ...state, quit: true }
}

/** Create initial TUIState for app boot */
export function initialState(statuses: import("../components/types").ComponentStatus[]): TUIState {
  return {
    statuses,
    route: route("home"),
    history: [],
    selectedComponents: [],
    cursor: 0,
    quit: false,
  }
}
