// tests/tui-plugins.test.ts — verify tui-plugins component registers/unregisters TUI plugins in tui.json

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-tui-plugins-test-${Date.now()}`)
const CYBERPUNK_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const CYBERPUNK_CONFIG_PATH = join(CYBERPUNK_CONFIG_DIR, "config.json")
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const TUI_PATH = join(OPENCODE_DIR, "tui.json")
const ORIGINAL_HOME = process.env.HOME

const TUI_PLUGIN_ENTRIES = [
  "opencode-sdd-engram-manage",
  "opencode-subagent-statusline",
]

function writeCyberpunkConfig() {
  mkdirSync(CYBERPUNK_CONFIG_DIR, { recursive: true })
  writeFileSync(
    CYBERPUNK_CONFIG_PATH,
    JSON.stringify({
      version: 2,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
        "tui-plugins": { installed: false },
        "codebase-memory": { installed: false },
        otel: { installed: false },
        "otel-collector": { installed: false },
      },
    }, null, 2) + "\n",
    "utf8"
  )
}

function writeTuiConfig(data: Record<string, unknown>) {
  mkdirSync(OPENCODE_DIR, { recursive: true })
  writeFileSync(TUI_PATH, JSON.stringify(data, null, 2) + "\n", "utf8")
}

function readTuiConfig() {
  return JSON.parse(readFileSync(TUI_PATH, "utf8"))
}

describe("tui-plugins component", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
  })

  afterEach(() => {
    process.env.HOME = ORIGINAL_HOME
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("install creates tui.json with plugins when it doesn't exist", async () => {
    writeCyberpunkConfig()

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const result = await component.install()

    expect(result.status).toBe("success")
    const tui = readTuiConfig()
    expect(tui.plugins).toEqual(TUI_PLUGIN_ENTRIES)
  })

  test("install adds plugins to existing tui.json preserving $schema and theme", async () => {
    writeCyberpunkConfig()
    writeTuiConfig({
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
      plugins: ["some-existing-plugin"],
    })

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const result = await component.install()

    expect(result.status).toBe("success")
    const tui = readTuiConfig()
    expect(tui.theme).toBe("cyberpunk")
    expect(tui["$schema"]).toBe("https://opencode.ai/tui.json")
    expect(tui.plugins).toContain("some-existing-plugin")
    for (const p of TUI_PLUGIN_ENTRIES) {
      expect(tui.plugins).toContain(p)
    }
  })

  test("install is idempotent (skipped when already registered)", async () => {
    writeCyberpunkConfig()
    writeTuiConfig({
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
      plugins: [...TUI_PLUGIN_ENTRIES],
    })

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const result = await component.install()

    expect(result.status).toBe("skipped")
    const tui = readTuiConfig()
    // No duplicates
    expect(tui.plugins.filter((p: string) => p === TUI_PLUGIN_ENTRIES[0]).length).toBe(1)
  })

  test("install does not duplicate plugins on repeated runs", async () => {
    writeCyberpunkConfig()

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    await component.install()
    await component.install()

    const tui = readTuiConfig()
    for (const p of TUI_PLUGIN_ENTRIES) {
      expect(tui.plugins.filter((e: string) => e === p).length).toBe(1)
    }
  })

  test("uninstall removes only our plugins preserving others and theme", async () => {
    writeCyberpunkConfig()
    writeTuiConfig({
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
      plugins: ["some-other", ...TUI_PLUGIN_ENTRIES],
    })

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const result = await component.uninstall()

    expect(result.status).toBe("success")
    const tui = readTuiConfig()
    expect(tui.theme).toBe("cyberpunk")
    expect(tui.plugins).toEqual(["some-other"])
  })

  test("status returns installed when both plugins are registered", async () => {
    writeCyberpunkConfig()
    writeTuiConfig({
      plugins: [...TUI_PLUGIN_ENTRIES],
    })

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const status = await component.status()

    expect(status.status).toBe("installed")
  })

  test("status returns available when plugins are missing", async () => {
    writeCyberpunkConfig()
    writeTuiConfig({ plugins: [] })

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const status = await component.status()

    expect(status.status).toBe("available")
  })

  test("doctor reports pass when all plugins registered", async () => {
    writeCyberpunkConfig()
    writeTuiConfig({ plugins: [...TUI_PLUGIN_ENTRIES] })

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const result = await component.doctor({ cyberpunkConfig: null, verbose: false, prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false } })

    expect(result.checks.length).toBe(2)
    for (const check of result.checks) {
      expect(check.status).toBe("pass")
    }
  })

  test("doctor reports fail with fixable when plugins missing", async () => {
    writeCyberpunkConfig()

    const { getTuiPluginsComponent } = await import("../src/components/tui-plugins.ts?" + Date.now())
    const component = getTuiPluginsComponent()
    const result = await component.doctor({ cyberpunkConfig: null, verbose: false, prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false } })

    expect(result.checks.length).toBe(2)
    for (const check of result.checks) {
      expect(check.status).toBe("fail")
      expect(check.fixable).toBe(true)
    }
  })
})
