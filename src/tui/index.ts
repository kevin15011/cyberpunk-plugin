// src/tui/index.ts — Interactive TUI shell: raw mode bootstrap, main loop, cleanup

import { createApp, update, view } from "./app"
import { enableRawMode, disableRawMode, clearScreen, writeLines, hideCursor, showCursor, readKey } from "./terminal"
import { collectFreshStatus, startInstallTask, startUninstallTask, startPresetInstall } from "./adapters"
import { route, pushRoute } from "./router"
import { pink, bold } from "./theme"
import type { TUIState } from "./types"
import type { ComponentId, InstallResult } from "../components/types"

export async function runTUI(): Promise<void> {
  // Bootstrap: gather initial status
  const statuses = await collectFreshStatus()
  let state = createApp(statuses)

  // Setup terminal
  enableRawMode()
  hideCursor()

  // Cleanup handler
  const cleanup = () => {
    showCursor()
    disableRawMode()
    clearScreen()
    console.log(bold(pink("Hasta la próxima, choomer")))
    process.exit(0)
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  // Main loop
  const stdin = process.stdin

  try {
    // Initial render
    clearScreen()
    writeLines(view(state))

    await new Promise<void>((resolve) => {
      stdin.on("data", async (data: Buffer) => {
        const key = readKey(data)

        // Handle the key through the app
        state = update(state, key)

        // Check if a screen emitted a confirm/selection that needs task execution
        if (needsTaskExecution(state, key)) {
          state = await executeTask(state)
        }

        // Handle quit
        if (state.quit) {
          cleanup()
          resolve()
          return
        }

        // Re-render
        clearScreen()
        writeLines(view(state))
      })
    })
  } finally {
    showCursor()
    disableRawMode()
  }
}

/** Check if the current state + key combination requires a task to be started */
function needsTaskExecution(state: TUIState, key: import("./types").KeyEvent): boolean {
  if (key.type !== "enter") return false

  // Install screen: only trigger task when in confirm phase with selection
  if (state.route.id === "install") {
    if (state._installPhase !== "confirm") return false
    return state.selectedComponents.length > 0 || !!state.selectedPreset
  }

  // Uninstall screen confirmation
  if (state.route.id === "uninstall") {
    return state.selectedComponents.length > 0
  }

  return false
}

/** Execute a task and update state accordingly */
async function executeTask(state: TUIState): Promise<TUIState> {
  const isInstall = state.route.id === "install"
  const action = isInstall ? "install" as const : "uninstall" as const
  let results: InstallResult[]

  // Push to task screen
  state = pushRoute(state, route("task", { action }))
  state = {
    ...state,
    task: { action, step: undefined, log: [], done: false },
  }

  // Render task screen while working
  clearScreen()
  writeLines(view(state))

  const hooks = {
    onComponentStart: (id: ComponentId) => {
      state = {
        ...state,
        task: {
          ...state.task!,
          step: id,
          log: [...state.task!.log, `→ Iniciando ${id}...`],
        },
      }
      clearScreen()
      writeLines(view(state))
    },
    onComponentFinish: (result: InstallResult) => {
      const icon = result.status === "success" ? "✓" : result.status === "error" ? "✗" : "○"
      state = {
        ...state,
        task: {
          ...state.task!,
          log: [...state.task!.log, `  ${icon} ${result.component}: ${result.status}`],
        },
      }
      clearScreen()
      writeLines(view(state))
    },
  }

  try {
    if (isInstall && state.selectedPreset) {
      results = await startPresetInstall(state.selectedPreset, hooks)
    } else if (isInstall) {
      results = await startInstallTask(state.selectedComponents as ComponentId[], hooks)
    } else {
      results = await startUninstallTask(state.selectedComponents as ComponentId[], hooks)
    }
  } catch (err) {
    results = [{
      component: "plugin" as ComponentId,
      action,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    }]
  }

  // Mark task as done, store results
  state = {
    ...state,
    task: { ...state.task!, done: true, step: undefined },
    lastResults: results,
    selectedComponents: [],
    selectedPreset: undefined,
    _installPhase: undefined,
  }

  // Refresh statuses
  try {
    const freshStatuses = await collectFreshStatus()
    state = { ...state, statuses: freshStatuses }
  } catch {
    // Keep existing statuses if refresh fails
  }

  // Push to results screen
  state = pushRoute(state, route("results"))

  return state
}
