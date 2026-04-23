// tests/cli-preset-execution.test.ts
// Runtime behavioral tests for the CLI preset execution path in src/index.ts
//
// Addresses verify blocker: no runtime test proving src/index.ts prints
// formatPresetSummary() and forwards resolved preset components into runInstall().
//
// Strategy: Mock runInstall and ensureConfigExists at the module level,
// then call main() with mocked process.argv to exercise the exact code path.

import { describe, test, expect, mock, beforeAll, beforeEach } from "bun:test"

// --- Captured call data ---
const runInstallCalls: { ids: string[]; action: string }[] = []

// --- Mock ../src/commands/install to intercept runInstall calls ---
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

// --- Mock ../src/config/load to avoid filesystem side effects ---
mock.module("../src/config/load", () => ({
  ensureConfigExists: mock(() => false),
  loadConfig: mock(() => ({
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
      rtk: { installed: false },
      tmux: { installed: false },
    },
    installMode: "repo",
  })),
  getConfigDir: mock(() => "/tmp/test-cyberpunk"),
  getConfigPath: mock(() => "/tmp/test-cyberpunk/config.json"),
  readConfigRaw: mock(() => ({
    parsed: null,
    raw: "",
    path: "/tmp/test-cyberpunk/config.json",
    error: "mocked",
  })),
}))

// --- Mock ../src/config/save to avoid filesystem writes ---
mock.module("../src/config/save", () => ({
  saveConfig: mock(() => {}),
  setConfigValue: mock(() => true),
  getConfigValue: mock(() => ({ found: false, value: undefined })),
}))

// --- Dynamic import AFTER mocks are registered ---
let mainFn: () => Promise<void>

describe("CLI preset execution path", () => {
  beforeAll(async () => {
    const mod = await import("../src/index")
    mainFn = mod.main
  })

  let origArgv: string[]
  let origExit: (code?: number) => never
  let origLog: typeof console.log
  let origError: typeof console.error
  let capturedLogs: string[]
  let capturedErrors: string[]
  let exitCode: number | null

  beforeEach(() => {
    runInstallCalls.length = 0
    capturedLogs = []
    capturedErrors = []
    exitCode = null
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

  // -------------------------------------------------------
  // Scenario: Install minimal preset from CLI
  //   GIVEN the user runs `cyberpunk install --preset minimal`
  //   THEN formatPresetSummary is printed and runInstall
  //       receives [plugin, theme]
  // -------------------------------------------------------
  test("install --preset minimal: prints summary and forwards to runInstall", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "minimal"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    // Verify: preset summary was printed (contains preset label or component names)
    const allOutput = capturedLogs.join("\n")
    expect(
      allOutput.includes("Mínimo") ||
      allOutput.includes("Plugin de OpenCode") ||
      allOutput.includes("Componentes")
    ).toBe(true)

    // Verify: runInstall received the minimal preset components
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0].ids).toEqual(["plugin", "theme"])
    expect(runInstallCalls[0].action).toBe("install")
  })

  // -------------------------------------------------------
  // Scenario: Install full preset from CLI
  //   GIVEN the user runs `cyberpunk install --preset full`
  //   THEN formatPresetSummary prints warnings and runInstall
  //       receives all 6 components
  // -------------------------------------------------------
  test("install --preset full: prints warnings and forwards all components", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "full"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    // Verify: preset summary with warnings was printed
    const allOutput = capturedLogs.join("\n")
    expect(
      allOutput.includes("tmux.conf") ||
      allOutput.includes("ffmpeg") ||
      allOutput.includes("Avisos")
    ).toBe(true)

    // Verify: runInstall received all 6 components
    expect(runInstallCalls.length).toBe(1)
    expect(runInstallCalls[0].ids).toEqual([
      "plugin", "theme", "sounds", "context-mode", "rtk", "tmux",
    ])
  })

  // -------------------------------------------------------
  // Scenario: Unknown preset name reports error
  // -------------------------------------------------------
  test("install --preset unknown: prints error and exits without installing", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "nonexistent"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    // Verify: error message was printed
    expect(
      capturedErrors.some(e => e.includes("Preset desconocido") || e.includes("nonexistent"))
    ).toBe(true)

    // Verify: runInstall was NOT called
    expect(runInstallCalls.length).toBe(0)
  })

  // -------------------------------------------------------
  // Scenario: Deferred preset name reports slice-1 message
  // -------------------------------------------------------
  test("install --preset wsl: prints deferred preset error", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "wsl"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    // Verify: deferred preset error was printed
    expect(
      capturedErrors.some(e => e.includes("no está disponible"))
    ).toBe(true)

    // Verify: runInstall was NOT called
    expect(runInstallCalls.length).toBe(0)
  })

  // -------------------------------------------------------
  // Scenario: Mutual exclusion (preset + component flag)
  // -------------------------------------------------------
  test("install --preset minimal --theme: prints parse error and exits", async () => {
    setupMocks(["bun", "src/index.ts", "install", "--preset", "minimal", "--theme"])

    try {
      await mainFn()
    } catch (e: any) {
      expect(e.message).toMatch(/^EXIT:/)
    }

    restoreMocks()

    // Verify: parse error about mutual exclusion was printed
    expect(
      capturedErrors.some(e => e.includes("--preset"))
    ).toBe(true)

    // Verify: runInstall was NOT called
    expect(runInstallCalls.length).toBe(0)
  })
})
