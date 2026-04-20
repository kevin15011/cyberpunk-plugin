// tests/opencode-config.test.ts — tests for registerCyberpunkPlugin / unregisterCyberpunkPlugin

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// We'll test the logic directly by exercising the module functions
// with a controlled filesystem environment.

// Since the module reads from a fixed path based on HOME,
// we test by temporarily overriding HOME and creating fixtures.

const TEMP_HOME = join(tmpdir(), `cyberpunk-opencode-test-${Date.now()}`)
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const OPENCODE_CONFIG = join(OPENCODE_DIR, "opencode.json")
const ORIGINAL_HOME = process.env.HOME

// We need to re-import the module after changing HOME,
// but since the module computes paths at load time, we must
// test the logic in a way that works with the actual module.
//
// Strategy: test the core logic patterns directly here,
// and do integration-style tests where we can.

function makeConfig(plugin?: string[]): object {
  const cfg: any = {}
  if (plugin !== undefined) cfg.plugin = plugin
  return cfg
}

describe("OpenCode plugin registration logic", () => {
  // ── Pure logic tests (no file I/O) ──────────────────────────────

  describe("idempotent registration (logic)", () => {
    test("appending to empty plugin array", () => {
      const config: any = { plugin: [] }
      const entry = "./plugins/cyberpunk"
      if (!config.plugin.includes(entry)) {
        config.plugin.push(entry)
      }
      expect(config.plugin).toEqual(["./plugins/cyberpunk"])
    })

    test("skip duplicate entry", () => {
      const config: any = { plugin: ["./plugins/cyberpunk"] }
      const entry = "./plugins/cyberpunk"
      if (!config.plugin.includes(entry)) {
        config.plugin.push(entry)
      }
      expect(config.plugin).toEqual(["./plugins/cyberpunk"])
      expect(config.plugin.length).toBe(1)
    })

    test("append without disturbing other entries", () => {
      const config: any = { plugin: ["./plugins/other-plugin"] }
      const entry = "./plugins/cyberpunk"
      if (!config.plugin.includes(entry)) {
        config.plugin.push(entry)
      }
      expect(config.plugin).toEqual(["./plugins/other-plugin", "./plugins/cyberpunk"])
    })

    test("initialize plugin array if missing", () => {
      const config: any = {}
      if (!config.plugin) config.plugin = []
      const entry = "./plugins/cyberpunk"
      if (!config.plugin.includes(entry)) {
        config.plugin.push(entry)
      }
      expect(config.plugin).toEqual(["./plugins/cyberpunk"])
    })
  })

  describe("unregistration logic", () => {
    test("remove only cyberpunk entry", () => {
      const config: any = { plugin: ["./plugins/other", "./plugins/cyberpunk"] }
      const entry = "./plugins/cyberpunk"
      const idx = config.plugin.indexOf(entry)
      if (idx !== -1) config.plugin.splice(idx, 1)
      expect(config.plugin).toEqual(["./plugins/other"])
    })

    test("no matching entry — array unchanged", () => {
      const config: any = { plugin: ["./plugins/other"] }
      const entry = "./plugins/cyberpunk"
      const idx = config.plugin.indexOf(entry)
      if (idx !== -1) config.plugin.splice(idx, 1)
      expect(config.plugin).toEqual(["./plugins/other"])
    })

    test("empty array — no error", () => {
      const config: any = { plugin: [] }
      const entry = "./plugins/cyberpunk"
      const idx = config.plugin.indexOf(entry)
      if (idx !== -1) config.plugin.splice(idx, 1)
      expect(config.plugin).toEqual([])
    })
  })

  describe("edge cases", () => {
    test("invalid plugin field type (string) — warn and skip", () => {
      const config: any = { plugin: "not-an-array" }
      const isValid = Array.isArray(config.plugin)
      expect(isValid).toBe(false)
      // Registration should skip
    })

    test("invalid plugin field type (number) — warn and skip", () => {
      const config: any = { plugin: 42 }
      const isValid = Array.isArray(config.plugin)
      expect(isValid).toBe(false)
    })

    test("null plugin field — skip", () => {
      const config: any = { plugin: null }
      const isValid = Array.isArray(config.plugin)
      expect(isValid).toBe(false)
    })
  })

  // ── Filesystem integration tests ────────────────────────────────

  describe("filesystem integration", () => {
    beforeEach(() => {
      if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
      mkdirSync(TEMP_HOME, { recursive: true })
      // Set HOME to temp
      process.env.HOME = TEMP_HOME
    })

    afterEach(() => {
      process.env.HOME = ORIGINAL_HOME
      if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    })

    test("register with missing config file — returns warning", async () => {
      // Force module reimport with new HOME
      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.registerCyberpunkPlugin()
      expect(result.changed).toBe(false)
      expect(result.registered).toBe(false)
      expect(result.warning).toContain("not found")
    })

    test("register appends to existing config", async () => {
      mkdirSync(OPENCODE_DIR, { recursive: true })
      writeFileSync(OPENCODE_CONFIG, JSON.stringify({ plugin: [] }, null, 2) + "\n", "utf8")

      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.registerCyberpunkPlugin()
      expect(result.changed).toBe(true)
      expect(result.registered).toBe(true)

      const saved = JSON.parse(readFileSync(OPENCODE_CONFIG, "utf8"))
      expect(saved.plugin).toEqual(["./plugins/cyberpunk"])
    })

    test("register is idempotent — second call returns changed:false", async () => {
      mkdirSync(OPENCODE_DIR, { recursive: true })
      writeFileSync(OPENCODE_CONFIG, JSON.stringify({ plugin: ["./plugins/cyberpunk"] }, null, 2) + "\n", "utf8")

      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.registerCyberpunkPlugin()
      expect(result.changed).toBe(false)
      expect(result.registered).toBe(true)
    })

    test("unregister removes cyberpunk entry", async () => {
      mkdirSync(OPENCODE_DIR, { recursive: true })
      writeFileSync(OPENCODE_CONFIG, JSON.stringify({ plugin: ["./plugins/other", "./plugins/cyberpunk"] }, null, 2) + "\n", "utf8")

      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.unregisterCyberpunkPlugin()
      expect(result.changed).toBe(true)
      expect(result.registered).toBe(false)

      const saved = JSON.parse(readFileSync(OPENCODE_CONFIG, "utf8"))
      expect(saved.plugin).toEqual(["./plugins/other"])
    })

    test("unregister with missing config — silent skip", async () => {
      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.unregisterCyberpunkPlugin()
      expect(result.changed).toBe(false)
      expect(result.registered).toBe(false)
    })

    test("register with invalid plugin field type — warning", async () => {
      mkdirSync(OPENCODE_DIR, { recursive: true })
      writeFileSync(OPENCODE_CONFIG, JSON.stringify({ plugin: "not-array" }, null, 2) + "\n", "utf8")

      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.registerCyberpunkPlugin()
      expect(result.changed).toBe(false)
      expect(result.registered).toBe(false)
      expect(result.warning).toContain("not an array")
    })

    test("register RTK plugin appends to existing OpenCode plugin array", async () => {
      mkdirSync(OPENCODE_DIR, { recursive: true })
      writeFileSync(OPENCODE_CONFIG, JSON.stringify({ plugin: ["./plugins/cyberpunk"] }, null, 2) + "\n", "utf8")

      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.registerOpenCodePlugin(mod.RTK_PLUGIN_ENTRY)
      expect(result.changed).toBe(true)
      expect(result.registered).toBe(true)

      const saved = JSON.parse(readFileSync(OPENCODE_CONFIG, "utf8"))
      expect(saved.plugin).toEqual(["./plugins/cyberpunk", "./plugins/rtk"])
    })

    test("unregister RTK plugin removes only RTK entry", async () => {
      mkdirSync(OPENCODE_DIR, { recursive: true })
      writeFileSync(OPENCODE_CONFIG, JSON.stringify({ plugin: ["./plugins/cyberpunk", "./plugins/rtk", "./plugins/other"] }, null, 2) + "\n", "utf8")

      const mod = await import("../src/opencode-config.ts?" + Date.now())
      const result = mod.unregisterOpenCodePlugin(mod.RTK_PLUGIN_ENTRY)
      expect(result.changed).toBe(true)
      expect(result.registered).toBe(false)

      const saved = JSON.parse(readFileSync(OPENCODE_CONFIG, "utf8"))
      expect(saved.plugin).toEqual(["./plugins/cyberpunk", "./plugins/other"])
    })
  })
})
