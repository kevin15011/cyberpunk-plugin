// tests/tui-install-flow.test.ts — TUI install flow: OS→Tool→Preset sequential gating
//
// Tests the multi-phase install screen flow:
// 1. os-select (auto-detect, manual change)
// 2. tool-select (OpenCode active, Claude/Codex disabled/future)
// 3. preset/manual selection (only after OS + tool confirmed)
// 4. confirm phase

import { describe, test, expect } from "bun:test"
import { installScreen } from "../src/tui/screens/install"
import type { TUIState, KeyEvent, InstallPhase } from "../src/tui/types"
import { resolvePreset } from "../src/presets"

function makeState(overrides: Partial<TUIState> = {}): TUIState {
  return {
    statuses: [],
    route: { id: "install" },
    history: [],
    selectedComponents: [],
    cursor: 0,
    quit: false,
    ...overrides,
  }
}

function keyPress(type: KeyEvent["type"]): KeyEvent {
  return { type } as KeyEvent
}

// ── Phase 1: OS Selection ────────────────────────────────────────

describe("TUI install flow — OS selection", () => {
  test("initial state shows os-select phase", () => {
    const state = makeState()
    const lines = installScreen.render(state)
    expect(lines.some(l => l.includes("sistema operativo") || l.includes("OS"))).toBe(true)
    expect(lines.some(l => l.includes("macOS"))).toBe(true)
    expect(lines.some(l => l.includes("Linux"))).toBe(true)
  })

  test("auto-detected OS is highlighted", () => {
    const state = makeState()
    const lines = installScreen.render(state)
    // Should show "(detectado:" for the auto-detected OS
    expect(lines.some(l => l.includes("detectado"))).toBe(true)
  })

  test("enter on os-select sets selectedOS and moves to tool-select", () => {
    const state = makeState({ cursor: 0 }) // macOS
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state.selectedOS).toBe("darwin")
    expect(result.state._installPhase).toBe("tool-select")
    expect(result.intent.type).toBe("none")
  })

  test("cursor navigation works in os-select", () => {
    const state = makeState({ cursor: 0 })
    const down = installScreen.update(state, keyPress("down"))
    expect(down.state.cursor).toBe(1)
    const up = installScreen.update(down.state, keyPress("up"))
    expect(up.state.cursor).toBe(0)
  })

  test("selecting Linux (index 1) sets selectedOS to linux", () => {
    const state = makeState({ cursor: 1 })
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state.selectedOS).toBe("linux")
  })

  test("back on os-select navigates to home", () => {
    const state = makeState()
    const result = installScreen.update(state, keyPress("back"))
    expect(result.intent.type).toBe("back")
  })
})

// ── Phase 2: Tool Selection ──────────────────────────────────────

describe("TUI install flow — tool selection", () => {
  test("tool-select shows OpenCode as active", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
    })
    const lines = installScreen.render(state)
    expect(lines.some(l => l.includes("OpenCode"))).toBe(true)
    expect(lines.some(l => l.includes("Claude"))).toBe(true)
    expect(lines.some(l => l.includes("Codex"))).toBe(true)
  })

  test("OpenCode shows as selectable (no disabled label)", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
    })
    const lines = installScreen.render(state)
    const opencodeLines = lines.filter(l => l.includes("OpenCode"))
    expect(opencodeLines.some(l => !l.includes("Próximamente"))).toBe(true)
  })

  test("Claude shows as disabled while Codex is selectable for token tools", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
    })
    const lines = installScreen.render(state)
    const claudeLine = lines.find(l => l.includes("Claude Code")) ?? ""
    const codexLine = lines.find(l => l.includes("Codex")) ?? ""
    expect(claudeLine).toMatch(/Próximamente|No implementado/)
    expect(codexLine).toContain("Ahorro de tokens")
    expect(codexLine).not.toMatch(/Próximamente|No implementado/)
  })

  test("selecting OpenCode moves to preset phase", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
      cursor: 0, // OpenCode
    })
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state.selectedTool).toBe("opencode")
    expect(result.state._installPhase).toBe("preset")
  })

  test("selecting Claude (disabled) stays on tool-select with info message", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
      cursor: 1, // Claude
    })
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state.selectedTool).toBeUndefined()
    expect(result.state._installPhase).toBe("tool-select")
    expect(result.state.message).toContain("no está implementado")
  })

  test("selecting Codex moves to preset phase", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
      cursor: 2, // Codex
    })
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state.selectedTool).toBe("codex")
    expect(result.state._installPhase).toBe("preset")
    expect(result.state.message).toBeUndefined()
  })

  test("back on tool-select returns to os-select", () => {
    const state = makeState({
      selectedOS: "darwin",
      _installPhase: "tool-select",
    })
    const result = installScreen.update(state, keyPress("back"))
    expect(result.state.selectedOS).toBeUndefined()
    expect(result.state._installPhase).toBe("os-select")
  })
})

// ── Phase 3: Preset Selection (gated after OS + tool) ────────────

describe("TUI install flow — preset selection (gated)", () => {
  test("preset phase shows after OS and tool are selected", () => {
    const state = makeState({
      selectedOS: "linux",
      selectedTool: "opencode",
      _installPhase: "preset",
    })
    const lines = installScreen.render(state)
    expect(lines.some(l => l.includes("preset") || l.includes("Elegí"))).toBe(true)
    // Should show OS and tool context
    expect(lines.some(l => l.includes("Linux"))).toBe(true)
    expect(lines.some(l => l.includes("opencode"))).toBe(true)
  })

  test("preset selection sets confirm phase", () => {
    const state = makeState({
      selectedOS: "linux",
      selectedTool: "opencode",
      _installPhase: "preset",
      cursor: 0,
    })
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state._installPhase).toBe("confirm")
    expect(result.state.selectedPreset).toBeDefined()
  })

  test("normal preset selected from TUI resolves without theme or sounds", () => {
    const state = makeState({
      selectedOS: "darwin",
      selectedTool: "opencode",
      _installPhase: "preset",
      cursor: 0,
    })
    const result = installScreen.update(state, keyPress("enter"))
    const resolved = resolvePreset(result.state.selectedPreset!)

    expect(resolved.components).not.toContain("theme")
    expect(resolved.components).not.toContain("sounds")
  })

  test("full preset selected from TUI keeps theme and sounds", () => {
    const state = makeState({
      selectedOS: "darwin",
      selectedTool: "opencode",
      _installPhase: "preset",
      cursor: 4, // Cyberpunk Full Experience
    })
    const result = installScreen.update(state, keyPress("enter"))
    const resolved = resolvePreset(result.state.selectedPreset!)

    expect(resolved.id).toBe("cyberpunk-full")
    expect(resolved.components).toContain("theme")
    expect(resolved.components).toContain("sounds")
  })

  test("Codex preset screen shows Codex-specific presets and target status", () => {
    const state = makeState({
      selectedOS: "darwin",
      selectedTool: "codex",
      _installPhase: "preset",
      statuses: [
        { id: "rtk", label: "RTK", status: "available" },
        { id: "context-mode", label: "Context Mode", status: "installed" },
      ],
    })
    const output = installScreen.render(state).join("\n")

    expect(output).toContain("Estado rápido para Codex")
    expect(output).toContain("Codex RTK")
    expect(output).toContain("Codex Token Saver")
    expect(output).toContain("Codex Token Toolkit")
    expect(output).not.toContain("Cyberpunk Full Experience")
  })

  test("Codex toolkit preset resolves only Codex-supported token tools", () => {
    const state = makeState({
      selectedOS: "darwin",
      selectedTool: "codex",
      _installPhase: "preset",
      cursor: 2, // Codex Token Toolkit
    })
    const result = installScreen.update(state, keyPress("enter"))
    const resolved = resolvePreset(result.state.selectedPreset!, { target: "codex" })

    expect(resolved.id).toBe("developer-toolkit")
    expect(resolved.components.sort()).toEqual(["codebase-memory", "context-mode", "rtk"])
  })

  test("manual selection from preset works", () => {
    // Find the "manual" option — it's the last one
    const state = makeState({
      selectedOS: "darwin",
      selectedTool: "opencode",
      _installPhase: "preset",
      cursor: 6, // Should be "Selección manual" — last option
    })
    const result = installScreen.update(state, keyPress("enter"))
    expect(result.state._installPhase).toBe("manual")
  })

  test("manual selection can explicitly choose theme and sounds", () => {
    let state = makeState({
      selectedOS: "darwin",
      selectedTool: "opencode",
      _installPhase: "manual",
      statuses: [
        { id: "plugin", label: "Plugin", status: "available" },
        { id: "theme", label: "Theme", status: "available" },
        { id: "sounds", label: "Sounds", status: "available" },
      ],
      cursor: 1,
    })

    state = installScreen.update(state, keyPress("space")).state
    state = installScreen.update({ ...state, cursor: 2 }, keyPress("space")).state

    expect(state.selectedComponents).toContain("theme")
    expect(state.selectedComponents).toContain("sounds")
  })

  test("back on preset returns to tool-select (not os-select)", () => {
    const state = makeState({
      selectedOS: "darwin",
      selectedTool: "opencode",
      _installPhase: "preset",
    })
    const result = installScreen.update(state, keyPress("back"))
    expect(result.state.selectedTool).toBeUndefined()
    expect(result.state._installPhase).toBe("tool-select")
  })
})

// ── Back navigation chain ────────────────────────────────────────

describe("TUI install flow — full back navigation", () => {
  test("back from confirm → preset → tool-select → os-select", () => {
    // Start at confirm
    let state = makeState({
      selectedOS: "darwin",
      selectedTool: "opencode",
      selectedPreset: "minimal",
      _installPhase: "confirm",
    })

    // Back → preset
    let result = installScreen.update(state, keyPress("back"))
    expect(result.state._installPhase).toBe("preset")

    // Back → tool-select
    result = installScreen.update(result.state, keyPress("back"))
    expect(result.state._installPhase).toBe("tool-select")
    expect(result.state.selectedTool).toBeUndefined()

    // Back → os-select
    result = installScreen.update(result.state, keyPress("back"))
    expect(result.state._installPhase).toBe("os-select")
    expect(result.state.selectedOS).toBeUndefined()

    // Back → home
    result = installScreen.update(result.state, keyPress("back"))
    expect(result.intent.type).toBe("back")
  })
})
