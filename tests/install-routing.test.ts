// tests/install-routing.test.ts — tests for install command routing with target/detection context

import { describe, test, expect } from "bun:test"
import { filterComponentsForTarget } from "../src/commands/install-routing"
import type { DetectionResult, PlatformInfo } from "../src/domain/environment"

describe("filterComponentsForTarget", () => {
  const linuxPlatform: PlatformInfo = {
    kind: "linux",
    arch: "x64",
    configRoot: "/home/user/.config",
  }

  test("opencode target returns all 10 components on linux", () => {
    const result = filterComponentsForTarget("opencode", linuxPlatform)
    expect(result.sort()).toEqual(["codebase-memory", "context-mode", "otel", "otel-collector", "plugin", "rtk", "sounds", "theme", "tmux", "tui-plugins"])
  })

  test("claude target returns empty array (no components support claude yet)", () => {
    const result = filterComponentsForTarget("claude", linuxPlatform)
    expect(result).toEqual([])
  })

  test("codex target returns empty array (no components support codex yet)", () => {
    const result = filterComponentsForTarget("codex", linuxPlatform)
    expect(result).toEqual([])
  })

  const windowsPlatform: PlatformInfo = {
    kind: "windows",
    arch: "x64",
    configRoot: "C:\\Users\\user\\AppData\\Roaming",
  }

  test("opencode on windows returns plugin, theme, sounds (no tmux/context-mode/rtk)", () => {
    const result = filterComponentsForTarget("opencode", windowsPlatform)
    expect(result.sort()).toEqual(["plugin", "sounds", "theme"])
  })

  test("claude on windows returns empty array", () => {
    const result = filterComponentsForTarget("claude", windowsPlatform)
    expect(result).toEqual([])
  })
})

describe("install routing: backward compatibility", () => {
  test("filterComponentsForTarget returns all when opencode on darwin", () => {
    const darwinPlatform: PlatformInfo = {
      kind: "darwin",
      arch: "arm64",
      configRoot: "/Users/user/.config",
    }
    const result = filterComponentsForTarget("opencode", darwinPlatform)
    expect(result.sort()).toEqual(["codebase-memory", "context-mode", "otel", "otel-collector", "plugin", "rtk", "sounds", "theme", "tmux", "tui-plugins"])
  })

  test("filterComponentsForTarget returns all when opencode on wsl", () => {
    const wslPlatform: PlatformInfo = {
      kind: "wsl",
      arch: "x64",
      configRoot: "/home/user/.config",
    }
    const result = filterComponentsForTarget("opencode", wslPlatform)
    expect(result.sort()).toEqual(["codebase-memory", "context-mode", "otel", "otel-collector", "plugin", "rtk", "sounds", "theme", "tmux", "tui-plugins"])
  })
})
