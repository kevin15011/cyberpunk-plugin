// tests/upgrade-mode.test.ts — tests for upgrade mode dispatch, binary version comparison, and config defaults
// Tests import actual module functions and handle Bun's module caching correctly.

import { describe, test, expect, afterEach } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { createTempHome, importAfterHomeSet, setDefaultConfig } from "./helpers/test-home"

const CURRENT_VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version as string

type TestHome = ReturnType<typeof createTempHome>

let currentHome: TestHome | null = null

function createTestHome(prefix: string) {
  currentHome?.cleanup()
  currentHome = createTempHome(prefix)
  return currentHome
}

function writeTestConfig(overrides?: Record<string, unknown>) {
  if (!currentHome) {
    throw new Error("test home not initialized")
  }

  return setDefaultConfig(currentHome.configDir, overrides)
}

async function importLoadModule() {
  if (!currentHome) {
    throw new Error("test home not initialized")
  }

  return importAfterHomeSet<typeof import("../src/config/load")>("../../src/config/load.ts", currentHome.home)
}

async function importUpgradeModule() {
  if (!currentHome) {
    throw new Error("test home not initialized")
  }

  return importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", currentHome.home)
}

async function withHome<T>(home: string, run: () => Promise<T> | T): Promise<T> {
  const originalHome = process.env.HOME

  process.env.HOME = home
  try {
    return await run()
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
  }
}

function createBinaryTestEnv(testName: string) {
  const fixture = createTempHome(`cyberpunk-upgrade-${testName}`)
  const home = fixture.home
  const binDir = join(home, ".local", "bin")
  const binaryPath = join(binDir, "cyberpunk")

  const tempConfigPath = fixture.configPath

  mkdirSync(binDir, { recursive: true })
  setDefaultConfig(fixture.configDir, { installMode: "binary" })

  return {
    home,
    configPath: tempConfigPath,
    binaryPath,
    cleanup: fixture.cleanup,
  }
}

afterEach(() => {
  currentHome?.cleanup()
  currentHome = null
})

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
  test("missing installMode — loadConfig defaults to 'repo' in memory", async () => {
    createTestHome("cyberpunk-upgrade-default-mode")
    writeTestConfig() // no installMode
    const { loadConfig } = await importLoadModule()
    const config = await withHome(currentHome!.home, () => loadConfig())
    expect(config.installMode).toBe("repo")
  })

  test("binary installMode preserved by loadConfig", async () => {
    createTestHome("cyberpunk-upgrade-binary-mode")
    writeTestConfig({ installMode: "binary" })
    const { loadConfig } = await importLoadModule()
    const config = await withHome(currentHome!.home, () => loadConfig())
    expect(config.installMode).toBe("binary")
  })

  test("repo installMode preserved by loadConfig", async () => {
    createTestHome("cyberpunk-upgrade-repo-mode")
    writeTestConfig({ installMode: "repo" })
    const { loadConfig } = await importLoadModule()
    const config = await withHome(currentHome!.home, () => loadConfig())
    expect(config.installMode).toBe("repo")
  })

  test("defaulting does NOT write to disk", async () => {
    const fixture = createTestHome("cyberpunk-upgrade-no-disk-write")
    writeTestConfig() // no installMode
    const { loadConfig } = await importLoadModule()
    await withHome(fixture.home, () => loadConfig()) // triggers normalization

    // File on disk should still NOT have installMode
    const diskContent = JSON.parse(readFileSync(fixture.configPath, "utf8"))
    expect(diskContent.installMode).toBeUndefined()
  })

  test("setConfigValue allows setting new top-level keys", async () => {
    createTestHome("cyberpunk-upgrade-set-config")
    writeTestConfig()
    const { loadConfig } = await importLoadModule()
    const { setConfigValue } = await import("../src/config/save.ts?" + Date.now())

    const config = await withHome(currentHome!.home, () => loadConfig())
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

describe("runUpgrade dispatch by installMode", () => {
  test("binary config dispatches to binary upgrade path", async () => {
    const { home, binaryPath, configPath, cleanup } = createBinaryTestEnv("dispatch-binary")
    const originalFetch = globalThis.fetch
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
      const mod = await importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", home)
      const result = await withHome(home, () => mod.runUpgrade())

      expect(result).toMatchObject({
        status: "upgraded",
        fromVersion: CURRENT_VERSION,
        toVersion: "9.9.9",
        filesUpdated: [binaryPath],
      })
      expect(readFileSync(binaryPath, "utf8")).toBe("dispatch-binary")
      expect(JSON.parse(readFileSync(configPath, "utf8")).installMode).toBe("binary")
    } finally {
      globalThis.fetch = originalFetch
      cleanup()
    }
  })

  test("binary mode still dispatches correctly after another module cached a different HOME", async () => {
    const staleHome = join(tmpdir(), `cyberpunk-upgrade-stale-home-${Date.now()}`)
    const { home, binaryPath, cleanup } = createBinaryTestEnv("dispatch-after-stale-home")
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
      const mod = await importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", home)
      const result = await withHome(home, () => mod.runUpgrade())

      expect(result).toMatchObject({
        status: "upgraded",
        fromVersion: CURRENT_VERSION,
        toVersion: "9.9.9",
        filesUpdated: [binaryPath],
      })
      expect(readFileSync(binaryPath, "utf8")).toBe("stale-home-binary")
    } finally {
      globalThis.fetch = originalFetch
      process.env.HOME = originalHome
      rmSync(staleHome, { recursive: true, force: true })
      cleanup()
    }
  })

  test("binary mode on darwin downloads the darwin x64 release asset", async () => {
    const { home, binaryPath, cleanup } = createBinaryTestEnv("dispatch-darwin-x64")
    const originalFetch = globalThis.fetch
    const fetchCalls: string[] = []

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
        const mod = await importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", home)
        const result = await withHome(home, () => mod.runUpgrade())

        expect(result).toMatchObject({
          status: "upgraded",
          fromVersion: CURRENT_VERSION,
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
      cleanup()
    }
  })

  test("binary mode on darwin downloads the darwin arm64 release asset", async () => {
    const { home, binaryPath, cleanup } = createBinaryTestEnv("dispatch-darwin-arm64")
    const originalFetch = globalThis.fetch
    const fetchCalls: string[] = []

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
        const mod = await importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", home)
        const result = await withHome(home, () => mod.runUpgrade())

        expect(result).toMatchObject({
          status: "upgraded",
          fromVersion: CURRENT_VERSION,
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
      cleanup()
    }
  })

  test("repo config dispatches to repo upgrade path", async () => {
    const fixture = createTestHome("cyberpunk-upgrade-repo-dispatch")
    writeTestConfig({ installMode: "repo" })
    const mod = await importUpgradeModule()

    mod.__setUpgradeTestOverrides({
      getRepoDir: () => "/tmp/cyberpunk-repo",
      gitCommand: (args: string) => {
        if (args === "rev-parse HEAD") return "abc123"
        if (args === "fetch origin main") return ""
        if (args === "rev-parse origin/main") return "abc123"
        throw new Error(`unexpected git args: ${args}`)
      },
    })

    const result = await withHome(fixture.home, () => mod.runUpgrade())
    expect(result).toEqual({
      status: "up-to-date",
      fromVersion: "abc123",
      toVersion: "abc123",
    })
  })

  test("repo upgrade preserves isolated config and leaves caller config untouched", async () => {
    const fixture = createTestHome("cyberpunk-upgrade-repo-preserve")
    const repoDir = mkdtempSync(join(tmpdir(), "cyberpunk-upgrade-repo-"))
    const hostFixture = createTempHome("cyberpunk-upgrade-host")

    writeTestConfig({
      installMode: "repo",
      repoUrl: "https://fixture.example/repo",
      components: {
        plugin: { installed: true, version: "fixture-plugin" },
        theme: { installed: true, version: "fixture-theme" },
      },
    })
    setDefaultConfig(hostFixture.configDir, {
      installMode: "binary",
      repoUrl: "https://host.example/repo",
      components: {
        plugin: { installed: true, version: "host-plugin" },
      },
    })
    writeFileSync(join(repoDir, "README.md"), "before-upgrade", "utf8")

    const hostConfigBefore = readFileSync(hostFixture.configPath, "utf8")
    const mod = await importUpgradeModule()

    mod.__setUpgradeTestOverrides({
      getRepoDir: () => repoDir,
      gitCommand: (args: string) => {
        if (args === "rev-parse HEAD") return "repo-old"
        if (args === "fetch origin main") return ""
        if (args === "rev-parse origin/main") return "repo-new"
        if (args === "diff --name-only repo-old..repo-new") return "README.md"
        if (args === "pull origin main") {
          writeFileSync(join(repoDir, "README.md"), "after-upgrade", "utf8")
          return ""
        }
        throw new Error(`unexpected git args: ${args}`)
      },
    })

    process.env.HOME = hostFixture.home

    try {
      const result = await withHome(fixture.home, () => mod.runUpgrade())

      expect(result).toEqual({
        status: "upgraded",
        fromVersion: "repo-old",
        toVersion: "repo-new",
        filesUpdated: ["README.md"],
      })

      const savedFixtureConfig = JSON.parse(readFileSync(fixture.configPath, "utf8"))
      expect(savedFixtureConfig).toMatchObject({
        installMode: "repo",
        repoUrl: "https://fixture.example/repo",
        components: {
          plugin: { installed: true, version: "fixture-plugin" },
          theme: { installed: true, version: "fixture-theme" },
        },
      })
      expect(typeof savedFixtureConfig.lastUpgradeCheck).toBe("string")
      expect(readFileSync(hostFixture.configPath, "utf8")).toBe(hostConfigBefore)
      expect(readFileSync(join(repoDir, "README.md"), "utf8")).toBe("after-upgrade")
    } finally {
      mod.__resetUpgradeTestOverrides()
      delete process.env.HOME
      hostFixture.cleanup()
      rmSync(repoDir, { recursive: true, force: true })
    }
  })

  test("missing mode defaults to repo path", async () => {
    const fixture = createTestHome("cyberpunk-upgrade-default-repo-dispatch")
    writeTestConfig() // no installMode
    const mod = await importUpgradeModule()

    mod.__setUpgradeTestOverrides({
      getRepoDir: () => "/tmp/cyberpunk-repo",
      gitCommand: (args: string) => {
        if (args === "rev-parse HEAD") return "repo-current"
        if (args === "fetch origin main") return ""
        if (args === "rev-parse origin/main") return "repo-current"
        throw new Error(`unexpected git args: ${args}`)
      },
    })

    const result = await withHome(fixture.home, () => mod.runUpgrade())
    expect(result).toEqual({
      status: "up-to-date",
      fromVersion: "repo-current",
      toVersion: "repo-current",
    })
  })
})

// ── checkUpgrade dispatch ─────────────────────────────────────────

describe("checkUpgrade dispatch", () => {
  test("binary mode — checkUpgrade uses binary path", async () => {
    const fixture = createTestHome("cyberpunk-upgrade-check-binary")
    writeTestConfig({ installMode: "binary" })
    const mod = await importUpgradeModule()
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async () => new Response(JSON.stringify({ tag_name: "v9.9.9" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch

    try {
      const status = await withHome(fixture.home, () => mod.checkUpgrade())
      expect(status.latestVersion).toBe("9.9.9")
      expect(status.changedFiles).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("repo mode — checkUpgrade uses repo path", async () => {
    const fixture = createTestHome("cyberpunk-upgrade-check-repo")
    writeTestConfig({ installMode: "repo" })
    const mod = await importUpgradeModule()
    mod.__setUpgradeTestOverrides({
      getRepoDir: () => "/tmp/cyberpunk-repo",
      gitCommand: (args: string) => {
        if (args === "rev-parse HEAD") return "repo-head"
        if (args === "fetch origin main") return ""
        if (args === "rev-parse origin/main") return "repo-next"
        if (args === "diff --name-only repo-head..repo-next") return "src/index.ts\nREADME.md"
        throw new Error(`unexpected git args: ${args}`)
      },
    })

    const status = await withHome(fixture.home, () => mod.checkUpgrade())
    expect(status).toEqual({
      currentVersion: "repo-head",
      latestVersion: "repo-next",
      upToDate: false,
      changedFiles: ["src/index.ts", "README.md"],
    })
  })
})

describe("binary upgrade stale-binary protection", () => {
  test("runUpgrade replaces the binary even when release semver matches local version", async () => {
    const { home, configPath, binaryPath, cleanup } = createBinaryTestEnv("same-version-download")
    const originalFetch = globalThis.fetch
    const downloadBytes = Buffer.from("fresh-binary")
    const fetchCalls: string[] = []

    writeFileSync(binaryPath, "stale-binary", "utf8")

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: `v${CURRENT_VERSION}` }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (url.includes(`/releases/download/v${CURRENT_VERSION}/`)) {
        return new Response(downloadBytes, { status: 200 })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const mod = await importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", home)
      const result = await withHome(home, () => mod.runUpgrade())

      expect(result).toMatchObject({
        status: "upgraded",
        fromVersion: CURRENT_VERSION,
        toVersion: CURRENT_VERSION,
        filesUpdated: [binaryPath],
      })
      expect(readFileSync(binaryPath)).toEqual(downloadBytes)
      expect(fetchCalls).toHaveLength(2)

      const savedConfig = JSON.parse(readFileSync(configPath, "utf8"))
      expect(savedConfig.installMode).toBe("binary")
      expect(typeof savedConfig.lastUpgradeCheck).toBe("string")
    } finally {
      globalThis.fetch = originalFetch
      cleanup()
    }
  })

  test("binary check stays informational when semver matches", async () => {
    const { home, configPath, binaryPath, cleanup } = createBinaryTestEnv("same-version-check")
    const originalFetch = globalThis.fetch
    const beforeConfig = readFileSync(configPath, "utf8")
    const fetchCalls: string[] = []

    writeFileSync(binaryPath, "stale-binary", "utf8")

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchCalls.push(url)

      if (url.includes("/releases/latest")) {
        return new Response(JSON.stringify({ tag_name: `v${CURRENT_VERSION}` }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const mod = await importAfterHomeSet<typeof import("../src/commands/upgrade")>("../../src/commands/upgrade.ts", home)
      const status = await withHome(home, () => mod.checkBinaryUpgrade())

      expect(status).toEqual({
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        upToDate: true,
        changedFiles: [],
      })
      expect(readFileSync(binaryPath, "utf8")).toBe("stale-binary")
      expect(readFileSync(configPath, "utf8")).toBe(beforeConfig)
      expect(fetchCalls).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
      cleanup()
    }
  })
})
