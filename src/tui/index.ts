// src/tui/index.ts — Interactive TUI shell: raw mode bootstrap, main loop, cleanup

import { createApp, updateWithIntent, view } from "./app"
import { enableRawMode, disableRawMode, clearScreen, writeLines, hideCursor, showCursor, readKey } from "./terminal"
import { collectFreshStatus, startInstallTask, startUninstallTask, startPresetInstall, loadDoctorSummary, startDoctorFixTask, loadUpgradeStatus, startUpgradeTask } from "./adapters"
import { route, pushRoute } from "./router"
import { pink, bold, green, red, yellow } from "./theme"
import type { TUIState, TaskKind } from "./types"
import type { ComponentId, InstallResult } from "../components/types"
import type { UpgradeResult } from "../commands/upgrade"

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

        // Handle the key through the app (returns state + raw intent)
        const { state: nextState, intent } = updateWithIntent(state, key)
        state = nextState

        // Load doctor/upgrade data on first navigation to those screens
        if (state.route.id === "doctor" && !state.doctor) {
          state = { ...state, doctor: { loading: true, confirmFix: false } }
          clearScreen()
          writeLines(view(state))
          try {
            const report = await loadDoctorSummary()
            state = { ...state, doctor: { loading: false, report, confirmFix: false } }
          } catch (err) {
            state = { ...state, doctor: { loading: false, confirmFix: false } }
            state = { ...state, message: err instanceof Error ? err.message : String(err) }
          }
        }

        if (state.route.id === "upgrade" && !state.upgrade) {
          state = { ...state, upgrade: { loading: true } }
          clearScreen()
          writeLines(view(state))
          try {
            const status = await loadUpgradeStatus()
            state = { ...state, upgrade: { loading: false, status } }
          } catch (err) {
            state = { ...state, upgrade: { loading: false } }
            state = { ...state, message: err instanceof Error ? err.message : String(err) }
          }
        }

        // Handle task execution intents
        if (intent.type === "run-doctor-fix") {
          state = await executeDoctorFixTask(state)
        } else if (intent.type === "run-upgrade") {
          state = await executeUpgradeTask(state)
        } else if (needsTaskExecution(state, key)) {
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
  const kind: TaskKind = isInstall ? "install" : "uninstall"
  const title = isInstall ? "Instalando componentes" : "Desinstalando componentes"
  let results: InstallResult[]

  // Push to task screen
  state = pushRoute(state, route("task", { action: kind }))
  state = {
    ...state,
    task: { kind, title, step: undefined, log: [], done: false },
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
      action: kind,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    }]
  }

  // Mark task as done, store results
  state = {
    ...state,
    task: { ...state.task!, done: true, step: undefined },
    lastResults: results,
    resultView: { kind },
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

/** Execute a doctor fix task and route through task/results screens */
async function executeDoctorFixTask(state: TUIState): Promise<TUIState> {
  const kind: TaskKind = "doctor-fix"
  const title = "Ejecutando reparaciones"

  // Push to task screen
  state = pushRoute(state, route("task", { action: kind }))
  state = {
    ...state,
    task: { kind, title, step: undefined, log: ["→ Iniciando doctor fix..."], done: false },
  }

  clearScreen()
  writeLines(view(state))

  try {
    const report = await startDoctorFixTask()

    const log = [...state.task!.log]
    for (const fix of report.fixes) {
      const icon = fix.status === "fixed" ? "✓" : fix.status === "failed" ? "✗" : "○"
      log.push(`  ${icon} ${fix.checkId}: ${fix.status} — ${fix.message}`)
    }

    state = {
      ...state,
      task: { ...state.task!, done: true, step: undefined, log },
      resultView: { kind },
    }

    // Refresh statuses
    try {
      const freshStatuses = await collectFreshStatus()
      state = { ...state, statuses: freshStatuses }
    } catch {
      // Keep existing statuses if refresh fails
    }

    // Push to results screen (pushRoute clears doctor, so set it AFTER)
    state = pushRoute(state, route("results"))
    state = { ...state, doctor: { loading: false, report, confirmFix: false } }

    return state
  } catch (err) {
    state = {
      ...state,
      task: {
        ...state.task!,
        done: true,
        step: undefined,
        log: [...state.task!.log, `  ✗ Error: ${err instanceof Error ? err.message : String(err)}`],
      },
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
}

/** Execute an upgrade task and route through task/results screens */
async function executeUpgradeTask(state: TUIState): Promise<TUIState> {
  const kind: TaskKind = "upgrade"
  const title = "Actualizando"

  // Push to task screen
  state = pushRoute(state, route("task", { action: kind }))
  state = {
    ...state,
    task: { kind, title, step: undefined, log: ["→ Iniciando upgrade..."], done: false },
  }

  clearScreen()
  writeLines(view(state))

  try {
    const result: UpgradeResult = await startUpgradeTask()

    const icon = result.status === "upgraded" ? "✓" : result.status === "error" ? "✗" : "○"
    const log = [...state.task!.log, `  ${icon} ${result.status}${result.error ? `: ${result.error}` : ""}`]

    state = {
      ...state,
      task: { ...state.task!, done: true, step: undefined, log },
      upgrade: undefined, // Clear cached status after upgrade
      resultView: { kind },
      // Store upgrade result in lastResults for the results screen
      lastResults: [{
        component: "plugin" as ComponentId,
        action: "install" as const,
        status: result.status === "error" ? "error" : "success",
        message: result.status === "upgraded"
          ? `Actualizado ${result.fromVersion} → ${result.toVersion}`
          : result.status === "up-to-date"
            ? "Ya actualizado"
            : result.error ?? "Error desconocido",
      }],
    }
  } catch (err) {
    state = {
      ...state,
      task: {
        ...state.task!,
        done: true,
        step: undefined,
        log: [...state.task!.log, `  ✗ Error: ${err instanceof Error ? err.message : String(err)}`],
      },
      lastResults: [{
        component: "plugin" as ComponentId,
        action: "install" as const,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      }],
      resultView: { kind },
    }
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
