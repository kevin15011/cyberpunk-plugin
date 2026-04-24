import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync } from "fs"

import { createTempHome, importAfterHomeSet, setDefaultConfig } from "./test-home"

const cleanupFns: Array<() => void> = []

afterEach(() => {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.()
  }
})

describe("test-home helpers", () => {
  test("createTempHome returns fixture paths rooted under a unique HOME", () => {
    const fixture = createTempHome("cyberpunk-helper")
    cleanupFns.push(fixture.cleanup)

    expect(fixture.home).toContain("cyberpunk-helper")
    expect(fixture.configDir).toBe(fixture.home + "/.config/cyberpunk")
    expect(fixture.configPath).toBe(fixture.configDir + "/config.json")
    expect(existsSync(fixture.home)).toBe(true)
  })

  test("setDefaultConfig writes a standard config with overrides into the fixture", () => {
    const fixture = createTempHome("cyberpunk-helper-config")
    cleanupFns.push(fixture.cleanup)

    setDefaultConfig(fixture.configDir, {
      installMode: "binary",
      components: {
        plugin: { installed: true, version: "bundled" },
      },
    })

    const parsed = JSON.parse(readFileSync(fixture.configPath, "utf8"))
    expect(parsed.version).toBe(1)
    expect(parsed.installMode).toBe("binary")
    expect(parsed.components.plugin).toEqual({ installed: true, version: "bundled" })
    expect(parsed.components.tmux.installed).toBe(false)
    expect(parsed.components.rtk.installed).toBe(false)
  })

  test("importAfterHomeSet imports HOME-sensitive modules after HOME is set", async () => {
    const originalHome = process.env.HOME
    const fixture = createTempHome("cyberpunk-helper-import")
    cleanupFns.push(() => {
      process.env.HOME = originalHome
      fixture.cleanup()
    })

    const mod = await importAfterHomeSet<{ capturedHome: string | null }>("./fixtures/home-capture.ts", fixture.home)

    expect(mod.capturedHome).toBe(fixture.home)
    expect(process.env.HOME).toBe(originalHome)
  })

  test("cleanup removes the fixture tree", () => {
    const fixture = createTempHome("cyberpunk-helper-cleanup")

    fixture.cleanup()

    expect(existsSync(fixture.home)).toBe(false)
  })
})
