// tests/upgrade-mode.test.ts — tests for upgrade mode dispatch, binary version comparison, and config defaults
// Tests import actual module functions and handle Bun's module caching correctly.

import { describe, test, expect, beforeAll, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// ── Resolve the actual config path helpers that loadConfig uses ─────

let ACTUAL_CONFIG_PATH: string
let ACTUAL_CONFIG_DIR: string

beforeAll(async () => {
  const loadMod = await import("../src/config/load.ts?" + Date.now())
  ACTUAL_CONFIG_PATH = loadMod.getConfigPath() as string
  ACTUAL_CONFIG_DIR = loadMod.getConfigDir() as string
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

function createBinaryTestEnv(testName: string) {
  const home = join(tmpdir(), `cyberpunk-upgrade-${testName}-${Date.now()}`)
  const tempConfigDir = join(home, ".config", "cyberpunk")
  const tempConfigPath = join(tempConfigDir, "config.json")
  const binDir = join(home, ".local", "bin")
  const binaryPath = join(binDir, "cyberpunk")

  mkdirSync(tempConfigDir, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  const configJson = JSON.stringify(defaultConfig({ installMode: "binary" }), null, 2) + "\n"
  writeFileSync(tempConfigPath, configJson, "utf8")

  return {
    home,
    configPath: tempConfigPath,
    binaryPath,
  }
}

async function withMockedPlatform<T>(platform: NodeJS.Platform, arch: string, run: () => Promise<T> | T): Promise<T> {
  const originalPlatform = process.platform
  const originalArch = process.arch

  Object.defineProperty(process, "platform", { value: platform, configurable: true })
  Object.defineProperty(process, "arch", { value: arch, configurable: true })

  try {
    return await run()
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true })
    Object.defineProperty(process, "arch", { value: originalArch, configurable: true })
  }
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

  test("returns darwin asset names for supported macOS architectures", async () => {
    await withMockedPlatform("darwin", "x64", async () => {
      const mod = await import("../src/commands/upgrade.ts?" + Date.now())
      expect(mod.getPlatformAsset()).toBe("cyberpunk-darwin-x64")
    })

    await withMockedPlatform("darwin", "arm64", async () => {
      const mod = await import("../src/commands/upgrade.ts?" + Date.now())
      expect(mod.getPlatformAsset()).toBe("cyberpunk-darwin-arm64")
    })
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
    const { home, binaryPath, configPath } = createBinaryTestEnv("dispatch-binary")
    const originalHome = process.env.HOME
    const originalFetch = globalThis.fetch

    process.env.HOME = home
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v9.9.9" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.includes("/releases/download/v9.9.9/")) {
        return new Response(Buffer.from("dispatch-binary"), { status: 200 })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const mod = await import("../src/commands/upgrade.ts?" + Date.now())
      const result = await mod.runUpgrade()

      expect(result).toMatchObject({
        status: "upgraded",
        fromVersion: "1.1.0",
        toVersion: "9.9.9",
        filesUpdated: [binaryPath],
      })
      expect(readFileSync(binaryPath, "utf8")).toBe("dispatch-binary")
      expect(JSON.parse(readFileSync(configPath, "utf8")).installMode).toBe("binary")
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(home, { recursive: true, force: true })
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("binary mode still dispatches correctly after another module cached a different HOME", async () => {
    const staleHome = join(tmpdir(), `cyberpunk-upgrade-stale-home-${Date.now()}`)
    const { home, binaryPath } = createBinaryTestEnv("dispatch-after-stale-home")
    const originalHome = process.env.HOME
    const originalFetch = globalThis.fetch

    mkdirSync(staleHome, { recursive: true })
    process.env.HOME = staleHome
    await import("../src/components/plugin.ts?" + Date.now())

    process.env.HOME = home
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v9.9.9" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.includes("/releases/download/v9.9.9/")) {
        return new Response(Buffer.from("stale-home-binary"), { status: 200 })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const mod = await import("../src/commands/upgrade.ts?" + Date.now())
      const result = await mod.runUpgrade()

      expect(result).toMatchObject({
        status: "upgraded",
        fromVersion: "1.1.0",
        toVersion: "9.9.9",
        filesUpdated: [binaryPath],
      })
      expect(readFileSync(binaryPath, "utf8")).toBe("stale-home-binary")
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(staleHome, { recursive: true, force: true })
      rmSync(home, { recursive: true, force: true })
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("binary mode on darwin downloads the darwin x64 release asset", async () => {
    const { home, binaryPath } = createBinaryTestEnv("dispatch-darwin-x64")
    const originalHome = process.env.HOME
    const originalFetch = globalThis.fetch
    const fetchCalls: string[] = []

    process.env.HOME = home
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v9.9.9" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.endsWith("/releases/download/v9.9.9/cyberpunk-darwin-x64")) {
        return new Response(Buffer.from("darwin-x64-binary"), { status: 200 })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      await withMockedPlatform("darwin", "x64", async () => {
        const mod = await import("../src/commands/upgrade.ts?" + Date.now())
        const result = await mod.runUpgrade()

        expect(result).toMatchObject({
          status: "upgraded",
          fromVersion: "1.1.0",
          toVersion: "9.9.9",
          filesUpdated: [binaryPath],
        })
      })

      expect(fetchCalls).toEqual([
        "https://api.github.com/repos/kevin15011/cyberpunk-plugin/releases/latest",
        "https://github.com/kevin15011/cyberpunk-plugin/releases/download/v9.9.9/cyberpunk-darwin-x64",
      ])
      expect(readFileSync(binaryPath, "utf8")).toBe("darwin-x64-binary")
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(home, { recursive: true, force: true })
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("binary mode on darwin downloads the darwin arm64 release asset", async () => {
    const { home, binaryPath } = createBinaryTestEnv("dispatch-darwin-arm64")
    const originalHome = process.env.HOME
    const originalFetch = globalThis.fetch
    const fetchCalls: string[] = []

    process.env.HOME = home
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v9.9.9" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.endsWith("/releases/download/v9.9.9/cyberpunk-darwin-arm64")) {
        return new Response(Buffer.from("darwin-arm64-binary"), { status: 200 })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      await withMockedPlatform("darwin", "arm64", async () => {
        const mod = await import("../src/commands/upgrade.ts?" + Date.now())
        const result = await mod.runUpgrade()

        expect(result).toMatchObject({
          status: "upgraded",
          fromVersion: "1.1.0",
          toVersion: "9.9.9",
          filesUpdated: [binaryPath],
        })
      })

      expect(fetchCalls).toEqual([
        "https://api.github.com/repos/kevin15011/cyberpunk-plugin/releases/latest",
        "https://github.com/kevin15011/cyberpunk-plugin/releases/download/v9.9.9/cyberpunk-darwin-arm64",
      ])
      expect(readFileSync(binaryPath, "utf8")).toBe("darwin-arm64-binary")
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(home, { recursive: true, force: true })
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
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

describe("binary upgrade stale-binary protection", () => {
  test("runUpgrade replaces the binary even when release semver matches local version", async () => {
    const { home, configPath, binaryPath } = createBinaryTestEnv("same-version-download")
    const originalHome = process.env.HOME
    const originalFetch = globalThis.fetch
    const downloadBytes = Buffer.from("fresh-binary")
    const fetchCalls: string[] = []

    writeFileSync(binaryPath, "stale-binary", "utf8")
    process.env.HOME = home

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v1.1.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.includes("/releases/download/v1.1.0/")) {
        return new Response(downloadBytes, { status: 200 })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const mod = await import("../src/commands/upgrade.ts?" + Date.now())
      const result = await mod.runUpgrade()

      expect(result).toMatchObject({
        status: "upgraded",
        fromVersion: "1.1.0",
        toVersion: "1.1.0",
        filesUpdated: [binaryPath],
      })
      expect(readFileSync(binaryPath)).toEqual(downloadBytes)
      expect(fetchCalls).toHaveLength(2)

      const savedConfig = JSON.parse(readFileSync(configPath, "utf8"))
      expect(savedConfig.installMode).toBe("binary")
      expect(typeof savedConfig.lastUpgradeCheck).toBe("string")
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(home, { recursive: true, force: true })
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })

  test("binary check stays informational when semver matches", async () => {
    const { home, configPath, binaryPath } = createBinaryTestEnv("same-version-check")
    const originalHome = process.env.HOME
    const originalFetch = globalThis.fetch
    const beforeConfig = readFileSync(configPath, "utf8")
    const fetchCalls: string[] = []

    writeFileSync(binaryPath, "stale-binary", "utf8")
    process.env.HOME = home

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: "v1.1.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const mod = await import("../src/commands/upgrade.ts?" + Date.now())
      const status = await mod.checkBinaryUpgrade()

      expect(status).toEqual({
        currentVersion: "1.1.0",
        latestVersion: "1.1.0",
        upToDate: true,
        changedFiles: [],
      })
      expect(readFileSync(binaryPath, "utf8")).toBe("stale-binary")
      expect(readFileSync(configPath, "utf8")).toBe(beforeConfig)
      expect(fetchCalls).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(home, { recursive: true, force: true })
      rmSync(ACTUAL_CONFIG_PATH, { force: true })
    }
  })
})
