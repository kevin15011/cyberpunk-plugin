// tests/tui-preset-behavior.test.ts
// Behavioral tests for TUI preset install flow

import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"

const actualDetect = await import("../src/platform/detect")

let selectValue: string = "minimal"
let confirmValue: boolean = true
let isCancelValue: boolean = false
let detectedEnvironment: "linux" | "wsl" | "darwin" = "linux"
let preflightOverride: any | null = null

const runInstallCalls: string[][] = []
const noteCalls: { message: string; title: string }[] = []

mock.module("../src/platform/detect", () => ({
  ...actualDetect,
  detectEnvironment: mock(() => detectedEnvironment),
  isWSL: mock(() => detectedEnvironment === "wsl"),
}))

mock.module("@clack/prompts", () => ({
  select: mock(async () => selectValue),
  confirm: mock(async () => confirmValue),
  isCancel: mock((_val: unknown) => isCancelValue),
  note: mock((message: string, title?: string) => {
    noteCalls.push({ message, title: title ?? "" })
  }),
  spinner: mock(() => ({
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  intro: mock(() => {}),
  outro: mock(() => {}),
  multiselect: mock(async () => []),
}))

mock.module("../src/commands/install", () => ({
  runInstall: mock(async (ids: string[]) => {
    runInstallCalls.push([...ids])
    return ids.map((id: string) => ({
      component: id,
      action: "install" as const,
      status: "success" as const,
    }))
  }),
  runUninstall: mock(async () => []),
}))

mock.module("../src/commands/preflight", () => ({
  buildPresetPreflight: mock(async (resolved: { id: string; label: string; components: string[]; warnings: string[] }) => (
    preflightOverride ?? {
      preset: resolved,
      components: resolved.components.map(id => ({
        id,
        installed: id === "plugin",
        readiness: id === "sounds" || id === "context-mode" || id === "rtk" ? "degraded" : "ready",
        dependencyIds:
          id === "sounds" ? ["ffmpeg"]
            : id === "context-mode" ? ["npm", "bun"]
              : id === "rtk" ? ["curl"]
                : [],
        fileTouches:
          id === "plugin" ? ["~/.config/opencode/plugins/cyberpunk.ts"]
            : id === "theme" ? ["~/.config/opencode/themes/cyberpunk.json", "~/.config/opencode/themes/tui.json"]
              : id === "sounds" ? ["~/.config/opencode/sounds/*.wav"]
                : id === "context-mode" ? ["~/.config/opencode/opencode.json"]
                  : id === "rtk" ? ["~/.config/opencode/ROUTING.md"]
                    : ["Managed block in ~/.tmux.conf"],
      })),
      dependencies: [
        ...(resolved.components.includes("sounds") ? [{ id: "ffmpeg", label: "ffmpeg", requiredBy: ["sounds"], available: false, severity: "warn", message: "No disponible" }] : []),
        ...(resolved.components.includes("context-mode") ? [{ id: "npm", label: "npm", requiredBy: ["context-mode"], available: true, severity: "info", message: "Disponible" }] : []),
        ...(resolved.components.includes("rtk") ? [{ id: "curl", label: "curl", requiredBy: ["rtk"], available: false, severity: "warn", message: "No disponible" }] : []),
      ],
      warnings: resolved.warnings,
      notes: [],
    }
  )),
}))

let handleInstall: (status: any[]) => Promise<void>

describe("TUI preset install flow", () => {
  beforeAll(async () => {
    const mod = await import("../src/tui/index")
    handleInstall = mod.handleInstall
  })

  beforeEach(() => {
    selectValue = "minimal"
    confirmValue = true
    isCancelValue = false
    detectedEnvironment = "linux"
    preflightOverride = null
    runInstallCalls.length = 0
    noteCalls.length = 0
    console.log = (..._args: any[]) => {}
  })

  test("minimal preset: resolves to plugin + theme and calls runInstall", async () => {
    selectValue = "minimal"
    confirmValue = true

    const fakeStatus = [
      { id: "plugin", label: "Plugin", status: "available" },
      { id: "theme", label: "Theme", status: "available" },
    ] as any[]

    await handleInstall(fakeStatus)

    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin", "theme"])
  })

  test("manual fallback: select returns 'manual' and multiselect path is reached", async () => {
    selectValue = "manual"

    const fakeStatus = [
      { id: "plugin", label: "Plugin", status: "available" },
    ] as any[]

    await handleInstall(fakeStatus)

    expect(runInstallCalls.length).toBe(0)
  })

  test("full preset: preflight shown with dependencies and warnings before runInstall", async () => {
    selectValue = "full"
    confirmValue = true

    const fakeStatus = [
      { id: "plugin", label: "Plugin", status: "available" },
      { id: "theme", label: "Theme", status: "available" },
      { id: "sounds", label: "Sounds", status: "available" },
      { id: "context-mode", label: "Context-Mode", status: "available" },
      { id: "rtk", label: "RTK", status: "available" },
      { id: "tmux", label: "Tmux", status: "available" },
    ] as any[]

    await handleInstall(fakeStatus)

    expect(noteCalls.length).toBeGreaterThanOrEqual(2)

    const summaryNote = noteCalls[0]
    expect(summaryNote.title).toContain("Completo")

    const summaryMessage = String(summaryNote.message)
    expect(summaryMessage).toContain("Dependencias")
    expect(summaryMessage).toContain("tmux.conf")
    expect(summaryMessage).toContain("ffmpeg")

    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual([
      "plugin", "theme", "sounds", "context-mode", "rtk", "tmux",
    ])
  })

  test("wsl preset: mismatch warning is shown in confirmation note and install still proceeds", async () => {
    selectValue = "wsl"
    confirmValue = true
    detectedEnvironment = "linux"

    await handleInstall([] as any[])

    const summaryNote = noteCalls[0]
    const summaryMessage = String(summaryNote.message)

    expect(summaryNote.title).toContain("WSL")
    expect(summaryMessage).toContain("WSL")
    expect(summaryMessage).toContain("Dependencias")
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin", "theme", "sounds", "tmux"])
  })

  test("mac preset: mismatch warning is shown in confirmation note and install still proceeds", async () => {
    selectValue = "mac"
    confirmValue = true
    detectedEnvironment = "linux"

    await handleInstall([] as any[])

    const summaryNote = noteCalls[0]
    const summaryMessage = String(summaryNote.message)

    expect(summaryNote.title).toContain("macOS")
    expect(summaryMessage).toContain("macOS")
    expect(summaryMessage).toContain("Context-Mode")
    expect(summaryMessage).toContain("RTK")
    expect(summaryMessage).toContain("Dependencias")
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk"])
  })

  test("preset cancelled: confirm returns false, no install performed", async () => {
    selectValue = "full"
    confirmValue = false

    await handleInstall([] as any[])

    expect(runInstallCalls.length).toBe(0)
    expect(
      noteCalls.some(n =>
        String(n.title).includes("Cancelado") ||
        String(n.message).includes("cancelada")
      )
    ).toBe(true)
  })

  test("partial advisory disclosure stays unstated and still allows preset confirmation", async () => {
    selectValue = "full"
    confirmValue = true
    preflightOverride = {
      preset: {
        id: "full",
        label: "Completo",
        components: ["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"],
        warnings: [],
      },
      components: [
        {
          id: "plugin",
          installed: true,
          readiness: "ready",
          dependencyIds: [],
          fileTouches: ["~/.config/opencode/plugins/cyberpunk.ts"],
        },
        {
          id: "theme",
          installed: false,
          readiness: "ready",
          dependencyIds: [],
          fileTouches: [],
        },
        {
          id: "context-mode",
          installed: false,
          readiness: "ready",
          dependencyIds: [],
          fileTouches: ["~/.config/opencode/opencode.json"],
        },
      ],
      dependencies: [],
      warnings: [],
      notes: [],
    }

    await handleInstall([] as any[])

    const summaryNote = noteCalls[0]
    const summaryMessage = String(summaryNote.message)

    expect(summaryMessage).toContain("solo se muestran los detalles conocidos")
    expect(summaryMessage).toContain("~/.config/opencode/plugins/cyberpunk.ts")
    expect(summaryMessage).toContain("~/.config/opencode/opencode.json")
    expect(summaryMessage).not.toContain("~/.config/opencode/themes/cyberpunk.json")
    expect(summaryMessage).not.toContain("~/.config/opencode/themes/tui.json")
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0]).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"])
  })

  test("preset options are built from PRESET_NAMES including wsl and mac", async () => {
    const { PRESET_NAMES } = await import("../src/presets/index")

    const presetValues = PRESET_NAMES.map(p => p.value)
    expect(presetValues).toContain("minimal")
    expect(presetValues).toContain("full")
    expect(presetValues).toContain("wsl")
    expect(presetValues).toContain("mac")
  })
})
