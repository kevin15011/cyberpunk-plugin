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

  test("install --preset minimal: prints summary and forwards to runInstall", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "minimal"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    const allOutput = capturedLogs.join("\n")
    expect(
      allOutput.includes("Mínimo") ||
      allOutput.includes("Plugin de OpenCode") ||
      allOutput.includes("Componentes")
    ).toBe(true)

    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0].ids).toEqual(["plugin", "theme"])
    expect(runInstallCalls[0].action).toBe("install")
  })

  test("install --preset full: prints warnings and forwards all components", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "full"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    const allOutput = capturedLogs.join("\n")
    expect(
      allOutput.includes("tmux.conf") ||
      allOutput.includes("ffmpeg") ||
      allOutput.includes("Avisos")
    ).toBe(true)

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

  test("install --preset wsl: prints summary, mismatch warning, and forwards wsl components", async () => {
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
