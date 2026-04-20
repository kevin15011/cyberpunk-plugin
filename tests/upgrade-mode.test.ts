// tests/upgrade-mode.test.ts — tests for upgrade mode dispatch, binary version comparison, and config defaults
// Tests import actual module functions and handle Bun's module caching correctly.

import { describe, test, expect, beforeAll, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// ── Resolve the actual config path that loadConfig uses ────────────
// Bun caches module-level constants after first import. We import once
// to discover the real CONFIG_PATH and use it for all test setups.

let ACTUAL_CONFIG_PATH: string
let ACTUAL_CONFIG_DIR: string

beforeAll(async () => {
  const loadMod = await import("../src/config/load.ts?" + Date.now())
  ACTUAL_CONFIG_PATH = loadMod.CONFIG_PATH as string
  ACTUAL_CONFIG_DIR = loadMod.CONFIG_DIR as string
})

function defaultConfig(overrides?: Record<string, unknown>) {
  return {
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
    },
    ...overrides,
  }
}

function writeTestConfig(overrides?: Record<string, unknown>) {
  mkdirSync(ACTUAL_CONFIG_DIR, { recursive: true })
  writeFileSync(ACTUAL_CONFIG_PATH, JSON.stringify(defaultConfig(overrides), null, 2) + "\n", "utf8")
}

// ── Actual module function tests for compareSemver and helpers ────

describe("compareSemver (from upgrade module)", () => {
  test("equal versions return 0", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    expect(mod.compareSemver("1.0.0", "1.0.0")).toBe(0)
    expect(mod.compareSemver("1.1.0", "1.1.0")).toBe(0)
  })

  test("a < b returns -1", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    expect(mod.compareSemver("1.0.0", "1.1.0")).toBe(-1)
    expect(mod.compareSemver("1.0.0", "2.0.0")).toBe(-1)
    expect(mod.compareSemver("1.0.1", "1.0.2")).toBe(-1)
  })

  test("a > b returns 1", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    expect(mod.compareSemver("1.1.0", "1.0.0")).toBe(1)
    expect(mod.compareSemver("2.0.0", "1.0.0")).toBe(1)
  })

  test("v-prefix stripped", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    expect(mod.compareSemver("v1.0.0", "1.0.0")).toBe(0)
    expect(mod.compareSemver("1.0.0", "v1.0.0")).toBe(0)
    expect(mod.compareSemver("v1.1.0", "v1.0.0")).toBe(1)
  })

  test("up-to-date short-circuit: current >= latest means up-to-date", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    expect(mod.compareSemver("1.1.0", "1.0.0") >= 0).toBe(true)
    expect(mod.compareSemver("1.0.0", "1.0.0") >= 0).toBe(true)
    expect(mod.compareSemver("0.9.0", "1.0.0") >= 0).toBe(false)
  })
})

// ── Platform asset detection (actual module) ──────────────────────

describe("getPlatformAsset (from upgrade module)", () => {
  test("returns expected format matching cyberpunk-{os}-{arch}", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    const asset = mod.getPlatformAsset()
    expect(asset).toMatch(/^cyberpunk-(linux|darwin)-(x64|arm64)$/)
  })

  test("matches current platform", async () => {
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())
    const asset = mod.getPlatformAsset()
    const expectedOs = process.platform === "darwin" ? "darwin" : "linux"
    expect(asset).toContain(expectedOs)
  })
})

// ── Install mode default tests via real loadConfig ────────────────

describe("installMode default behavior via loadConfig", () => {
  afterEach(() => {
    // Clean up our test config without deleting the whole config dir
    if (existsSync(ACTUAL_CONFIG_PATH)) {
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("missing installMode — loadConfig defaults to 'repo' in memory", async () => {
    writeTestConfig() // no installMode
    const { loadConfig } = await import("../src/config/load.ts?" + Date.now())
    const config = loadConfig()
    expect(config.installMode).toBe("repo")
  })

  test("binary installMode preserved by loadConfig", async () => {
    writeTestConfig({ installMode: "binary" })
    const { loadConfig } = await import("../src/config/load.ts?" + Date.now())
    const config = loadConfig()
    expect(config.installMode).toBe("binary")
  })

  test("repo installMode preserved by loadConfig", async () => {
    writeTestConfig({ installMode: "repo" })
    const { loadConfig } = await import("../src/config/load.ts?" + Date.now())
    const config = loadConfig()
    expect(config.installMode).toBe("repo")
  })

  test("defaulting does NOT write to disk", async () => {
    writeTestConfig() // no installMode
    const { loadConfig } = await import("../src/config/load.ts?" + Date.now())
    loadConfig() // triggers normalization

    // File on disk should still NOT have installMode
    const diskContent = JSON.parse(readFileSync(ACTUAL_CONFIG_PATH, "utf8"))
    expect(diskContent.installMode).toBeUndefined()
  })

  test("setConfigValue allows setting new top-level keys", async () => {
    writeTestConfig()
    const { loadConfig } = await import("../src/config/load.ts?" + Date.now())
    const { setConfigValue } = await import("../src/config/save.ts?" + Date.now())

    const config = loadConfig()
    // installMode doesn't exist in default config — should be settable now
    const ok = setConfigValue(config, "installMode", '"binary"')
    expect(ok).toBe(true)
    expect(config.installMode).toBe("binary")
  })

  test("setConfigValue rejects keys on null parents", async () => {
    const { setConfigValue } = await import("../src/config/save.ts?" + Date.now())
    const config: any = { components: null }
    const ok = setConfigValue(config, "components.plugin.installed", "true")
    expect(ok).toBe(false)
  })
})

// ── Upgrade dispatch via runUpgrade ───────────────────────────────
// We write config to ACTUAL_CONFIG_PATH so loadConfig reads the right mode.

describe("runUpgrade dispatch by installMode", () => {
  afterEach(() => {
    if (existsSync(ACTUAL_CONFIG_PATH)) {
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("binary config dispatches to binary upgrade path", async () => {
    writeTestConfig({ installMode: "binary" })
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())

    const result = await mod.runUpgrade()
    expect(["error", "up-to-date", "upgraded"]).toContain(result.status)

    // Verify it took the BINARY path: fromVersion should be semver (not git SHA)
    if (result.status === "up-to-date" || result.status === "upgraded") {
      // Binary path uses semver versions (e.g. "1.1.0"), not 40-char git SHAs
      expect(result.fromVersion).toMatch(/^\d+\.\d+\.\d+$/)
    }
    // Error should NOT mention git repo (that would mean wrong path was taken)
    if (result.error) {
      expect(result.error).not.toMatch(/repositorio|directorio/i)
    }
  })

  test("repo config dispatches to repo upgrade path", async () => {
    writeTestConfig({ installMode: "repo" })
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())

    const result = await mod.runUpgrade()
    // Since cwd IS a git repo, repo path will succeed.
    // Verify it took the repo path by checking fromVersion is a git SHA (40 hex chars)
    expect(result.status).toBe("up-to-date")
    expect(result.fromVersion).toMatch(/^[0-9a-f]{40}$/) // git SHA
    expect(result.toVersion).toMatch(/^[0-9a-f]{40}$/)
  })

  test("missing mode defaults to repo path", async () => {
    writeTestConfig() // no installMode
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())

    // Should default to repo — same behavior as explicit repo config
    const result = await mod.runUpgrade()
    expect(result.status).toBe("up-to-date")
    expect(result.fromVersion).toMatch(/^[0-9a-f]{40}$/) // git SHA = repo path
  })
})

// ── checkUpgrade dispatch ─────────────────────────────────────────

describe("checkUpgrade dispatch", () => {
  afterEach(() => {
    if (existsSync(ACTUAL_CONFIG_PATH)) {
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("binary mode — checkUpgrade uses binary path", async () => {
    writeTestConfig({ installMode: "binary" })
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())

    // Binary path will try GitHub API — either succeeds or fails with API error
    try {
      const status = await mod.checkUpgrade()
      // If it succeeds, it should have version info
      expect(status).toHaveProperty("currentVersion")
      expect(status).toHaveProperty("latestVersion")
    } catch (err) {
      // API failure is expected — proves binary path was taken
      expect(err instanceof Error ? err.message : String(err)).toMatch(/GitHub API|fetch|release|tag_name/i)
    }
  })

  test("repo mode — checkUpgrade uses repo path", async () => {
    writeTestConfig({ installMode: "repo" })
    const mod = await import("../src/commands/upgrade.ts?" + Date.now())

    // Repo path will succeed since cwd IS a git repo
    const status = await mod.checkUpgrade()
    expect(status).toHaveProperty("currentVersion")
    expect(status).toHaveProperty("latestVersion")
    // Repo path versions are git SHAs (40 hex chars)
    expect(status.currentVersion).toMatch(/^[0-9a-f]{40}$/)
  })
})
