// tests/detection-recommend.test.ts — RED: given OpenCode+RTK prerequisites met,
// recommend rtk as install; given missing prereqs, recommend defer with reason.

import { describe, test, expect } from "bun:test"
import type { ComponentCapability, AgentTarget, PlatformInfo } from "../src/domain/environment"
import type { AgentDetectResult } from "../src/detection/types"

// --- Helpers ---

function linuxPlatform(): PlatformInfo {
  return { kind: "linux", arch: "x64", configRoot: "/home/test/.config/cyberpunk" }
}

function windowsPlatform(): PlatformInfo {
  return { kind: "windows", arch: "x64", configRoot: "C:\\Users\\Test\\AppData\\Roaming\\cyberpunk" }
}

function installedOpenCode(): Record<AgentTarget, AgentDetectResult> {
  return {
    opencode: { installed: true, version: "1.0.0" },
    claude: { installed: false },
    codex: { installed: false },
  }
}

function noAgentsInstalled(): Record<AgentTarget, AgentDetectResult> {
  return {
    opencode: { installed: false },
    claude: { installed: false },
    codex: { installed: false },
  }
}

function rtkCapability(platforms: PlatformInfo["kind"][] = ["linux", "wsl", "darwin"]): ComponentCapability {
  return {
    component: "rtk",
    targets: ["opencode"],
    platforms,
    requires: [],
    status: "supported",
  }
}

// ============================================================================
// Task 2.3 — Recommendation engine
// ============================================================================

describe("generateRecommendations()", () => {
  test("recommends install when OpenCode installed and RTK prerequisites met", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    const recs = generateRecommendations(
      [rtkCapability()],
      installedOpenCode(),
      linuxPlatform()
    )

    const rtkRec = recs.find(r => r.component === "rtk")
    expect(rtkRec).toBeDefined()
    expect(rtkRec!.action).toBe("install")
    expect(rtkRec!.target).toBe("opencode")
    expect(rtkRec!.priority).toBe("high")
  })

  test("recommends defer when target agent not installed", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    const recs = generateRecommendations(
      [rtkCapability()],
      noAgentsInstalled(),
      linuxPlatform()
    )

    const rtkRec = recs.find(r => r.component === "rtk")
    expect(rtkRec).toBeDefined()
    expect(rtkRec!.action).toBe("defer")
    expect(rtkRec!.reason).toMatch(/opencode/i)
  })

  test("recommends skip when platform unsupported", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    // RTK only on linux/wsl/darwin — not windows
    const recs = generateRecommendations(
      [rtkCapability()],
      installedOpenCode(),
      windowsPlatform()
    )

    const rtkRec = recs.find(r => r.component === "rtk")
    expect(rtkRec).toBeDefined()
    expect(rtkRec!.action).toBe("skip")
    expect(rtkRec!.reason).toMatch(/platform|windows/i)
  })

  test("produces empty recommendations for empty capabilities", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    const recs = generateRecommendations([], installedOpenCode(), linuxPlatform())
    expect(recs).toEqual([])
  })

  test("recommends warn for unknown status capabilities", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    const unknownCap: ComponentCapability = {
      component: "context-mode",
      targets: ["claude"],
      platforms: ["linux", "darwin"],
      requires: [],
      status: "unknown",
    }

    const recs = generateRecommendations(
      [unknownCap],
      { opencode: { installed: false }, claude: { installed: true, version: "0.1.0" }, codex: { installed: false } },
      linuxPlatform()
    )

    const rec = recs.find(r => r.component === "context-mode")
    expect(rec).toBeDefined()
    expect(rec!.action).toBe("warn")
    expect(rec!.reason).toMatch(/unknown|unverified|not verified/i)
  })

  test("recommends skip for unsupported status capabilities", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    const unsupportedCap: ComponentCapability = {
      component: "tmux",
      targets: ["opencode"],
      platforms: ["windows"],
      requires: [],
      status: "unsupported",
    }

    const recs = generateRecommendations(
      [unsupportedCap],
      installedOpenCode(),
      windowsPlatform()
    )

    const rec = recs.find(r => r.component === "tmux")
    expect(rec).toBeDefined()
    expect(rec!.action).toBe("skip")
    expect(rec!.reason).toMatch(/unsupported/i)
  })

  test("handles multiple capabilities producing mixed recommendations", async () => {
    const { generateRecommendations } = await import(`../src/detection/recommend.ts?t=${Date.now()}`)

    const caps: ComponentCapability[] = [
      rtkCapability(),
      {
        component: "plugin",
        targets: ["opencode"],
        platforms: ["linux", "wsl", "darwin", "windows"],
        requires: [],
        status: "supported",
      },
      {
        component: "context-mode",
        targets: ["claude"],
        platforms: ["linux", "darwin"],
        requires: [],
        status: "unknown",
      },
    ]

    const recs = generateRecommendations(caps, installedOpenCode(), linuxPlatform())
    expect(recs).toHaveLength(3)

    const rtkRec = recs.find(r => r.component === "rtk")
    expect(rtkRec!.action).toBe("install")

    const pluginRec = recs.find(r => r.component === "plugin")
    expect(pluginRec!.action).toBe("install")

    const cmRec = recs.find(r => r.component === "context-mode")
    expect(cmRec!.action).toBe("warn")
  })
})
