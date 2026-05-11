// tests/updates-manager.test.ts — update manager cache and formatting contracts

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-updates-${Date.now()}`)
const ORIGINAL_HOME = process.env.HOME

describe("update manager", () => {
  beforeEach(() => {
    rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(join(TEMP_HOME, ".config", "cyberpunk"), { recursive: true })
    process.env.HOME = TEMP_HOME
  })

  afterEach(() => {
    process.env.HOME = ORIGINAL_HOME
    rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("cache freshness honors TTL", async () => {
    const { isUpdateCacheFresh } = await import(`../src/updates/cache.ts?${Date.now()}`)
    const cache = { checkedAt: new Date(1000).toISOString(), tools: [] }
    expect(isUpdateCacheFresh(cache, 1000, 1500)).toBe(true)
    expect(isUpdateCacheFresh(cache, 1000, 2500)).toBe(false)
  })

  test("manager uses fresh cached update metadata without network checks", async () => {
    const { writeUpdateCache } = await import(`../src/updates/cache.ts?cache=${Date.now()}`)
    const { UpdateManager } = await import(`../src/updates/manager.ts?manager=${Date.now()}`)
    const cached = [{ tool: "rtk" as const, current: "1.0.0", latest: "2.0.0", available: true, checkedAt: new Date().toISOString() }]
    writeUpdateCache({ checkedAt: new Date().toISOString(), tools: cached })

    const statuses = await new UpdateManager({ ttlMs: 60_000, timeoutMs: 1 }).checkAll()

    expect(statuses).toEqual(cached)
  })

  test("network timeout is reported as non-fatal update diagnostic", async () => {
    const { checkNpmUpdate } = await import(`../src/updates/checkers.ts?${Date.now()}`)

    const status = await checkNpmUpdate("context-mode", "context-mode", 1, () => new Promise(() => {}))

    expect(status.tool).toBe("context-mode")
    expect(status.available).toBe(false)
    expect(status.error).toContain("timed out")
  })

  test("cyberpunk checker passes timeout to binary release check", async () => {
    writeFileSync(join(TEMP_HOME, ".config", "cyberpunk", "config.json"), JSON.stringify({
      version: 2,
      installMode: "binary",
      updates: { enabled: true, ttlMs: 60000, timeoutMs: 1 },
      components: {},
    }, null, 2), "utf8")
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Promise<Response>(() => {})) as typeof fetch

    try {
      const { checkToolUpdate } = await import(`../src/updates/checkers.ts?cyberpunk-timeout=${Date.now()}`)
      const status = await checkToolUpdate("cyberpunk", 1)

      expect(status.tool).toBe("cyberpunk")
      expect(status.available).toBe(false)
      expect(status.error).toMatch(/timed out/i)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("checker treats unknown current version with known latest as updateable", async () => {
    const { checkNpmUpdate } = await import(`../src/updates/checkers.ts?unknown-current=${Date.now()}`)

    const status = await checkNpmUpdate("context-mode", "missing-context-mode-command", 100, async () => ({ version: "1.0.118" }))

    expect(status.current).toBeUndefined()
    expect(status.latest).toBe("1.0.118")
    expect(status.available).toBe(true)
    expect(status.error).toBeUndefined()
  })

  test("context-mode checker parses installed version from stderr diagnostics", async () => {
    const binDir = join(TEMP_HOME, "bin")
    const commandPath = join(binDir, "context-mode")
    mkdirSync(binDir, { recursive: true })
    writeFileSync(commandPath, `#!/bin/sh
printf 'Context Mode MCP server v1.0.89 running on stdio\nDetected runtimes:\n' >&2
`, "utf8")
    chmodSync(commandPath, 0o755)
    const { checkNpmUpdate } = await import(`../src/updates/checkers.ts?stderr-version=${Date.now()}`)
    const status = await checkNpmUpdate("context-mode", commandPath, 100, async () => ({ version: "1.0.118" }))

    expect(status.current).toBe("1.0.89")
    expect(status.latest).toBe("1.0.118")
    expect(status.available).toBe(true)
  })

  test("GitHub release checker falls back to releases/latest redirect when API is rate-limited", async () => {
    const binDir = join(TEMP_HOME, "bin")
    const commandPath = join(binDir, "rtk")
    mkdirSync(binDir, { recursive: true })
    writeFileSync(commandPath, "#!/bin/sh\nprintf 'rtk 0.37.2\n'\n", "utf8")
    chmodSync(commandPath, 0o755)

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response("", {
      status: 302,
      headers: { location: "https://github.com/rtk-ai/rtk/releases/tag/v0.39.0" },
    })) as typeof fetch

    try {
      const { checkGithubReleaseUpdate } = await import(`../src/updates/checkers.ts?github-fallback=${Date.now()}`)
      const status = await checkGithubReleaseUpdate("rtk", "rtk-ai/rtk", commandPath, 100, async () => {
        throw new Error("HTTP 403")
      })

      expect(status.current).toBe("0.37.2")
      expect(status.latest).toBe("0.39.0")
      expect(status.available).toBe(true)
      expect(status.error).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("formatToolUpdateStatuses JSON is parseable and has no human banner", async () => {
    const { formatToolUpdateStatuses } = await import(`../src/cli/output.ts?${Date.now()}`)
    const out = formatToolUpdateStatuses([{ tool: "rtk", current: "1.0.0", latest: "2.0.0", available: true, checkedAt: new Date().toISOString() }], true)
    expect(() => JSON.parse(out)).not.toThrow()
    expect(out).not.toContain("Run:")
  })

  test("removeUpdateCache deletes cyberpunk update state", async () => {
    const { getUpdateCachePath, removeUpdateCache } = await import(`../src/updates/cache.ts?${Date.now()}`)
    writeFileSync(getUpdateCachePath(), JSON.stringify({ checkedAt: new Date().toISOString(), tools: [] }), "utf8")
    expect(existsSync(getUpdateCachePath())).toBe(true)
    removeUpdateCache()
    expect(existsSync(getUpdateCachePath())).toBe(false)
  })

  test("passive CLI update notices respect updates.enabled=false", async () => {
    const configPath = join(TEMP_HOME, ".config", "cyberpunk", "config.json")
    writeFileSync(configPath, JSON.stringify({
      version: 2,
      components: {},
      updates: { enabled: false, ttlMs: 60_000, timeoutMs: 1 },
    }, null, 2), "utf8")

    const { writeUpdateCache } = await import(`../src/updates/cache.ts?disabled-notice-cache=${Date.now()}`)
    writeUpdateCache({ checkedAt: new Date().toISOString(), tools: [
      { tool: "context-mode", current: "1.0.0", latest: "2.0.0", available: true, checkedAt: new Date().toISOString() },
    ] })

    const proc = Bun.spawnSync([process.execPath, "src/index.ts", "status", "--plugin"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: TEMP_HOME, NO_COLOR: "1" },
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stderr = Buffer.from(proc.stderr).toString("utf8")

    expect(proc.exitCode).toBe(0)
    expect(stderr).not.toContain("Updates available")
    expect(stderr).not.toContain("context-mode")
  })

  test("doctor exposes cached update metadata visibility", async () => {
    const { writeUpdateCache } = await import(`../src/updates/cache.ts?doctor-cache=${Date.now()}`)
    const { runDoctor } = await import(`../src/commands/doctor.ts?doctor=${Date.now()}`)
    writeUpdateCache({ checkedAt: new Date().toISOString(), tools: [
      { tool: "rtk", current: "1.0.0", latest: "2.0.0", available: true, checkedAt: new Date().toISOString() },
      { tool: "context-mode", current: "1.0.0", latest: "1.0.0", available: false, checkedAt: new Date().toISOString() },
    ] })

    const result = await runDoctor({ fix: false, verbose: false })
    const updateResult = result.results.find(r => r.component === "updates")

    expect(updateResult?.checks.find(c => c.id === "updates:cache")?.message).toContain("checked tools: rtk, context-mode")
    expect(updateResult?.checks.find(c => c.id === "updates:rtk")?.message).toContain("Update available")
  })

  test("doctor does not report cached latest-only update metadata as up to date", async () => {
    const { writeUpdateCache } = await import(`../src/updates/cache.ts?latest-only-cache=${Date.now()}`)
    const { runDoctor } = await import(`../src/commands/doctor.ts?latest-only-doctor=${Date.now()}`)
    writeUpdateCache({ checkedAt: new Date().toISOString(), tools: [
      { tool: "context-mode", latest: "1.0.118", available: true, checkedAt: new Date().toISOString() },
      { tool: "rtk", latest: "0.39.0", available: false, checkedAt: new Date().toISOString() },
    ] })

    const result = await runDoctor({ fix: false, verbose: false })
    const updateResult = result.results.find(r => r.component === "updates")

    expect(updateResult?.checks.find(c => c.id === "updates:context-mode")).toMatchObject({
      status: "warn",
      message: "Installed version unknown; latest is 1.0.118",
      fixable: true,
    })
    expect(updateResult?.checks.find(c => c.id === "updates:rtk")).toMatchObject({
      status: "warn",
      message: "Installed version unknown; latest is 0.39.0",
      fixable: true,
    })
  })

  test("uninstall command removes update cache through command path", async () => {
    const { getUpdateCachePath } = await import(`../src/updates/cache.ts?uninstall-cache=${Date.now()}`)
    writeFileSync(getUpdateCachePath(), JSON.stringify({ checkedAt: new Date().toISOString(), tools: [] }), "utf8")

    const proc = Bun.spawnSync([process.execPath, "src/index.ts", "uninstall", "--json"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: TEMP_HOME, NO_COLOR: "1" },
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(proc.exitCode).toBe(0)
    expect(existsSync(getUpdateCachePath())).toBe(false)
  })

  test("explicit CLI update action returns per-tool outcomes", () => {
    const proc = Bun.spawnSync([process.execPath, "src/index.ts", "upgrade", "--tool", "rtk", "--json"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: TEMP_HOME, NO_COLOR: "1", PATH: "" },
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = Buffer.from(proc.stdout).toString("utf8")

    expect(proc.exitCode).toBe(1)
    const parsed = JSON.parse(stdout)
    expect(parsed).toEqual([{ tool: "rtk", status: "error", message: expect.any(String) }])
  })

  test("context-mode updater reports a clear error when npm is unavailable", async () => {
    const originalPath = process.env.PATH
    process.env.PATH = ""
    try {
      const { updateTool } = await import(`../src/updates/updaters.ts?missing-npm=${Date.now()}`)
      const result = await updateTool("context-mode")

      expect(result).toEqual({
        tool: "context-mode",
        status: "error",
        message: "context-mode updater requires missing command(s): npm",
      })
    } finally {
      process.env.PATH = originalPath
    }
  })

  test("curl-based updaters report missing shell tool prerequisites before running installers", async () => {
    const originalPath = process.env.PATH
    process.env.PATH = ""
    try {
      const { updateTool } = await import(`../src/updates/updaters.ts?missing-curl-tools=${Date.now()}`)

      const rtk = await updateTool("rtk")
      const codebaseMemory = await updateTool("codebase-memory")

      expect(rtk).toEqual({
        tool: "rtk",
        status: "error",
        message: expect.stringContaining("rtk updater requires missing command(s):"),
      })
      expect(rtk.message).toContain("curl")
      expect(codebaseMemory).toEqual({
        tool: "codebase-memory",
        status: "error",
        message: expect.stringContaining("codebase-memory updater requires missing command(s):"),
      })
      expect(codebaseMemory.message).toContain("curl")
      expect(codebaseMemory.message).toContain("bash")
    } finally {
      process.env.PATH = originalPath
    }
  })
})
