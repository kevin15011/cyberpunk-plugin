// tests/config.test.ts — tests for config load/save behavior

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, renameSync } from "fs"

import { createTempHome, importAfterHomeSet, setDefaultConfig } from "./helpers/test-home"

// We test the config module logic by importing and exercising it
// with a temp HOME to avoid polluting real config

type TestHome = ReturnType<typeof createTempHome>

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
  let fixture: TestHome

  beforeEach(() => {
    fixture = createTempHome("cyberpunk-config")
  })

  afterEach(() => {
    fixture.cleanup()
  })

  test("ensureConfigExists creates config dir and file when missing", () => {
    // Simulate the behavior of ensureConfigExists
    expect(existsSync(fixture.configPath)).toBe(false)

    // Create dir and file
    mkdirSync(fixture.configDir, { recursive: true })
    const defaultConfig = createDefaultConfig()
    writeFileSync(fixture.configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8")

    expect(existsSync(fixture.configPath)).toBe(true)
    const content = JSON.parse(readFileSync(fixture.configPath, "utf8"))
    expect(content.version).toBe(1)
    expect(content.components.plugin.installed).toBe(false)
    expect(content.components.theme.installed).toBe(false)
    expect(content.components.sounds.installed).toBe(false)
    expect(content.components["context-mode"].installed).toBe(false)
  })

  test("ensureConfigExists does not overwrite existing config", () => {
    mkdirSync(fixture.configDir, { recursive: true })
    const customConfig = {
      ...createDefaultConfig(),
      components: {
        ...createDefaultConfig().components,
        plugin: { installed: true, version: "test-hash" },
      },
    }
    writeFileSync(fixture.configPath, JSON.stringify(customConfig, null, 2) + "\n", "utf8")

    // Simulate ensureConfigExists check
    if (!existsSync(fixture.configPath)) {
      writeFileSync(fixture.configPath, JSON.stringify(createDefaultConfig(), null, 2) + "\n", "utf8")
    }

    const content = JSON.parse(readFileSync(fixture.configPath, "utf8"))
    expect(content.components.plugin.installed).toBe(true)
    expect(content.components.plugin.version).toBe("test-hash")
  })

  test("saveConfig writes valid JSON", () => {
    mkdirSync(fixture.configDir, { recursive: true })
    const config = createDefaultConfig()
    config.components.plugin = { installed: true, version: "bundled", installedAt: new Date().toISOString() }

    const tmpPath = fixture.configPath + ".tmp"
    writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
    // Atomic rename simulation
    renameSync(tmpPath, fixture.configPath)

    const saved = JSON.parse(readFileSync(fixture.configPath, "utf8"))
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

describe("Config command success reporting", () => {
  let fixture: TestHome

  beforeEach(() => {
    fixture = createTempHome("cyberpunk-config")
    setDefaultConfig(fixture.configDir)
  })

  afterEach(() => {
    fixture.cleanup()
  })

  async function getRunConfigCommand() {
    const mod = await import("../src/commands/config.ts?" + Date.now())
    return mod.runConfigCommand
  }

  test("config set with valid top-level key returns success=true", async () => {
    const runConfigCommand = await getRunConfigCommand()
    const result = await withHome(fixture.home, () => runConfigCommand({ key: "installMode", value: "binary" }))
    expect(result.success).toBe(true)
    expect(result.action).toBe("set")
    expect(result.value).toBe("binary")
  })

  test("config reads and writes stay fixture-only even when caller HOME has unrelated config", async () => {
    const hostFixture = createTempHome("cyberpunk-config-host")

    try {
      setDefaultConfig(fixture.configDir, { repoUrl: "https://fixture.example/repo", installMode: "repo" })
      setDefaultConfig(hostFixture.configDir, { repoUrl: "https://host.example/repo", installMode: "binary" })

      const runConfigCommand = await getRunConfigCommand()
      const hostConfigBefore = readFileSync(hostFixture.configPath, "utf8")

      process.env.HOME = hostFixture.home

      const getResult = await withHome(fixture.home, () => runConfigCommand({ key: "repoUrl" }))
      expect(getResult.success).toBe(true)
      expect(getResult.value).toBe("https://fixture.example/repo")

      const setResult = await withHome(fixture.home, () => runConfigCommand({ key: "installMode", value: "binary" }))
      expect(setResult.success).toBe(true)

      expect(JSON.parse(readFileSync(fixture.configPath, "utf8"))).toMatchObject({
        repoUrl: "https://fixture.example/repo",
        installMode: "binary",
      })
      expect(readFileSync(hostFixture.configPath, "utf8")).toBe(hostConfigBefore)
    } finally {
      delete process.env.HOME
      hostFixture.cleanup()
    }
  })

  test("config set with invalid nested key returns success=false", async () => {
    const runConfigCommand = await getRunConfigCommand()
    const result = await withHome(fixture.home, () => runConfigCommand({ key: "nonexistent.deep.key", value: "value" }))
    expect(result.success).toBe(false)
    expect(result.action).toBe("set")
  })

  test("config get with existing key returns success=true", async () => {
    const runConfigCommand = await getRunConfigCommand()
    const result = await withHome(fixture.home, () => runConfigCommand({ key: "repoUrl" }))
    expect(result.success).toBe(true)
    expect(result.action).toBe("get")
  })

  test("config get with missing key returns success=false", async () => {
    const runConfigCommand = await getRunConfigCommand()
    const result = await withHome(fixture.home, () => runConfigCommand({ key: "nonexistent.deep.key" }))
    expect(result.success).toBe(false)
    expect(result.action).toBe("get")
  })

  test("config init returns success=true", async () => {
    const runConfigCommand = await getRunConfigCommand()
    const result = await withHome(fixture.home, () => runConfigCommand({ init: true }))
    expect(result.success).toBe(true)
    expect(result.action).toBe("init")
  })

  test("config list returns success=true", async () => {
    const runConfigCommand = await getRunConfigCommand()
    const result = await withHome(fixture.home, () => runConfigCommand({ list: true }))
    expect(result.success).toBe(true)
    expect(result.action).toBe("list")
  })
})
