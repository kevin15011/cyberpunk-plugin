// tests/install-presets.test.ts — unit tests for preset registry, resolver, and platform detection

import * as fs from "node:fs"
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"

let procVersionContent = "Linux version 6.1.0-generic"

async function importPresetModules() {
  const nonce = Date.now().toString()
  const presets = await import(`../src/presets/index?${nonce}`)
  const output = await import(`../src/cli/output?${nonce}`)
  const definitions = await import(`../src/presets/definitions?${nonce}`)
  const platform = await import(`../src/platform/detect?${nonce}`)

  return {
    ...presets,
    ...output,
    ...definitions,
    ...platform,
  }
}

async function withMockedPlatform<T>(platform: NodeJS.Platform, run: () => Promise<T> | T): Promise<T> {
  const originalPlatform = process.platform
  Object.defineProperty(process, "platform", { value: platform, configurable: true })

  try {
    return await run()
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true })
  }
}

beforeEach(() => {
  procVersionContent = "Linux version 6.1.0-generic"
})

afterEach(() => {
  mock.restore()
})

describe("platform detection", () => {
  test("detectEnvironment returns darwin on macOS", async () => {
    await withMockedPlatform("darwin", async () => {
      const { detectEnvironment, isWSL } = await importPresetModules()
      expect(detectEnvironment()).toBe("darwin")
      expect(isWSL()).toBe(false)
    })
  })

  test("detectEnvironment returns wsl when /proc/version mentions microsoft", async () => {
    procVersionContent = "Linux version 5.15.167.4-microsoft-standard-WSL2"

    await withMockedPlatform("linux", async () => {
      spyOn(fs, "readFileSync").mockImplementation(() => procVersionContent as any)
      const { detectEnvironment, isWSL } = await importPresetModules()
      expect(detectEnvironment()).toBe("wsl")
      expect(isWSL()).toBe(true)
    })
  })

  test("detectEnvironment returns linux for non-WSL Linux", async () => {
    procVersionContent = "Linux version 6.1.0-generic"

    await withMockedPlatform("linux", async () => {
      spyOn(fs, "readFileSync").mockImplementation(() => procVersionContent as any)
      const { detectEnvironment, isWSL } = await importPresetModules()
      expect(detectEnvironment()).toBe("linux")
      expect(isWSL()).toBe(false)
    })
  })
})

describe("resolvePreset", () => {
  test("minimal resolves to plugin + theme", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("minimal")
    expect(resolved.id).toBe("minimal")
    expect(resolved.components).toEqual(["plugin", "theme"])
  })

  test("full resolves to all ten components", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("full")
    expect(resolved.id).toBe("full")
    expect(resolved.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux", "tui-plugins", "codebase-memory", "otel", "otel-collector"])
  })

  test("wsl resolves to plugin + theme + sounds + tmux", async () => {
    procVersionContent = "Linux version 5.15.167.4-microsoft-standard-WSL2"

    await withMockedPlatform("linux", async () => {
      spyOn(fs, "readFileSync").mockImplementation(() => procVersionContent as any)
      const { resolvePreset } = await importPresetModules()
      const resolved = resolvePreset("wsl")
      expect(resolved.id).toBe("wsl")
      expect(resolved.components).toEqual(["plugin", "theme", "sounds", "tmux"])
    })
  })

  test("mac resolves to plugin + theme + sounds + context-mode + rtk", async () => {
    await withMockedPlatform("darwin", async () => {
      const { resolvePreset } = await importPresetModules()
      const resolved = resolvePreset("mac")
      expect(resolved.id).toBe("mac")
      expect(resolved.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk"])
    })
  })

  test("minimal has no warnings", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("minimal")
    expect(resolved.warnings).toEqual([])
  })

  test("full has warnings populated", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("full")
    expect(resolved.warnings.length).toBeGreaterThan(0)
  })

  test("full warns about sounds/ffmpeg", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("sounds") && w.includes("ffmpeg"))).toBe(true)
  })

  test("full warns about context-mode/npm", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("context-mode") && w.includes("npm"))).toBe(true)
  })

  test("full warns about rtk/curl", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("rtk") && w.includes("curl"))).toBe(true)
  })

  test("full warns about tmux managed block", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("full")
    expect(resolved.warnings.some(w => w.includes("tmux") && w.includes("tmux.conf"))).toBe(true)
  })

  test("wsl keeps its base warning on matching platform", async () => {
    procVersionContent = "Linux version 5.15.167.4-microsoft-standard-WSL2"

    await withMockedPlatform("linux", async () => {
      spyOn(fs, "readFileSync").mockImplementation(() => procVersionContent as any)
      const { resolvePreset } = await importPresetModules()
      const resolved = resolvePreset("wsl")
      expect(resolved.warnings.some(w => w.includes("WSL"))).toBe(true)
    })
  })

  test("wsl appends mismatch warning outside WSL", async () => {
    await withMockedPlatform("linux", async () => {
      procVersionContent = "Linux version 6.1.0-generic"
      spyOn(fs, "readFileSync").mockImplementation(() => procVersionContent as any)
      const { resolvePreset } = await importPresetModules()

      const resolved = resolvePreset("wsl")
      expect(resolved.warnings.filter(w => w.includes("WSL")).length).toBeGreaterThanOrEqual(2)
    })
  })

  test("mac appends mismatch warning outside macOS", async () => {
    await withMockedPlatform("linux", async () => {
      const { resolvePreset } = await importPresetModules()
      const resolved = resolvePreset("mac")
      expect(resolved.warnings.filter(w => /mac/i.test(w)).length).toBeGreaterThanOrEqual(2)
    })
  })

  test("unknown preset throws", async () => {
    const { resolvePreset } = await importPresetModules()
    expect(() => resolvePreset("nonexistent")).toThrow()
  })

  test("case-insensitive resolution", async () => {
    const { resolvePreset } = await importPresetModules()
    const resolved = resolvePreset("Minimal")
    expect(resolved.id).toBe("minimal")
  })

  test("resolved components are a copy (not the same array)", async () => {
    const { resolvePreset } = await importPresetModules()
    const a = resolvePreset("minimal")
    const b = resolvePreset("minimal")
    expect(a.components).toEqual(b.components)
    expect(a.components).not.toBe(b.components)
  })

  test("resolved warnings are a copy", async () => {
    const { resolvePreset } = await importPresetModules()
    const a = resolvePreset("full")
    const b = resolvePreset("full")
    expect(a.warnings).toEqual(b.warnings)
    expect(a.warnings).not.toBe(b.warnings)
  })
})

describe("PRESET_NAMES", () => {
  test("contains minimal, full, wsl, and mac", async () => {
    const { PRESET_NAMES } = await importPresetModules()
    const values = PRESET_NAMES.map(p => p.value)
    expect(values).toEqual(["minimal", "full", "wsl", "mac"])
  })

  test("each entry has label and hint", async () => {
    const { PRESET_NAMES } = await importPresetModules()
    for (const entry of PRESET_NAMES) {
      expect(entry.label).toBeTruthy()
      expect(entry.hint).toBeTruthy()
    }
  })
})

describe("PRESET_DEFINITIONS", () => {
  test("has exactly 4 entries", async () => {
    const { PRESET_DEFINITIONS } = await importPresetModules()
    expect(PRESET_DEFINITIONS.size).toBe(4)
  })
})

describe("formatHelp", () => {
  test("includes wsl/mac presets and examples", async () => {
    const { formatHelp } = await importPresetModules()
    const help = formatHelp()

    expect(help).toContain("--preset <name> Instalar desde preset (minimal, full, wsl, mac)")
    expect(help).toContain("cyberpunk install --preset wsl")
    expect(help).toContain("cyberpunk install --preset mac")
  })
})
