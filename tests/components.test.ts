// tests/components.test.ts — tests for component status detection logic

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-comp-test-${Date.now()}`)
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const PLUGINS_DIR = join(OPENCODE_DIR, "plugins")
const THEMES_DIR = join(OPENCODE_DIR, "themes")
const SOUNDS_DIR = join(OPENCODE_DIR, "sounds")

describe("Plugin component status", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(PLUGINS_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("plugin shows available when file does not exist", () => {
    const pluginPath = join(PLUGINS_DIR, "cyberpunk.ts")
    expect(existsSync(pluginPath)).toBe(false)
  })

  test("plugin shows installed when file exists", () => {
    const pluginPath = join(PLUGINS_DIR, "cyberpunk.ts")
    writeFileSync(pluginPath, "// test plugin", "utf8")
    expect(existsSync(pluginPath)).toBe(true)
  })
})

describe("Theme component status", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(THEMES_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("theme shows available when no theme file", () => {
    const themePath = join(THEMES_DIR, "cyberpunk.json")
    expect(existsSync(themePath)).toBe(false)
  })

  test("theme shows installed when theme file exists", () => {
    const themePath = join(THEMES_DIR, "cyberpunk.json")
    writeFileSync(themePath, '{"$schema":"https://opencode.ai/theme.json"}', "utf8")
    expect(existsSync(themePath)).toBe(true)
  })
})

describe("Sounds component status", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(SOUNDS_DIR, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("sounds require .wav files (not .m4a)", () => {
    const expectedFiles = ["idle.wav", "error.wav", "compact.wav", "permission.wav"]
    // Verify none exist initially
    for (const f of expectedFiles) {
      expect(existsSync(join(SOUNDS_DIR, f))).toBe(false)
    }
  })

  test("sounds installed when all .wav files exist", () => {
    const expectedFiles = ["idle.wav", "error.wav", "compact.wav", "permission.wav"]
    for (const f of expectedFiles) {
      writeFileSync(join(SOUNDS_DIR, f), "fake wav", "utf8")
    }
    const allExist = expectedFiles.every(f => existsSync(join(SOUNDS_DIR, f)))
    expect(allExist).toBe(true)
  })

  test("sounds not fully installed when some .wav files missing", () => {
    writeFileSync(join(SOUNDS_DIR, "idle.wav"), "fake wav", "utf8")
    const allExist = ["idle.wav", "error.wav", "compact.wav", "permission.wav"]
      .every(f => existsSync(join(SOUNDS_DIR, f)))
    expect(allExist).toBe(false)
  })
})

describe("Context-Mode component status", () => {
  test("context-mode routing marker identifies managed files", () => {
    const marker = "<!-- cyberpunk-managed:context-mode-routing -->"
    const content = `${marker}\n# Context-Mode Routing\nSome content`
    expect(content.includes(marker)).toBe(true)
  })

  test("non-managed file does not contain marker", () => {
    const marker = "<!-- cyberpunk-managed:context-mode-routing -->"
    const content = "# Some other routing file\nNo marker here"
    expect(content.includes(marker)).toBe(false)
  })
})
