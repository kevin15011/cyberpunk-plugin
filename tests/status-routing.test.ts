// tests/status-routing.test.ts — tests for status command with platform/agent detection

import { describe, test, expect } from "bun:test"
import type { AgentTarget, PlatformInfo } from "../src/domain/environment"
import type { AgentDetectResult } from "../src/detection/types"

describe("buildEnvironmentStatus", () => {
  async function getBuildEnvironmentStatus() {
    const mod = await import("../src/commands/status-routing")
    return mod.buildEnvironmentStatus
  }

  test("returns platform info with detected environment", async () => {
    const buildEnvironmentStatus = await getBuildEnvironmentStatus()
    const platform: PlatformInfo = { kind: "linux", arch: "x64", configRoot: "/home/user/.config" }
    const agents: Partial<Record<AgentTarget, AgentDetectResult>> = {
      opencode: { installed: true, version: "1.2.3" },
    }

    const result = buildEnvironmentStatus(platform, agents)
    expect(result.platform.kind).toBe("linux")
    expect(result.platform.arch).toBe("x64")
  })

  test("includes agent detection results", async () => {
    const buildEnvironmentStatus = await getBuildEnvironmentStatus()
    const platform: PlatformInfo = { kind: "darwin", arch: "arm64", configRoot: "/Users/user/.config" }
    const agents: Partial<Record<AgentTarget, AgentDetectResult>> = {
      opencode: { installed: true, version: "2.0.0", configPath: "/Users/user/.config/opencode" },
      claude: { installed: false },
    }

    const result = buildEnvironmentStatus(platform, agents)
    expect(result.agents).toBeDefined()
    expect(result.agents.opencode.installed).toBe(true)
    expect(result.agents.opencode.version).toBe("2.0.0")
    expect(result.agents.claude.installed).toBe(false)
  })

  test("handles empty agents gracefully", async () => {
    const buildEnvironmentStatus = await getBuildEnvironmentStatus()
    const platform: PlatformInfo = { kind: "windows", arch: "x64", configRoot: "C:\\Users\\user\\AppData\\Roaming" }

    const result = buildEnvironmentStatus(platform, {})
    expect(result.platform.kind).toBe("windows")
    expect(Object.keys(result.agents)).toHaveLength(0)
  })

  test("returns serializable object (no functions)", async () => {
    const buildEnvironmentStatus = await getBuildEnvironmentStatus()
    const platform: PlatformInfo = { kind: "linux", arch: "x64", configRoot: "/home/user/.config" }
    const agents: Partial<Record<AgentTarget, AgentDetectResult>> = {
      opencode: { installed: true },
    }

    const result = buildEnvironmentStatus(platform, agents)
    // JSON.stringify should work without errors
    const json = JSON.stringify(result)
    expect(json).toBeTruthy()
    const parsed = JSON.parse(json)
    expect(parsed.platform.kind).toBe("linux")
  })
})
