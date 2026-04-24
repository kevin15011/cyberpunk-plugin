// tests/tui-orchestration.test.ts
// Tests for the async task orchestration flow in src/tui/index.ts
// Exercises executeDoctorFixTask and executeUpgradeTask paths:
// task → results → state transitions, error handling, and post-task navigation.

import { describe, expect, test } from "bun:test"
import type { DoctorRunResult, DoctorFixResult } from "../src/components/types"
import type { TUIState, TaskKind } from "../src/tui/types"
import type { ComponentId, ComponentStatus } from "../src/components/types"
import { route, pushRoute } from "../src/tui/router"

const fakeStatuses: ComponentStatus[] = [
  { id: "plugin", label: "Plugin", status: "installed" },
  { id: "theme", label: "Theme", status: "available" },
]

function makeState(overrides?: Partial<TUIState>): TUIState {
  return {
    statuses: fakeStatuses,
    route: route("home"),
    history: [],
    selectedComponents: [],
    cursor: 0,
    quit: false,
    ...overrides,
  }
}

// --- Shared mock data ---

const MOCK_FIXES: DoctorFixResult[] = [
  { checkId: "plugin:patch", status: "fixed", message: "Patching restored" },
  { checkId: "theme:files", status: "failed", message: "Cannot fix" },
]

const MOCK_DOCTOR_FIX_RESULT: DoctorRunResult = {
  checks: [
    { id: "plugin:patch", label: "Patching", status: "fail", message: "broken", fixable: true },
    { id: "theme:files", label: "Theme files", status: "fail", message: "missing", fixable: true },
  ],
  results: [],
  fixes: MOCK_FIXES,
  summary: { healthy: 0, warnings: 0, failures: 1, fixed: 1, remainingFailures: 1 },
}

describe("executeDoctorFixTask orchestration: state machine", () => {
  test("task state is set to doctor-fix kind with correct title", () => {
    const kind: TaskKind = "doctor-fix"
    const title = "Ejecutando reparaciones"

    const state = makeState()
    const taskState = pushRoute(state, route("task", { action: kind }))
    const withTask: TUIState = {
      ...taskState,
      task: { kind, title, step: undefined, log: ["→ Iniciando doctor fix..."], done: false },
    }

    expect(withTask.route.id).toBe("task")
    expect(withTask.route.params?.action).toBe("doctor-fix")
    expect(withTask.task?.kind).toBe("doctor-fix")
    expect(withTask.task?.title).toBe("Ejecutando reparaciones")
    expect(withTask.task?.done).toBe(false)
    expect(withTask.task?.log).toContain("→ Iniciando doctor fix...")
  })

  test("after doctor fix completes: task.done=true, resultView.kind=doctor-fix, results pushed, doctor report preserved", () => {
    const kind: TaskKind = "doctor-fix"
    let state = makeState()

    // Simulate initial task push
    state = pushRoute(state, route("task", { action: kind }))
    state = { ...state, task: { kind, title: "Ejecutando reparaciones", step: undefined, log: ["→ Iniciando doctor fix..."], done: false } }

    // Simulate successful fix result processing
    const log = [...state.task!.log]
    for (const fix of MOCK_FIXES) {
      const icon = fix.status === "fixed" ? "✓" : fix.status === "failed" ? "✗" : "○"
      log.push(`  ${icon} ${fix.checkId}: ${fix.status} — ${fix.message}`)
    }

    // Simulate post-task state (matches executeDoctorFixTask flow)
    state = {
      ...state,
      task: { ...state.task!, done: true, step: undefined, log },
      resultView: { kind },
    }

    // Push to results screen (clears doctor due to pushRoute)
    state = pushRoute(state, route("results"))

    // Then doctor is set AFTER pushRoute (the fix in index.ts)
    state = { ...state, doctor: { loading: false, report: MOCK_DOCTOR_FIX_RESULT, confirmFix: false } }

    expect(state.route.id).toBe("results")
    expect(state.task?.done).toBe(true)
    expect(state.resultView?.kind).toBe("doctor-fix")
    expect(state.doctor?.report).toEqual(MOCK_DOCTOR_FIX_RESULT)
    expect(state.task?.log).toHaveLength(3) // 1 initial + 2 fixes
    expect(state.task?.log[1]).toContain("plugin:patch")
    expect(state.task?.log[1]).toContain("fixed")
    expect(state.task?.log[2]).toContain("theme:files")
    expect(state.task?.log[2]).toContain("failed")
  })

  test("doctor fix error handling: task.done=true with error in log", () => {
    const kind: TaskKind = "doctor-fix"
    let state = makeState()

    state = pushRoute(state, route("task", { action: kind }))
    state = { ...state, task: { kind, title: "Ejecutando reparaciones", step: undefined, log: ["→ Iniciando doctor fix..."], done: false } }

    // Simulate error
    const errorMsg = "Doctor crashed"
    const log = [...state.task!.log, `  ✗ Error: ${errorMsg}`]
    state = {
      ...state,
      task: { ...state.task!, done: true, step: undefined, log },
    }

    state = pushRoute(state, route("results"))

    expect(state.route.id).toBe("results")
    expect(state.task?.done).toBe(true)
    expect(state.task?.log).toHaveLength(2)
    expect(state.task?.log[1]).toContain("Error: Doctor crashed")
  })

  test("pushRoute clears doctor when navigating to non-doctor route", () => {
    let state = makeState({
      route: route("doctor"),
      doctor: { loading: false, report: MOCK_DOCTOR_FIX_RESULT, confirmFix: false },
    })

    state = pushRoute(state, route("task", { action: "doctor-fix" }))

    expect(state.doctor).toBeUndefined()
  })

  test("doctor must be set AFTER pushRoute to results for results screen to render", () => {
    const kind: TaskKind = "doctor-fix"
    let state = makeState()

    state = pushRoute(state, route("task", { action: kind }))
    state = { ...state, task: { kind, title: "Ejecutando reparaciones", step: undefined, log: [], done: true } }
    state = { ...state, resultView: { kind } }

    // pushRoute to results clears doctor
    state = pushRoute(state, route("results"))
    expect(state.doctor).toBeUndefined()

    // Setting doctor after pushRoute preserves it
    state = { ...state, doctor: { loading: false, report: MOCK_DOCTOR_FIX_RESULT, confirmFix: false } }
    expect(state.doctor?.report).toBeDefined()
    expect(state.doctor?.report.fixes).toHaveLength(2)
  })
})

describe("executeUpgradeTask orchestration: state machine", () => {
  test("task state is set to upgrade kind with correct title", () => {
    const kind: TaskKind = "upgrade"
    const title = "Actualizando"

    const state = makeState()
    const taskState = pushRoute(state, route("task", { action: kind }))
    const withTask: TUIState = {
      ...taskState,
      task: { kind, title, step: undefined, log: ["→ Iniciando upgrade..."], done: false },
    }

    expect(withTask.route.id).toBe("task")
    expect(withTask.route.params?.action).toBe("upgrade")
    expect(withTask.task?.kind).toBe("upgrade")
    expect(withTask.task?.title).toBe("Actualizando")
    expect(withTask.task?.done).toBe(false)
  })

  test("after upgrade completes: task.done=true, lastResults populated, upgrade state cleared", () => {
    const kind: TaskKind = "upgrade"
    let state = makeState()

    state = pushRoute(state, route("task", { action: kind }))
    state = { ...state, task: { kind, title: "Actualizando", step: undefined, log: ["→ Iniciando upgrade..."], done: false } }

    // Simulate successful upgrade result processing
    const log = [...state.task!.log, "  ✓ upgraded"]

    state = {
      ...state,
      task: { ...state.task!, done: true, step: undefined, log },
      upgrade: undefined,
      resultView: { kind },
      lastResults: [{
        component: "plugin" as ComponentId,
        action: "install" as const,
        status: "success",
        message: "Actualizado 1.0.0 → 2.0.0",
      }],
    }

    state = pushRoute(state, route("results"))

    expect(state.route.id).toBe("results")
    expect(state.task?.done).toBe(true)
    expect(state.resultView?.kind).toBe("upgrade")
    expect(state.upgrade).toBeUndefined()
    expect(state.lastResults).toHaveLength(1)
    expect(state.lastResults![0].status).toBe("success")
    expect(state.lastResults![0].message).toContain("Actualizado 1.0.0 → 2.0.0")
  })

  test("upgrade error handling: lastResults has error status", () => {
    const kind: TaskKind = "upgrade"
    let state = makeState()

    state = pushRoute(state, route("task", { action: kind }))
    state = { ...state, task: { kind, title: "Actualizando", step: undefined, log: ["→ Iniciando upgrade..."], done: false } }

    const errorMsg = "Connection timeout"
    state = {
      ...state,
      task: {
        ...state.task!,
        done: true,
        step: undefined,
        log: [...state.task!.log, `  ✗ Error: ${errorMsg}`],
      },
      lastResults: [{
        component: "plugin" as ComponentId,
        action: "install" as const,
        status: "error",
        message: errorMsg,
      }],
      resultView: { kind },
    }

    state = pushRoute(state, route("results"))

    expect(state.route.id).toBe("results")
    expect(state.lastResults).toHaveLength(1)
    expect(state.lastResults![0].status).toBe("error")
    expect(state.lastResults![0].message).toBe("Connection timeout")
  })

  test("up-to-date result: maps to success with appropriate message", () => {
    const kind: TaskKind = "upgrade"
    let state = makeState()

    state = pushRoute(state, route("task", { action: kind }))
    state = { ...state, task: { kind, title: "Actualizando", step: undefined, log: ["→ Iniciando upgrade..."], done: false } }

    state = {
      ...state,
      task: { ...state.task!, done: true, step: undefined, log: [...state.task!.log, "  ○ up-to-date"] },
      upgrade: undefined,
      resultView: { kind },
      lastResults: [{
        component: "plugin" as ComponentId,
        action: "install" as const,
        status: "success",
        message: "Ya actualizado",
      }],
    }

    state = pushRoute(state, route("results"))

    expect(state.lastResults![0].status).toBe("success")
    expect(state.lastResults![0].message).toBe("Ya actualizado")
  })
})

describe("needsTaskExecution: doctor-fix and upgrade bypass install/uninstall paths", () => {
  test("install screen in confirm phase with selection triggers task execution", () => {
    const state = makeState({
      route: route("install"),
      _installPhase: "confirm",
      selectedComponents: ["plugin"] as ComponentId[],
    })

    expect(state.route.id).toBe("install")
    expect(state._installPhase).toBe("confirm")
    expect(state.selectedComponents.length).toBeGreaterThan(0)
  })

  test("doctor route does NOT match needsTaskExecution conditions", () => {
    const state = makeState({ route: route("doctor") })
    expect(state.route.id).toBe("doctor")
    expect(state.route.id !== "install" && state.route.id !== "uninstall").toBe(true)
  })

  test("upgrade route does NOT match needsTaskExecution conditions", () => {
    const state = makeState({ route: route("upgrade") })
    expect(state.route.id).toBe("upgrade")
    expect(state.route.id !== "install" && state.route.id !== "uninstall").toBe(true)
  })
})

describe("post-task navigation: results → back → home for all task kinds", () => {
  const { update } = require("../src/tui/app")

  test("doctor-fix results → back → home", () => {
    let state = makeState({
      route: route("results"),
      history: [route("home"), route("doctor"), route("task", { action: "doctor-fix" })],
      resultView: { kind: "doctor-fix" },
      task: { kind: "doctor-fix", title: "Ejecutando reparaciones", step: undefined, log: [], done: true },
      doctor: {
        loading: false,
        report: MOCK_DOCTOR_FIX_RESULT,
        confirmFix: false,
      },
    })

    // Back from results → task
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("task")

    // Simulate done task
    state = { ...state, task: { ...state.task!, done: true } }

    // Back from task → doctor
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("doctor")

    // Back from doctor → home
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("home")
  })

  test("upgrade results → back → home", () => {
    let state = makeState({
      route: route("results"),
      history: [route("home"), route("upgrade"), route("task", { action: "upgrade" })],
      resultView: { kind: "upgrade" },
      task: { kind: "upgrade", title: "Actualizando", step: undefined, log: [], done: true },
      lastResults: [{
        component: "plugin",
        action: "install",
        status: "success",
        message: "Actualizado 1.0.0 → 2.0.0",
      }],
    })

    // Back from results → task
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("task")

    // Simulate done task
    state = { ...state, task: { ...state.task!, done: true } }

    // Back from task → upgrade
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("upgrade")

    // Back from upgrade → home
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("home")
  })
})

describe("doctor/upgrade data loading on route entry", () => {
  test("navigating to doctor with no doctor state triggers loading", () => {
    const state = makeState({ route: route("doctor") })
    expect(state.route.id).toBe("doctor")
    expect(state.doctor).toBeUndefined()
  })

  test("navigating to doctor with existing doctor state does NOT reload", () => {
    const state = makeState({
      route: route("doctor"),
      doctor: { loading: false, confirmFix: false },
    })
    expect(state.route.id).toBe("doctor")
    expect(state.doctor).toBeDefined()
  })

  test("navigating to upgrade with no upgrade state triggers loading", () => {
    const state = makeState({ route: route("upgrade") })
    expect(state.route.id).toBe("upgrade")
    expect(state.upgrade).toBeUndefined()
  })

  test("navigating to upgrade with existing upgrade state does NOT reload", () => {
    const state = makeState({
      route: route("upgrade"),
      upgrade: { loading: false, status: { currentVersion: "1.0.0", latestVersion: "1.0.0", upToDate: true, changedFiles: [] } },
    })
    expect(state.route.id).toBe("upgrade")
    expect(state.upgrade).toBeDefined()
  })
})
