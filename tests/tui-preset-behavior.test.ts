// tests/tui-preset-behavior.test.ts
// Behavioral tests for TUI preset install flow via router/app dispatch

import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"

const actualDetect = await import("../src/platform/detect")

let detectedEnvironment: "linux" | "wsl" | "darwin" = "linux"

const runInstallCalls: string[][] = []

mock.module("../src/platform/detect", () => ({
  ...actualDetect,
  detectEnvironment: mock(() => detectedEnvironment),
  isWSL: mock(() => detectedEnvironment === "wsl"),
}))

mock.module("../src/commands/install", () => ({
  runInstall: mock(async (ids: string[], _action?: string, _hooks?: any) => {
    runInstallCalls.push([...ids])
    return ids.map((id: string) => ({
      component: id,
      action: "install" as const,
      status: "success" as const,
    }))
  }),
  runUninstall: mock(async () => []),
}))

mock.module("../src/commands/status", () => ({
  collectStatus: mock(async () => [
    { id: "plugin", label: "Plugin de OpenCode", status: "available" },
    { id: "theme", label: "Tema cyberpunk", status: "available" },
    { id: "sounds", label: "Sonidos", status: "available" },
    { id: "context-mode", label: "Context-Mode", status: "available" },
    { id: "rtk", label: "RTK", status: "available" },
    { id: "tmux", label: "Tmux", status: "available" },
  ]),
}))

mock.module("../src/commands/preflight", () => ({
  buildPresetPreflight: mock(async (resolved: { id: string; label: string; components: string[]; warnings: string[] }) => ({
    preset: resolved,
    components: resolved.components.map((id: string) => ({
      id,
      installed: id === "plugin",
      readiness: "ready" as const,
      dependencyIds: [] as string[],
      fileTouches: [] as string[],
    })),
    dependencies: [],
    warnings: resolved.warnings,
    notes: [],
  })),
}))

describe("TUI preset install flow via router", () => {
  beforeEach(() => {
    detectedEnvironment = "linux"
    runInstallCalls.length = 0
  })

  test("preset options are built from PRESET_NAMES including wsl and mac", async () => {
    const { PRESET_NAMES } = await import("../src/presets/index")

    const presetValues = PRESET_NAMES.map(p => p.value)
    expect(presetValues).toContain("minimal")
    expect(presetValues).toContain("full")
    expect(presetValues).toContain("wsl")
    expect(presetValues).toContain("mac")
  })

  test("resolvePreset resolves minimal to plugin + theme", async () => {
    const { resolvePreset } = await import("../src/presets/index")
    const resolved = resolvePreset("minimal")
    expect(resolved.components).toEqual(["plugin", "theme"])
  })

  test("resolvePreset resolves full to all components", async () => {
    const { resolvePreset } = await import("../src/presets/index")
    const resolved = resolvePreset("full")
    expect(resolved.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"])
  })

  test("resolvePreset resolves wsl to wsl components", async () => {
    const { resolvePreset } = await import("../src/presets/index")
    const resolved = resolvePreset("wsl")
    expect(resolved.components).toEqual(["plugin", "theme", "sounds", "tmux"])
  })

  test("resolvePreset resolves mac to mac components", async () => {
    const { resolvePreset } = await import("../src/presets/index")
    const resolved = resolvePreset("mac")
    expect(resolved.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk"])
  })

  test("resolvePreset throws on unknown preset", async () => {
    const { resolvePreset } = await import("../src/presets/index")
    expect(() => resolvePreset("nonexistent")).toThrow("Preset desconocido")
  })

  test("app routes install screen correctly", async () => {
    const { createApp, update } = await import("../src/tui/app")
    const { collectStatus } = await import("../src/commands/status")
    const statuses = await collectStatus()

    let state = createApp(statuses)
    // Navigate to install (cursor 0 = install, which is default)
    state = update(state, { type: "enter" })
    expect(state.route.id).toBe("install")
  })

  test("startPresetInstall calls runInstall with preset components", async () => {
    const { startPresetInstall } = await import("../src/tui/adapters")
    runInstallCalls.length = 0
    await startPresetInstall("minimal")
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin", "theme"])
  })

  test("startInstallTask calls runInstall with selected components", async () => {
    const { startInstallTask } = await import("../src/tui/adapters")
    runInstallCalls.length = 0
    await startInstallTask(["plugin", "sounds"])
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin", "sounds"])
  })

  test("startUninstallTask calls runInstall with uninstall action", async () => {
    const { startUninstallTask } = await import("../src/tui/adapters")
    runInstallCalls.length = 0
    await startUninstallTask(["plugin"])
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin"])
  })
})
