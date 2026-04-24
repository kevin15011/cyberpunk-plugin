// tests/cli-preset-execution.test.ts
// Runtime behavioral tests for the CLI preset execution path in src/index.ts

import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test"

import { createTempHome, setDefaultConfig } from "./helpers/test-home"

let detectedEnvironment: "linux" | "wsl" | "darwin" = "linux"

const runInstallCalls: { ids: string[]; action: string }[] = []

function registerCliMocks() {
  mock.module("../src/platform/detect", () => ({
    detectEnvironment: mock(() => detectedEnvironment),
    isWSL: mock(() => detectedEnvironment === "wsl"),
  }))

  mock.module("../src/commands/install", () => ({
    runInstall: mock(async (ids: string[], action: string) => {
      runInstallCalls.push({ ids: [...ids], action })
      return ids.map(id => ({
        component: id,
        action,
        status: "success" as const,
      }))
    }),
    runUninstall: mock(async () => []),
  }))

  mock.module("../src/commands/preflight", () => ({
    buildPresetPreflight: mock(async (resolved: { id: string; label: string; components: string[]; warnings: string[] }) => ({
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
    })),
  }))
}

let mainFn: () => Promise<void>

describe("CLI preset execution path", () => {
  let fixture: ReturnType<typeof createTempHome>

  beforeAll(async () => {
    registerCliMocks()
    const mod = await import("../src/index")
    mainFn = mod.main
  })

  let origArgv: string[]
  let origExit: (code?: number) => never
  let origLog: typeof console.log
  let origError: typeof console.error
  let origHome: string | undefined
  let capturedLogs: string[]
  let capturedErrors: string[]
  let exitCode: number | null

  beforeEach(() => {
    origHome = process.env.HOME
    fixture = createTempHome("cyberpunk-cli-preset")
    setDefaultConfig(fixture.configDir)
    process.env.HOME = fixture.home
    detectedEnvironment = "linux"
    runInstallCalls.length = 0
    capturedLogs = []
    capturedErrors = []
    exitCode = null
  })

  afterEach(() => {
    mock.restore()
    if (origHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = origHome
    }
    fixture.cleanup()
  })

  function setupMocks(argv: string[]) {
    origArgv = process.argv
    origExit = process.exit
    origLog = console.log
    origError = console.error

    process.argv = argv
    process.exit = ((code?: number) => {
      exitCode = code ?? 0
      throw new Error(`EXIT:${code ?? 0}`)
    }) as any
    console.log = (...args: any[]) => capturedLogs.push(args.map(String).join(" "))
    console.error = (...args: any[]) => capturedErrors.push(args.map(String).join(" "))
  }

  function restoreMocks() {
    process.argv = origArgv
    process.exit = origExit
    console.log = origLog
    console.error = origError
  }

  test("install --preset minimal: prints preflight and forwards to runInstall", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "minimal"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    const allOutput = capturedLogs.join("\n")
    expect(allOutput).toContain("Preset: Mínimo")
    expect(allOutput).toContain("Componentes")
    expect(allOutput).toContain("Archivos")

    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0].ids).toEqual(["plugin", "theme"])
    expect(runInstallCalls[0].action).toBe("install")
  })

  test("install --preset full: prints dependency preflight and forwards all components", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "full"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    const allOutput = capturedLogs.join("\n")
    expect(allOutput).toContain("Dependencias")
    expect(allOutput).toContain("ffmpeg")
    expect(allOutput).toContain("Avisos")
    expect(allOutput).toContain("tmux.conf")

    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0].ids).toEqual([
      "plugin", "theme", "sounds", "context-mode", "rtk", "tmux",
    ])
  })

  test("install --preset unknown: prints error and exits without installing", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "nonexistent"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    expect(
      capturedErrors.some(e => e.includes("Preset desconocido") || e.includes("nonexistent"))
    ).toBe(true)
    expect(runInstallCalls.length).toBe(0)
  })

  test("install --preset wsl: prints preflight, mismatch warning, and forwards wsl components", async () => {
    detectedEnvironment = "linux"
    setupMocks(["bun", "src/index.ts", "install", "--preset", "wsl"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    const allOutput = capturedLogs.join("\n")
    expect(allOutput).toContain("WSL")
    expect(allOutput).toContain("Avisos")
    expect(allOutput).toContain("Dependencias")
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0].ids).toEqual(["plugin", "theme", "sounds", "tmux"])
  })

  test("install --preset minimal --theme: prints parse error and exits", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "minimal", "--theme"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    expect(
      capturedErrors.some(e => e.includes("--preset"))
    ).toBe(true)
    expect(runInstallCalls.length).toBe(0)
  })
})
