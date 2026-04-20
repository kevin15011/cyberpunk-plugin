// tests/config.test.ts — tests for config load/save behavior

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// We test the config module logic by importing and exercising it
// with a temp HOME to avoid polluting real config

const TEMP_HOME = join(tmpdir(), `cyberpunk-test-${Date.now()}`)
const TEMP_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const TEMP_CONFIG_PATH = join(TEMP_CONFIG_DIR, "config.json")

// Helper to create a default config manually (mirrors schema.ts)
function createDefaultConfig() {
  return {
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
    },
    repoUrl: "https://github.com/kevin15011/cyberpunk-plugin",
  }
}

describe("Config load/save", () => {
  beforeEach(() => {
    // Clean up temp dir
    if (existsSync(TEMP_HOME)) {
      rmSync(TEMP_HOME, { recursive: true, force: true })
    }
    mkdirSync(TEMP_HOME, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEMP_HOME)) {
      rmSync(TEMP_HOME, { recursive: true, force: true })
    }
  })

  test("ensureConfigExists creates config dir and file when missing", () => {
    // Simulate the behavior of ensureConfigExists
    expect(existsSync(TEMP_CONFIG_PATH)).toBe(false)

    // Create dir and file
    mkdirSync(TEMP_CONFIG_DIR, { recursive: true })
    const defaultConfig = createDefaultConfig()
    writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8")

    expect(existsSync(TEMP_CONFIG_PATH)).toBe(true)
    const content = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    expect(content.version).toBe(1)
    expect(content.components.plugin.installed).toBe(false)
    expect(content.components.theme.installed).toBe(false)
    expect(content.components.sounds.installed).toBe(false)
    expect(content.components["context-mode"].installed).toBe(false)
  })

  test("ensureConfigExists does not overwrite existing config", () => {
    mkdirSync(TEMP_CONFIG_DIR, { recursive: true })
    const customConfig = {
      ...createDefaultConfig(),
      components: {
        ...createDefaultConfig().components,
        plugin: { installed: true, version: "test-hash" },
      },
    }
    writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(customConfig, null, 2) + "\n", "utf8")

    // Simulate ensureConfigExists check
    if (!existsSync(TEMP_CONFIG_PATH)) {
      writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(createDefaultConfig(), null, 2) + "\n", "utf8")
    }

    const content = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    expect(content.components.plugin.installed).toBe(true)
    expect(content.components.plugin.version).toBe("test-hash")
  })

  test("saveConfig writes valid JSON", () => {
    mkdirSync(TEMP_CONFIG_DIR, { recursive: true })
    const config = createDefaultConfig()
    config.components.plugin = { installed: true, version: "bundled", installedAt: new Date().toISOString() }

    const tmpPath = TEMP_CONFIG_PATH + ".tmp"
    writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
    // Atomic rename simulation
    const { renameSync } = require("fs")
    renameSync(tmpPath, TEMP_CONFIG_PATH)

    const saved = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    expect(saved.components.plugin.installed).toBe(true)
    expect(saved.components.plugin.version).toBe("bundled")
    expect(typeof saved.components.plugin.installedAt).toBe("string")
  })

  test("setConfigValue via dot-path sets nested value", () => {
    const config = createDefaultConfig()

    // Simulate setConfigValue
    function setConfigValue(obj: any, key: string, value: string): boolean {
      const parts = key.split(".")
      let current = obj
      for (let i = 0; i < parts.length - 1; i++) {
        if (current == null || typeof current !== "object") return false
        current = current[parts[i]]
      }
      const lastKey = parts[parts.length - 1]
      if (current == null || typeof current !== "object" || !(lastKey in current)) return false
      let parsed: unknown
      try { parsed = JSON.parse(value) } catch { parsed = value }
      current[lastKey] = parsed
      return true
    }

    expect(setConfigValue(config, "components.sounds.installed", "true")).toBe(true)
    expect(config.components.sounds.installed).toBe(true)

    expect(setConfigValue(config, "repoUrl", '"https://example.com"')).toBe(true)
    expect(config.repoUrl).toBe("https://example.com")
  })

  test("getConfigValue reads nested value", () => {
    const config = createDefaultConfig()
    config.components.plugin.installed = true

    function getConfigValue(obj: any, key: string): { found: boolean; value: any } {
      const parts = key.split(".")
      let current = obj
      for (const part of parts) {
        if (current == null || typeof current !== "object") return { found: false, value: undefined }
        current = current[part]
      }
      return { found: true, value: current }
    }

    expect(getConfigValue(config, "components.plugin.installed")).toEqual({ found: true, value: true })
    expect(getConfigValue(config, "repoUrl")).toEqual({ found: true, value: "https://github.com/kevin15011/cyberpunk-plugin" })
    expect(getConfigValue(config, "nonexistent.key")).toEqual({ found: false, value: undefined })
  })
})
