// tests/tui-adapter-payload.test.ts
// Strengthened adapter tests: stub runDoctor/checkUpgrade/runUpgrade and verify
// actual payload behavior — not just export signatures.

import { describe, expect, mock, test, beforeEach, afterEach } from "bun:test"
import type { DoctorRunResult, DoctorCheck, DoctorFixResult } from "../src/components/types"
import type { UpgradeStatus, UpgradeResult } from "../src/commands/upgrade"
import type { ComponentId, InstallResult } from "../src/components/types"

// Shared test data
const MOCK_CHECKS: DoctorCheck[] = [
  { id: "plugin:patch", label: "Plugin patch", status: "pass", message: "OK", fixable: false },
  { id: "theme:files", label: "Theme files", status: "fail", message: "missing files", fixable: true },
]

const MOCK_DOCTOR_RESULT: DoctorRunResult = {
  checks: MOCK_CHECKS,
  results: [
    { component: "plugin", checks: [MOCK_CHECKS[0]] },
    { component: "theme", checks: [MOCK_CHECKS[1]] },
  ],
  fixes: [],
  summary: { healthy: 1, warnings: 0, failures: 1, fixed: 0, remainingFailures: 1 },
}

const MOCK_DOCTOR_FIX_RESULT: DoctorRunResult = {
  checks: MOCK_CHECKS,
  results: [
    { component: "plugin", checks: [MOCK_CHECKS[0]] },
    { component: "theme", checks: [MOCK_CHECKS[1]] },
  ],
  fixes: [
    { checkId: "theme:files", status: "fixed", message: "Theme files restored" },
  ],
  summary: { healthy: 1, warnings: 0, failures: 0, fixed: 1, remainingFailures: 0 },
}

const MOCK_UPGRADE_STATUS: UpgradeStatus = {
  currentVersion: "1.0.0",
  latestVersion: "2.0.0",
  upToDate: false,
  changedFiles: ["src/tui/screens/upgrade.ts", "package.json"],
}

const MOCK_UPGRADE_RESULT: UpgradeResult = {
  status: "upgraded",
  fromVersion: "1.0.0",
  toVersion: "2.0.0",
  filesUpdated: ["src/tui/screens/upgrade.ts", "package.json"],
}

describe("adapter payload: loadDoctorSummary", () => {
  let capturedArgs: { fix: boolean; verbose: boolean }[] = []

  beforeEach(() => {
    capturedArgs = []
    mock.module("../src/commands/doctor", () => ({
      runDoctor: async (opts: { fix: boolean; verbose: boolean }) => {
        capturedArgs.push({ fix: opts.fix, verbose: opts.verbose })
        return MOCK_DOCTOR_RESULT
      },
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test("calls runDoctor with fix=false and verbose=false", async () => {
    const { loadDoctorSummary } = await import("../src/tui/adapters")
    const result = await loadDoctorSummary()

    expect(capturedArgs).toEqual([{ fix: false, verbose: false }])
    expect(result.checks).toHaveLength(2)
    expect(result.summary.healthy).toBe(1)
    expect(result.summary.failures).toBe(1)
  })

  test("returns the full DoctorRunResult payload from runDoctor", async () => {
    const { loadDoctorSummary } = await import("../src/tui/adapters")
    const result = await loadDoctorSummary()

    expect(result).toEqual(MOCK_DOCTOR_RESULT)
    expect(result.results).toHaveLength(2)
    expect(result.fixes).toHaveLength(0)
  })
})

describe("adapter payload: startDoctorFixTask", () => {
  let capturedArgs: { fix: boolean; verbose: boolean }[] = []

  beforeEach(() => {
    capturedArgs = []
    mock.module("../src/commands/doctor", () => ({
      runDoctor: async (opts: { fix: boolean; verbose: boolean }) => {
        capturedArgs.push({ fix: opts.fix, verbose: opts.verbose })
        return MOCK_DOCTOR_FIX_RESULT
      },
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test("calls runDoctor with fix=true and verbose=false", async () => {
    const { startDoctorFixTask } = await import("../src/tui/adapters")
    const result = await startDoctorFixTask()

    expect(capturedArgs).toEqual([{ fix: true, verbose: false }])
  })

  test("returns fix results with status=fixed and correct checkId", async () => {
    const { startDoctorFixTask } = await import("../src/tui/adapters")
    const result = await startDoctorFixTask()

    expect(result.fixes).toHaveLength(1)
    expect(result.fixes[0].checkId).toBe("theme:files")
    expect(result.fixes[0].status).toBe("fixed")
    expect(result.summary.fixed).toBe(1)
    expect(result.summary.remainingFailures).toBe(0)
  })
})

describe("adapter payload: loadUpgradeStatus", () => {
  let checkUpgradeCalled = false

  beforeEach(() => {
    checkUpgradeCalled = false
    mock.module("../src/commands/upgrade", () => ({
      checkUpgrade: async () => {
        checkUpgradeCalled = true
        return MOCK_UPGRADE_STATUS
      },
      runUpgrade: async () => MOCK_UPGRADE_RESULT,
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test("calls checkUpgrade and returns its payload", async () => {
    const { loadUpgradeStatus } = await import("../src/tui/adapters")
    const result = await loadUpgradeStatus()

    expect(checkUpgradeCalled).toBe(true)
    expect(result).toEqual(MOCK_UPGRADE_STATUS)
    expect(result.currentVersion).toBe("1.0.0")
    expect(result.latestVersion).toBe("2.0.0")
    expect(result.upToDate).toBe(false)
    expect(result.changedFiles).toHaveLength(2)
  })

  test("returns up-to-date status when versions match", async () => {
    mock.module("../src/commands/upgrade", () => ({
      checkUpgrade: async () => ({
        currentVersion: "1.0.0",
        latestVersion: "1.0.0",
        upToDate: true,
        changedFiles: [],
      }),
      runUpgrade: async () => MOCK_UPGRADE_RESULT,
    }))

    const { loadUpgradeStatus } = await import("../src/tui/adapters")
    const result = await loadUpgradeStatus()

    expect(result.upToDate).toBe(true)
    expect(result.changedFiles).toHaveLength(0)
  })
})

describe("adapter payload: startUpgradeTask", () => {
  let runUpgradeCalled = false

  beforeEach(() => {
    runUpgradeCalled = false
    mock.module("../src/commands/upgrade", () => ({
      checkUpgrade: async () => MOCK_UPGRADE_STATUS,
      runUpgrade: async () => {
        runUpgradeCalled = true
        return MOCK_UPGRADE_RESULT
      },
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test("calls runUpgrade and returns its payload", async () => {
    const { startUpgradeTask } = await import("../src/tui/adapters")
    const result = await startUpgradeTask()

    expect(runUpgradeCalled).toBe(true)
    expect(result).toEqual(MOCK_UPGRADE_RESULT)
    expect(result.status).toBe("upgraded")
    expect(result.fromVersion).toBe("1.0.0")
    expect(result.toVersion).toBe("2.0.0")
  })

  test("returns error status when upgrade fails", async () => {
    mock.module("../src/commands/upgrade", () => ({
      checkUpgrade: async () => MOCK_UPGRADE_STATUS,
      runUpgrade: async () => ({
        status: "error",
        error: "Connection timeout",
      }),
    }))

    const { startUpgradeTask } = await import("../src/tui/adapters")
    const result = await startUpgradeTask()

    expect(result.status).toBe("error")
    expect(result.error).toBe("Connection timeout")
  })
})

describe("adapter payload: startInstallTask with hooks", () => {
  let capturedInstallArgs: { ids: ComponentId[]; action: string }[] = []

  beforeEach(() => {
    capturedInstallArgs = []
    mock.module("../src/commands/install", () => ({
      runInstall: async (ids: ComponentId[], action: string, options?: any) => {
        const hooks = options?.hooks
        capturedInstallArgs.push({ ids: [...ids], action })
        // Simulate hook callbacks
        if (hooks) {
          for (const id of ids) {
            hooks.onComponentStart?.(id)
            hooks.onComponentFinish?.({ component: id, action, status: "success" })
          }
        }
        return ids.map(id => ({ component: id, action, status: "success" as const }))
      },
    }))
    mock.module("../src/commands/status", () => ({
      collectStatus: async () => [],
      buildEnvironmentStatus: (platform: any, agents: any) => ({ platform, agents }),
    }))
    mock.module("../src/commands/doctor", () => ({
      runDoctor: async () => MOCK_DOCTOR_RESULT,
    }))
    mock.module("../src/commands/upgrade", () => ({
      checkUpgrade: async () => MOCK_UPGRADE_STATUS,
      runUpgrade: async () => MOCK_UPGRADE_RESULT,
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test("startInstallTask forwards componentIds and action to runInstall", async () => {
    const { startInstallTask } = await import("../src/tui/adapters")
    const results = await startInstallTask(["plugin", "theme"] as ComponentId[])

    expect(capturedInstallArgs).toEqual([{ ids: ["plugin", "theme"], action: "install" }])
    expect(results).toHaveLength(2)
    expect(results[0].component).toBe("plugin")
    expect(results[1].component).toBe("theme")
    expect(results.every(r => r.status === "success")).toBe(true)
  })

  test("startInstallTask hooks receive correct component IDs", async () => {
    const { startInstallTask } = await import("../src/tui/adapters")
    const started: ComponentId[] = []
    const finished: ComponentId[] = []

    const results = await startInstallTask(
      ["plugin", "theme"] as ComponentId[],
      {
        onComponentStart: (id) => started.push(id),
        onComponentFinish: (r) => finished.push(r.component),
      }
    )

    expect(started).toEqual(["plugin", "theme"])
    expect(finished).toEqual(["plugin", "theme"])
  })

  test("startUninstallTask forwards with action=uninstall", async () => {
    const { startUninstallTask } = await import("../src/tui/adapters")
    const results = await startUninstallTask(["plugin"] as ComponentId[])

    expect(capturedInstallArgs).toEqual([{ ids: ["plugin"], action: "uninstall" }])
  })
})
