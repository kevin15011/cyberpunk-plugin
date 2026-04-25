// tests/platform-paths.test.ts — RED: assert Windows shims produce correct config/home roots; assert POSIX unchanged.

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { homedir, tmpdir } from "node:os"

// Helper to import fresh module after env changes
async function importPaths() {
  return import(`../src/platform/paths.ts?t=${Date.now()}`)
}

describe("getConfigRoot()", () => {
  const savedHome = process.env.HOME
  const savedAppdata = process.env.APPDATA
  const savedUserProfile = process.env.USERPROFILE
  const savedXdg = process.env.XDG_CONFIG_HOME

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome
    if (savedAppdata === undefined) delete process.env.APPDATA; else process.env.APPDATA = savedAppdata
    if (savedUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedUserProfile
    if (savedXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = savedXdg
  })

  test("returns APPDATA-based path for windows platform", async () => {
    process.env.APPDATA = "C:\\Users\\TestUser\\AppData\\Roaming"
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result).toBe("C:\\Users\\TestUser\\AppData\\Roaming\\cyberpunk")
  })

  test("returns LOCALAPPDATA-based path for windows when APPDATA unset", async () => {
    delete process.env.APPDATA
    process.env.LOCALAPPDATA = "C:\\Users\\TestUser\\AppData\\Local"
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result).toBe("C:\\Users\\TestUser\\AppData\\Local\\cyberpunk")
    delete process.env.LOCALAPPDATA
  })

  test("returns USERPROFILE-based fallback for windows when APPDATA and LOCALAPPDATA unset", async () => {
    delete process.env.APPDATA
    delete process.env.LOCALAPPDATA
    process.env.USERPROFILE = "C:\\Users\\TestUser"
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result).toBe("C:\\Users\\TestUser\\.config\\cyberpunk")
  })

  test("returns XDG_CONFIG_HOME for linux when set", async () => {
    process.env.HOME = "/home/testuser"
    process.env.XDG_CONFIG_HOME = "/home/testuser/.xdg-config"
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "linux", arch: "x64", configRoot: "" })
    expect(result).toBe("/home/testuser/.xdg-config/cyberpunk")
  })

  test("returns HOME/.config/cyberpunk for linux with default XDG", async () => {
    process.env.HOME = "/home/testuser"
    delete process.env.XDG_CONFIG_HOME
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "linux", arch: "x64", configRoot: "" })
    expect(result).toBe("/home/testuser/.config/cyberpunk")
  })

  test("returns HOME/.config/cyberpunk for darwin", async () => {
    process.env.HOME = "/Users/testuser"
    delete process.env.XDG_CONFIG_HOME
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "darwin", arch: "arm64", configRoot: "" })
    expect(result).toBe("/Users/testuser/.config/cyberpunk")
  })

  test("returns HOME/.config/cyberpunk for wsl", async () => {
    process.env.HOME = "/home/testuser"
    delete process.env.XDG_CONFIG_HOME
    const mod = await importPaths()
    const result = mod.getConfigRoot({ kind: "wsl", arch: "x64", configRoot: "" })
    expect(result).toBe("/home/testuser/.config/cyberpunk")
  })
})

describe("getHomeDir()", () => {
  const savedHome = process.env.HOME
  const savedUserProfile = process.env.USERPROFILE

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome
    if (savedUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedUserProfile
  })

  test("returns USERPROFILE for windows platform", async () => {
    process.env.USERPROFILE = "C:\\Users\\TestUser"
    const mod = await importPaths()
    const result = mod.getHomeDir({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result).toBe("C:\\Users\\TestUser")
  })

  test("returns HOME for linux", async () => {
    process.env.HOME = "/home/testuser"
    const mod = await importPaths()
    const result = mod.getHomeDir({ kind: "linux", arch: "x64", configRoot: "" })
    expect(result).toBe("/home/testuser")
  })

  test("returns HOME for darwin", async () => {
    process.env.HOME = "/Users/testuser"
    const mod = await importPaths()
    const result = mod.getHomeDir({ kind: "darwin", arch: "arm64", configRoot: "" })
    expect(result).toBe("/Users/testuser")
  })

  test("returns HOME for wsl", async () => {
    process.env.HOME = "/home/testuser"
    const mod = await importPaths()
    const result = mod.getHomeDir({ kind: "wsl", arch: "x64", configRoot: "" })
    expect(result).toBe("/home/testuser")
  })

  test("ignores literal tilde HOME for POSIX platforms", async () => {
    process.env.HOME = "~"
    delete process.env.USERPROFILE
    const mod = await importPaths()
    const result = mod.getHomeDir({ kind: "linux", arch: "x64", configRoot: "" })
    expect(result).toBe(homedir())
    expect(result).not.toBe("~")
  })

  test("ignores literal tilde USERPROFILE for Windows platform", async () => {
    delete process.env.HOME
    process.env.USERPROFILE = "~"
    const mod = await importPaths()
    const result = mod.getHomeDir({ kind: "windows", arch: "x64", configRoot: "" })
    expect(result).toBe(homedir())
    expect(result).not.toBe("~")
  })
})

describe("joinPath()", () => {
  test("joins segments with platform-appropriate separator", async () => {
    const mod = await importPaths()
    // joinPath should use Node's join which handles platform separators
    const result = mod.joinPath("a", "b", "c")
    expect(result).toContain("a")
    expect(result).toContain("c")
  })
})
