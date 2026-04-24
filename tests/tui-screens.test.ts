// tests/tui-screens.test.ts — Snapshot-style string assertions for screen render output

import { describe, expect, test } from "bun:test"
import { homeScreen } from "../src/tui/screens/home"
import { installScreen } from "../src/tui/screens/install"
import { uninstallScreen } from "../src/tui/screens/uninstall"
import { statusScreen } from "../src/tui/screens/status"
import { taskScreen } from "../src/tui/screens/task"
import { resultsScreen } from "../src/tui/screens/results"
import { resultDetailScreen } from "../src/tui/screens/result-detail"
import type { TUIState } from "../src/tui/types"
import { route } from "../src/tui/router"
import type { ComponentStatus, InstallResult } from "../src/components/types"

const fakeStatuses: ComponentStatus[] = [
  { id: "plugin", label: "Plugin de OpenCode", status: "installed" },
  { id: "theme", label: "Tema cyberpunk", status: "available" },
  { id: "sounds", label: "Sonidos", status: "error", error: "missing ffmpeg" },
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

describe("home screen render", () => {
  test("renders status summary and menu items", () => {
    const lines = homeScreen.render(makeState())
    const output = lines.join("\n")
    expect(output).toContain("Plugin de OpenCode")
    expect(output).toContain("Tema cyberpunk")
    expect(output).toContain("Sonidos")
    expect(output).toContain("Instalar componentes")
    expect(output).toContain("Desinstalar componentes")
    expect(output).toContain("Ver estado")
    expect(output).toContain("Salir")
  })

  test("highlights current cursor position", () => {
    const state = makeState({ cursor: 1 })
    const lines = homeScreen.render(state)
    // Second item should be highlighted (cursor=1)
    const output = lines.join("\n")
    expect(output).toContain("❯")
  })
})

describe("home screen update", () => {
  test("down moves cursor", () => {
    const state = makeState()
    const result = homeScreen.update(state, { type: "down" })
    expect(result.state.cursor).toBe(1)
  })

  test("up does not go below zero", () => {
    const state = makeState({ cursor: 0 })
    const result = homeScreen.update(state, { type: "up" })
    expect(result.state.cursor).toBe(0)
  })

  test("enter on install navigates to install route", () => {
    const state = makeState({ cursor: 0 }) // install is first item
    const result = homeScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("navigate")
    if (result.intent.type === "navigate") {
      expect(result.intent.route.id).toBe("install")
    }
  })

  test("enter on quit emits quit intent", () => {
    const state = makeState({ cursor: 3 }) // quit is 4th item (index 3)
    const result = homeScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("quit")
    expect(result.state.quit).toBe(true)
  })

  test("ctrl-c quits", () => {
    const result = homeScreen.update(makeState(), { type: "ctrl-c" })
    expect(result.state.quit).toBe(true)
  })
})

describe("status screen render", () => {
  test("renders all component statuses", () => {
    const state = makeState({ route: route("status") })
    const lines = statusScreen.render(state)
    const output = lines.join("\n")
    expect(output).toContain("Plugin de OpenCode")
    expect(output).toContain("instalado")
    expect(output).toContain("Tema cyberpunk")
    expect(output).toContain("disponible")
    expect(output).toContain("Sonidos")
    expect(output).toContain("error")
  })

  test("enter goes back", () => {
    const state = makeState({ route: route("status") })
    const result = statusScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("back")
  })
})

describe("task screen render", () => {
  test("renders active step", () => {
    const state = makeState({
      route: route("task", { action: "install" }),
      task: { action: "install", step: "plugin", log: ["→ Iniciando plugin..."], done: false },
    })
    const lines = taskScreen.render(state)
    const output = lines.join("\n")
    expect(output).toContain("plugin")
    expect(output).toContain("INSTALANDO")
    expect(output).toContain("Iniciando plugin")
  })

  test("renders done state", () => {
    const state = makeState({
      route: route("task", { action: "install" }),
      task: { action: "install", step: undefined, log: [], done: true },
    })
    const lines = taskScreen.render(state)
    const output = lines.join("\n")
    expect(output).toContain("completada")
  })

  test("enter when done navigates to results", () => {
    const state = makeState({
      route: route("task", { action: "install" }),
      task: { action: "install", step: undefined, log: [], done: true },
    })
    const result = taskScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("navigate")
    if (result.intent.type === "navigate") {
      expect(result.intent.route.id).toBe("results")
    }
  })
})

describe("results screen render", () => {
  const fakeResults: InstallResult[] = [
    { component: "plugin", action: "install", status: "success" },
    { component: "theme", action: "install", status: "error", message: "file not found" },
  ]

  test("renders result rows", () => {
    const state = makeState({
      route: route("results"),
      lastResults: fakeResults,
    })
    const lines = resultsScreen.render(state)
    const output = lines.join("\n")
    expect(output).toContain("Plugin de OpenCode")
    expect(output).toContain("Tema cyberpunk")
    expect(output).toContain("file not found")
  })

  test("enter navigates to result-detail", () => {
    const state = makeState({
      route: route("results"),
      lastResults: fakeResults,
      cursor: 1,
    })
    const result = resultsScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("navigate")
    if (result.intent.type === "navigate") {
      expect(result.intent.route.id).toBe("result-detail")
      expect(result.intent.route.params?.resultIndex).toBe(1)
    }
  })
})

describe("result-detail screen render", () => {
  const fakeResults: InstallResult[] = [
    { component: "plugin", action: "install", status: "success", message: "OK", path: "/some/path" },
  ]

  test("renders detail for selected result", () => {
    const state = makeState({
      route: route("result-detail", { resultIndex: 0 }),
      lastResults: fakeResults,
    })
    const lines = resultDetailScreen.render(state)
    const output = lines.join("\n")
    expect(output).toContain("Plugin de OpenCode")
    expect(output).toContain("Exitoso")
    expect(output).toContain("OK")
    expect(output).toContain("/some/path")
  })

  test("enter goes back to results", () => {
    const state = makeState({
      route: route("result-detail", { resultIndex: 0 }),
      lastResults: fakeResults,
      history: [route("home"), route("results")],
    })
    const result = resultDetailScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("back")
  })
})

describe("install screen render", () => {
  test("renders preset picker by default", () => {
    const state = makeState({ route: route("install") })
    const lines = installScreen.render(state)
    const output = lines.join("\n")
    expect(output).toContain("INSTALAR COMPONENTES")
    // Should show preset options
    expect(output).toContain("Selección manual")
  })
})

describe("uninstall screen render", () => {
  test("shows installed components only", () => {
    const state = makeState({
      route: route("uninstall"),
      statuses: fakeStatuses,
    })
    const lines = uninstallScreen.render(state)
    const output = lines.join("\n")
    // Only "plugin" is installed in fakeStatuses
    expect(output).toContain("Plugin de OpenCode")
    // Theme is "available", shouldn't appear in uninstall list
    expect(output).not.toContain("Tema cyberpunk")
  })

  test("empty selection guard on enter", () => {
    const state = makeState({
      route: route("uninstall"),
      selectedComponents: [],
    })
    const result = uninstallScreen.update(state, { type: "enter" })
    expect(result.state.message).toContain("al menos un componente")
  })

  test("space toggles component selection", () => {
    const state = makeState({
      route: route("uninstall"),
      statuses: fakeStatuses,
      cursor: 0, // plugin, which is installed
    })
    const result = uninstallScreen.update(state, { type: "space" })
    expect(result.state.selectedComponents).toContain("plugin")
  })
})

// ─── Behavioral tests for spec scenario coverage ───

describe("install screen manual component selection flow", () => {
  // Spec scenario: "Select components from install screen"
  // GIVEN the user is on the install screen and "sounds" is not selected
  // WHEN the user selects sounds and confirms the install action
  // THEN the shell starts an install task for the selected components only

  test("manual selection: preset → manual → toggle sounds → confirm → task intent", () => {
    // Start on install screen (preset phase by default)
    let state = makeState({ route: route("install") })

    // Render should show preset picker
    let lines = installScreen.render(state)
    let output = lines.join("\n")
    expect(output).toContain("Selección manual")

    // Find the "manual" option index — it's the last option in getPresetOptions()
    // Navigate down to "Selección manual" and select it
    // First, figure out how many preset options there are
    const { PRESET_NAMES } = require("../src/presets")
    const manualIndex = PRESET_NAMES.length // last option

    // Move cursor to manual option
    for (let i = 0; i < manualIndex; i++) {
      state = installScreen.update(state, { type: "down" }).state
    }
    expect(state.cursor).toBe(manualIndex)

    // Select manual
    const manualResult = installScreen.update(state, { type: "enter" })
    expect(manualResult.state._installPhase).toBe("manual")
    expect(manualResult.intent.type).toBe("none") // stays on screen

    state = manualResult.state

    // Now in manual phase — should render component list
    lines = installScreen.render(state)
    output = lines.join("\n")
    expect(output).toContain("Plugin de OpenCode")
    expect(output).toContain("Tema cyberpunk")
    expect(output).toContain("Sonidos")

    // Navigate to "sounds" (index 2) and toggle it
    state = installScreen.update(state, { type: "down" }).state // cursor=1 (theme)
    state = installScreen.update(state, { type: "down" }).state // cursor=2 (sounds)
    expect(state.cursor).toBe(2)

    // Toggle sounds
    const toggleResult = installScreen.update(state, { type: "space" })
    expect(toggleResult.state.selectedComponents).toContain("sounds")
    expect(toggleResult.state.selectedComponents).not.toContain("plugin")
    state = toggleResult.state

    // Press enter — should move to confirm phase (not emit confirm yet)
    const confirmResult = installScreen.update(state, { type: "enter" })
    expect(confirmResult.state._installPhase).toBe("confirm")
    expect(confirmResult.intent.type).toBe("none")
    state = confirmResult.state

    // Confirm phase should show the selected component
    lines = installScreen.render(state)
    output = lines.join("\n")
    expect(output).toContain("Sonidos")
    expect(output).toContain("Confirmar instalación")

    // Press enter again — should emit confirm intent
    const finalResult = installScreen.update(state, { type: "enter" })
    expect(finalResult.intent.type).toBe("confirm")
    expect(finalResult.state.selectedComponents).toContain("sounds")
  })

  test("manual selection: empty selection guard on enter in manual phase", () => {
    // Spec scenario: "Reject empty interactive action"
    const state = makeState({
      route: route("install"),
      _installPhase: "manual",
      selectedComponents: [],
    })

    const result = installScreen.update(state, { type: "enter" })
    expect(result.state.message).toContain("al menos un componente")
    expect(result.intent.type).toBe("none")
    // Should still be in manual phase
    expect(result.state._installPhase).toBe("manual")
  })

  test("manual selection: back from manual returns to preset phase", () => {
    const state = makeState({
      route: route("install"),
      _installPhase: "manual",
      selectedComponents: ["sounds"],
    })

    const result = installScreen.update(state, { type: "back" })
    expect(result.state._installPhase).toBe("preset")
    expect(result.state.selectedComponents).toEqual([])
  })

  test("manual selection: back from confirm (manual-origin) returns to manual phase", () => {
    const state = makeState({
      route: route("install"),
      _installPhase: "confirm",
      selectedComponents: ["sounds"],
      // No selectedPreset means we came from manual
    })

    const result = installScreen.update(state, { type: "back" })
    expect(result.state._installPhase).toBe("manual")
    // Should keep selected components so user can adjust
    expect(result.state.selectedComponents).toContain("sounds")
  })

  test("preset selection: back from confirm (preset-origin) returns to preset phase", () => {
    const state = makeState({
      route: route("install"),
      _installPhase: "confirm",
      selectedPreset: "full",
      selectedComponents: [],
    })

    const result = installScreen.update(state, { type: "back" })
    expect(result.state._installPhase).toBe("preset")
    expect(result.state.selectedPreset).toBeUndefined()
    expect(result.state.selectedComponents).toEqual([])
  })
})

describe("results screen back navigation", () => {
  // Spec scenario: "Review results after an install task"
  // AND the user can return to the home screen without restarting cyberpunk

  const fakeResults: InstallResult[] = [
    { component: "plugin", action: "install", status: "success" },
    { component: "theme", action: "install", status: "error", message: "file not found" },
  ]

  test("Esc/back navigates back from results", () => {
    const state = makeState({
      route: route("results"),
      history: [route("home"), route("install"), route("task", { action: "install" })],
      lastResults: fakeResults,
    })

    const result = resultsScreen.update(state, { type: "back" })
    expect(result.intent.type).toBe("back")
  })

  test("full navigation: results → detail → results → back to home", () => {
    let state = makeState({
      route: route("results"),
      history: [route("home"), route("install"), route("task", { action: "install" })],
      lastResults: fakeResults,
    })

    // Enter detail for first result
    let result = resultsScreen.update(state, { type: "enter" })
    expect(result.intent.type).toBe("navigate")
    if (result.intent.type === "navigate") {
      expect(result.intent.route.id).toBe("result-detail")
    }
    state = { ...result.state, route: route("result-detail", { resultIndex: 0 }) }

    // From detail, press back to return to results (emits back intent)
    result = resultDetailScreen.update(state, { type: "back" })
    expect(result.intent.type).toBe("back")
    state = { ...result.state, route: route("results") }

    // From results, press back to go home (emits back intent)
    result = resultsScreen.update(state, { type: "back" })
    expect(result.intent.type).toBe("back")
  })
})

describe("install screen Esc from preset phase navigates back", () => {
  test("back from preset phase emits back intent", () => {
    const state = makeState({
      route: route("install"),
      history: [route("home")],
    })

    const result = installScreen.update(state, { type: "back" })
    expect(result.intent.type).toBe("back")
  })
})

describe("terminal readKey maps escape to back", () => {
  test("bare escape produces back key", () => {
    const { readKey } = require("../src/tui/terminal")
    const key = readKey(Buffer.from("\x1b"))
    expect(key.type).toBe("back")
  })
})

// ─── Integration: app-level update through full flows ───

describe("app update: manual install → confirm → results → detail → home", () => {
  const { createApp, update, view } = require("../src/tui/app")
  const { PRESET_NAMES } = require("../src/presets")

  test("full manual install flow through app update", () => {
    let state = createApp(fakeStatuses)
    expect(state.route.id).toBe("home")

    // Home → install
    state = update(state, { type: "enter" }) // cursor=0 = install
    expect(state.route.id).toBe("install")
    expect(state._installPhase).toBeUndefined() // preset phase

    // Navigate to "Selección manual" (last option)
    const manualIndex = PRESET_NAMES.length
    for (let i = 0; i < manualIndex; i++) {
      state = update(state, { type: "down" })
    }
    state = update(state, { type: "enter" }) // select manual
    expect(state._installPhase).toBe("manual")

    // Navigate to sounds (index 2)
    state = update(state, { type: "down" })
    state = update(state, { type: "down" })
    state = update(state, { type: "space" }) // toggle sounds
    expect(state.selectedComponents).toContain("sounds")

    // Enter → confirm phase (not task yet)
    state = update(state, { type: "enter" })
    expect(state._installPhase).toBe("confirm")
    expect(state.route.id).toBe("install") // still on install screen

    // Confirm phase render shows selected components
    const lines = view(state)
    expect(lines.join("\n")).toContain("Confirmar instalación")
    expect(lines.join("\n")).toContain("Sonidos")

    // Note: pressing enter in confirm phase emits "confirm" intent,
    // but app.ts applyIntent treats "confirm" as no-op (task execution is handled
    // by index.ts runTUI loop, not by app update). The behavioral test stops here
    // since task execution requires async adapters.
  })

  test("results → back → home through app update", () => {
    // Start on results screen with history
    let state = makeState({
      route: route("results"),
      history: [route("home"), route("install"), route("task", { action: "install" })],
      lastResults: [
        { component: "plugin", action: "install", status: "success" },
      ],
    })

    // Back from results should pop to task
    state = update(state, { type: "back" })
    // popRoute pops the last history entry → goes to task
    expect(state.history.length).toBe(2)
    expect(state.route.id).toBe("task")

    // The task screen needs task.done=true to allow back navigation
    // Simulate the state as if task is done (this is the realistic scenario:
    // after task completes, results screen is pushed, so popping back goes to
    // the done-task screen)
    state = { ...state, task: { action: "install", step: undefined, log: [], done: true } }

    // Back from task (done) → install
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("install")

    // Back from install → home
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("home")
    expect(state.history.length).toBe(0)
  })

  test("results → detail → results → back flow", () => {
    const fakeResults: InstallResult[] = [
      { component: "plugin", action: "install", status: "success", message: "OK" },
      { component: "theme", action: "install", status: "error", message: "fail" },
    ]

    let state = makeState({
      route: route("results"),
      history: [route("home")],
      lastResults: fakeResults,
    })

    // Enter detail
    state = update(state, { type: "enter" })
    expect(state.route.id).toBe("result-detail")
    expect(state.route.params?.resultIndex).toBe(0)

    // Detail view shows the result
    const detailLines = view(state)
    expect(detailLines.join("\n")).toContain("Plugin de OpenCode")

    // Back from detail → results
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("results")

    // Back from results → home
    state = update(state, { type: "back" })
    expect(state.route.id).toBe("home")
  })
})
