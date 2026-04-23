// tests/install-presets.test.ts — unit tests for preset registry and resolver

import { describe, test, expect } from "bun:test"
import { resolvePreset, PRESET_NAMES } from "../src/presets/index"
import { PRESET_DEFINITIONS } from "../src/presets/index"

describe("resolvePreset", () => {
  test("minimal resolves to plugin + theme", () => {
    const resolved = resolvePreset("minimal")
    expect(resolved.id).toBe("minimal")
    expect(resolved.components).toEqual(["plugin", "theme"])
  })

  test("full resolves to all six components", () => {
    const resolved = resolvePreset("full")
    expect(resolved.id).toBe("full")
    expect(resolved.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"])
  })

  test("minimal has no warnings", () => {
    const resolved = resolvePreset("minimal")
    expect(resolved.warnings).toEqual([])
  })

  test("full has warnings populated", () => {
    const resolved = resolvePreset("full")
    expect(resolved.warnings.length).toBeGreaterThan(0)
  })

  test("full warns about sounds/ffmpeg", () => {
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("sounds") && w.includes("ffmpeg"))).toBe(true)
  })

  test("full warns about context-mode/npm", () => {
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("context-mode") && w.includes("npm"))).toBe(true)
  })

  test("full warns about rtk/curl", () => {
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("rtk") && w.includes("curl"))).toBe(true)
  })

  test("full warns about tmux managed block", () => {
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("tmux") && w.includes("tmux.conf"))).toBe(true)
  })

  test("unknown preset throws", () => {
    expect(() => resolvePreset("nonexistent")).toThrow()
  })

  test("deferred preset wsl throws with slice-1 message", () => {
    expect(() => resolvePreset("wsl")).toThrow(/no está disponible/)
  })

  test("deferred preset mac throws with slice-1 message", () => {
    expect(() => resolvePreset("mac")).toThrow(/no está disponible/)
  })

  test("case-insensitive resolution", () => {
    const resolved = resolvePreset("Minimal")
    expect(resolved.id).toBe("minimal")
  })

  test("resolved components are a copy (not the same array)", () => {
    const a = resolvePreset("minimal")
    const b = resolvePreset("minimal")
    expect(a.components).toEqual(b.components)
    expect(a.components).not.toBe(b.components)
  })

  test("resolved warnings are a copy", () => {
    const a = resolvePreset("full")
    const b = resolvePreset("full")
    expect(a.warnings).toEqual(b.warnings)
    expect(a.warnings).not.toBe(b.warnings)
  })
})

describe("PRESET_NAMES", () => {
  test("contains minimal and full only", () => {
    const values = PRESET_NAMES.map(p => p.value)
    expect(values).toContain("minimal")
    expect(values).toContain("full")
    expect(values).not.toContain("wsl")
    expect(values).not.toContain("mac")
  })

  test("each entry has label and hint", () => {
    for (const entry of PRESET_NAMES) {
      expect(entry.label).toBeTruthy()
      expect(entry.hint).toBeTruthy()
    }
  })
})

describe("PRESET_DEFINITIONS", () => {
  test("has exactly 2 entries (minimal, full)", () => {
    expect(PRESET_DEFINITIONS.size).toBe(2)
  })
})
