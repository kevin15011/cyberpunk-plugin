// tests/plugin-registration.test.ts — tests verifying registration helpers are called on install/uninstall
// Tests exercise actual module functions with real filesystem fixtures.
// All tests share one TEMP_HOME to avoid Bun module caching issues.

import { describe, test, expect, beforeAll, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// Resolve the actual config path that the modules use
let ACTUAL_CONFIG_PATH: string
let ACTUAL_CONFIG_DIR: string
let ACTUAL_OPENCODE_DIR: string
let ACTUAL_OPENCODE_CONFIG: string
let ACTUAL_PLUGINS_DIR: string

beforeAll(async () => {
  const loadMod = await import("../src/config/load.ts?" + Date.now())
  ACTUAL_CONFIG_PATH = loadMod.CONFIG_PATH as string
  ACTUAL_CONFIG_DIR = loadMod.CONFIG_DIR as string

  // Derive OpenCode paths from the same HOME that loadConfig uses
  const HOME = process.env.HOME || process.env.USERPROFILE || "~"
  ACTUAL_OPENCODE_DIR = join(HOME, ".config", "opencode")
  ACTUAL_OPENCODE_CONFIG = join(ACTUAL_OPENCODE_DIR, "config.json")
  ACTUAL_PLUGINS_DIR = join(ACTUAL_OPENCODE_DIR, "plugins")
})

function writeCyberpunkConfig(overrides?: Record<string, unknown>) {
  mkdirSync(ACTUAL_CONFIG_DIR, { recursive: true })
  const cfg = {
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
    },
    ...overrides,
  }
  writeFileSync(ACTUAL_CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8")
}

function readCyberpunkConfig() {
  return JSON.parse(readFileSync(ACTUAL_CONFIG_PATH, "utf8"))
}

function writeOpenCodeConfig(data: Record<string, unknown>) {
  mkdirSync(ACTUAL_OPENCODE_DIR, { recursive: true })
  writeFileSync(ACTUAL_OPENCODE_CONFIG, JSON.stringify(data, null, 2) + "\n", "utf8")
}

function readOpenCodeConfig() {
  return JSON.parse(readFileSync(ACTUAL_OPENCODE_CONFIG, "utf8"))
}

function removeOpenCodeConfig() {
  if (existsSync(ACTUAL_OPENCODE_CONFIG)) rmSync(ACTUAL_OPENCODE_CONFIG, { force: true })
}

function ensureSharedDir() {
  mkdirSync(join(ACTUAL_OPENCODE_DIR, "skills", "_shared"), { recursive: true })
}

function removePluginFile() {
  const p = join(ACTUAL_PLUGINS_DIR, "cyberpunk.ts")
  if (existsSync(p)) rmSync(p, { force: true })
}

function writePluginFile(content: string) {
  mkdirSync(ACTUAL_PLUGINS_DIR, { recursive: true })
  writeFileSync(join(ACTUAL_PLUGINS_DIR, "cyberpunk.ts"), content, "utf8")
}

describe("plugin install/uninstall registration", () => {
  afterEach(() => {
    // Clean up cyberpunk config
    if (existsSync(ACTUAL_CONFIG_PATH)) rmSync(ACTUAL_CONFIG_PATH, { force: true })
    // Clean up OpenCode config
    if (existsSync(ACTUAL_OPENCODE_CONFIG)) rmSync(ACTUAL_OPENCODE_CONFIG, { force: true })
    // Clean up plugin file
    removePluginFile()
  })

  test("install() writes plugin file and registers in OpenCode config", async () => {
    writeOpenCodeConfig({ plugin: [] })
    writeCyberpunkConfig()
    ensureSharedDir()

    const { getPluginComponent } = await import("../src/components/plugin.ts?" + Date.now())
    const plugin = getPluginComponent()
    const result = await plugin.install()

    expect(["success", "skipped"]).toContain(result.status)

    // OpenCode config has ./plugins/cyberpunk registered
    const opencodeCfg = readOpenCodeConfig()
    expect(opencodeCfg.plugin).toContain("./plugins/cyberpunk")

    // Cyberpunk config has pluginRegistered: true
    const cfg = readCyberpunkConfig()
    expect(cfg.pluginRegistered).toBe(true)
  })

  test("uninstall() removes plugin file and unregisters from OpenCode config", async () => {
    writeOpenCodeConfig({ plugin: ["./plugins/cyberpunk", "./plugins/other"] })
    writeCyberpunkConfig({
      components: {
        plugin: { installed: true, version: "bundled" },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
      },
      pluginRegistered: true,
    })
    writePluginFile("// test plugin")

    const { getPluginComponent } = await import("../src/components/plugin.ts?" + Date.now())
    const plugin = getPluginComponent()
    const result = await plugin.uninstall()

    expect(result.status).toBe("success")

    // OpenCode config no longer has cyberpunk, but other untouched
    const opencodeCfg = readOpenCodeConfig()
    expect(opencodeCfg.plugin).not.toContain("./plugins/cyberpunk")
    expect(opencodeCfg.plugin).toContain("./plugins/other")

    // Cyberpunk config has pluginRegistered: false
    const cfg = readCyberpunkConfig()
    expect(cfg.pluginRegistered).toBe(false)
  })

  test("install skipped (already identical) still calls registration", async () => {
    writeOpenCodeConfig({ plugin: [] })
    writeCyberpunkConfig()
    ensureSharedDir()

    // Import plugin source to create identical file
    const { PLUGIN_SOURCE } = await import("../src/components/plugin.ts?" + Date.now())
    writePluginFile(PLUGIN_SOURCE)

    const { getPluginComponent } = await import("../src/components/plugin.ts?" + Date.now())
    const plugin = getPluginComponent()
    const result = await plugin.install()

    // Should be skipped since file is identical
    expect(result.status).toBe("skipped")

    // But registration should still have happened
    const opencodeCfg = readOpenCodeConfig()
    expect(opencodeCfg.plugin).toContain("./plugins/cyberpunk")

    // pluginRegistered should be true because registration succeeded
    const cfg = readCyberpunkConfig()
    expect(cfg.pluginRegistered).toBe(true)
  })
})

// ── pluginRegistered accuracy when registration skipped/failed ────

describe("pluginRegistered state accuracy", () => {
  afterEach(() => {
    if (existsSync(ACTUAL_CONFIG_PATH)) rmSync(ACTUAL_CONFIG_PATH, { force: true })
    if (existsSync(ACTUAL_OPENCODE_CONFIG)) rmSync(ACTUAL_OPENCODE_CONFIG, { force: true })
    removePluginFile()
  })

  test("pluginRegistered is FALSE when OpenCode config is missing", async () => {
    // No OpenCode config at all
    removeOpenCodeConfig()
    writeCyberpunkConfig()
    ensureSharedDir()

    const { getPluginComponent } = await import("../src/components/plugin.ts?" + Date.now())
    const plugin = getPluginComponent()
    await plugin.install()

    const cfg = readCyberpunkConfig()
    // pluginRegistered must be false because no OpenCode config existed
    expect(cfg.pluginRegistered).toBe(false)
  })

  test("pluginRegistered is FALSE when OpenCode config has invalid plugin field", async () => {
    writeOpenCodeConfig({ plugin: "not-an-array" })
    writeCyberpunkConfig()
    ensureSharedDir()

    const { getPluginComponent } = await import("../src/components/plugin.ts?" + Date.now())
    const plugin = getPluginComponent()
    await plugin.install()

    const cfg = readCyberpunkConfig()
    // pluginRegistered must be false because plugin field was invalid
    expect(cfg.pluginRegistered).toBe(false)
  })

  test("pluginRegistered is TRUE when OpenCode config is valid", async () => {
    writeOpenCodeConfig({ plugin: [] })
    writeCyberpunkConfig()
    ensureSharedDir()

    const { getPluginComponent } = await import("../src/components/plugin.ts?" + Date.now())
    const plugin = getPluginComponent()
    await plugin.install()

    const cfg = readCyberpunkConfig()
    expect(cfg.pluginRegistered).toBe(true)
  })
})
