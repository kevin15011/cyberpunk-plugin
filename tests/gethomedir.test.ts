// tests/gethomedir.test.ts — TDD: getHomeDir must not return literal "~"

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { homedir } from "os"

/**
 * We test getHomeDir() indirectly via getConfigDir().
 * getHomeDir is private, but getConfigDir() calls it: join(getHomeDir(), ".config", "cyberpunk")
 *
 * When HOME and USERPROFILE are both unset, the old code returns "~" literal.
 * The fix must fall back to os.homedir() instead.
 */

describe("getHomeDir fallback", () => {
  const savedHome = process.env.HOME
  const savedUserProfile = process.env.USERPROFILE

  afterEach(() => {
    // Restore env vars
    if (savedHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = savedHome
    }
    if (savedUserProfile === undefined) {
      delete process.env.USERPROFILE
    } else {
      process.env.USERPROFILE = savedUserProfile
    }
  })

  test("getConfigDir uses os.homedir() when HOME and USERPROFILE are unset (not literal ~)", async () => {
    // Remove both env vars
    delete process.env.HOME
    delete process.env.USERPROFILE

    // Fresh import to pick up current env state
    const mod = await import(`../src/config/load.ts?t=${Date.now()}`)
    const configDir = mod.getConfigDir()

    const expectedRealHome = homedir()

    // Must start with the real home dir, NOT "~"
    expect(configDir.startsWith("~")).toBe(false)
    expect(configDir).toBe(
      expectedRealHome + "/.config/cyberpunk"
    )
  })

  test("getConfigDir still works normally when HOME is set", async () => {
    process.env.HOME = "/tmp/fake-home-test"
    delete process.env.USERPROFILE

    const mod = await import(`../src/config/load.ts?t=${Date.now()}`)
    const configDir = mod.getConfigDir()

    expect(configDir).toBe("/tmp/fake-home-test/.config/cyberpunk")
  })

  test("getConfigDir does not treat HOME=~ as a relative project path", async () => {
    process.env.HOME = "~"
    delete process.env.USERPROFILE

    const mod = await import(`../src/config/load.ts?t=${Date.now()}`)
    const configDir = mod.getConfigDir()

    expect(configDir.startsWith("~")).toBe(false)
    expect(configDir).toBe(homedir() + "/.config/cyberpunk")
  })
})
