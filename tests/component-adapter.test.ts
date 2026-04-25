// tests/component-adapter.test.ts — RED: assert getCapabilities returns correct
// targets/platforms/requires for each component; assert plugin targets only opencode.

import { describe, test, expect } from "bun:test"
import type { ComponentCapability } from "../src/domain/environment"
import type { ComponentId } from "../src/components/types"

// ============================================================================
// Task 3.1 — Component adapter/capability model
// ============================================================================

describe("getCapabilities()", () => {
  test("returns capabilities for all 6 components", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    expect(caps).toHaveLength(6)

    const ids = caps.map(c => c.component).sort()
    expect(ids).toEqual(["context-mode", "plugin", "rtk", "sounds", "theme", "tmux"])
  })

  test("plugin targets only opencode", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    const plugin = caps.find(c => c.component === "plugin")
    expect(plugin).toBeDefined()
    expect(plugin!.targets).toEqual(["opencode"])
    expect(plugin!.status).toBe("supported")
  })

  test("rtk targets opencode only on linux/wsl/darwin", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    const rtk = caps.find(c => c.component === "rtk")
    expect(rtk).toBeDefined()
    expect(rtk!.targets).toEqual(["opencode"])
    expect(rtk!.platforms).toEqual(["linux", "wsl", "darwin"])
    expect(rtk!.status).toBe("supported")
  })

  test("theme targets opencode on all platforms including windows", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    const theme = caps.find(c => c.component === "theme")
    expect(theme).toBeDefined()
    expect(theme!.targets).toEqual(["opencode"])
    expect(theme!.platforms).toEqual(["linux", "wsl", "darwin", "windows"])
    expect(theme!.status).toBe("supported")
  })

  test("sounds targets opencode on all platforms", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    const sounds = caps.find(c => c.component === "sounds")
    expect(sounds).toBeDefined()
    expect(sounds!.targets).toEqual(["opencode"])
    expect(sounds!.platforms).toEqual(["linux", "wsl", "darwin", "windows"])
    expect(sounds!.status).toBe("supported")
  })

  test("context-mode targets opencode with unknown status for claude", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    const cm = caps.find(c => c.component === "context-mode")
    expect(cm).toBeDefined()
    expect(cm!.targets).toEqual(["opencode"])
    expect(cm!.platforms).toEqual(["linux", "wsl", "darwin"])
    expect(cm!.status).toBe("supported")
  })

  test("tmux targets opencode on linux/wsl/darwin", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilities()
    const tmux = caps.find(c => c.component === "tmux")
    expect(tmux).toBeDefined()
    expect(tmux!.targets).toEqual(["opencode"])
    expect(tmux!.platforms).toEqual(["linux", "wsl", "darwin"])
    expect(tmux!.status).toBe("supported")
  })

  test("getCapabilitiesForTarget returns only matching capabilities", async () => {
    const { getCapabilitiesForTarget } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilitiesForTarget("opencode")
    expect(caps.length).toBeGreaterThan(0)
    expect(caps.every(c => c.targets.includes("opencode"))).toBe(true)
  })

  test("getCapabilitiesForTarget returns empty for claude (no components target claude yet)", async () => {
    const { getCapabilitiesForTarget } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const caps = getCapabilitiesForTarget("claude")
    expect(caps).toEqual([])
  })

  test("getCapabilitiesForPlatform filters by platform", async () => {
    const { getCapabilitiesForPlatform } = await import(`../src/components/registry.ts?t=${Date.now()}`)

    const windowsCaps = getCapabilitiesForPlatform("windows")
    const ids = windowsCaps.map(c => c.component).sort()
    // plugin, sounds, theme support windows; rtk, tmux, context-mode do not
    expect(ids).toEqual(["plugin", "sounds", "theme"])
  })

  test("every capability has valid ComponentId and required fields", async () => {
    const { getCapabilities } = await import(`../src/components/registry.ts?t=${Date.now()}`)
    const validIds: ComponentId[] = ["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"]

    const caps = getCapabilities()
    for (const cap of caps) {
      expect(validIds).toContain(cap.component)
      expect(cap.targets.length).toBeGreaterThan(0)
      expect(cap.platforms.length).toBeGreaterThan(0)
      expect(Array.isArray(cap.requires)).toBe(true)
      expect(["supported", "degraded", "unsupported", "unknown"]).toContain(cap.status)
    }
  })
})
