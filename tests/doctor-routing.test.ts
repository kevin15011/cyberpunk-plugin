// tests/doctor-routing.test.ts — tests for doctor command with detection registry integration

import { describe, test, expect } from "bun:test"
import type { AgentTarget, PlatformInfo } from "../src/domain/environment"
import type { AgentDetectResult } from "../src/detection/types"

describe("buildAgentChecks", () => {
  // We import dynamically to allow the module to be created
  async function getBuildAgentChecks() {
    const mod = await import("../src/commands/doctor")
    return mod.buildAgentChecks
  }

  test("produces check for each installed agent", async () => {
    const buildAgentChecks = await getBuildAgentChecks()
    const platform: PlatformInfo = { kind: "linux", arch: "x64", configRoot: "/home/user/.config" }
    const agents: Partial<Record<AgentTarget, AgentDetectResult>> = {
      opencode: { installed: true, version: "1.0.0" },
    }

    const checks = buildAgentChecks(agents, platform)
    expect(checks.length).toBeGreaterThanOrEqual(1)

    const oc = checks.find(c => c.id === "agent:opencode")
    expect(oc).toBeDefined()
    expect(oc!.status).toBe("pass")
    expect(oc!.message).toMatch(/opencode.*1\.0\.0/i)
  })

  test("reports uninstalled agent as warn", async () => {
    const buildAgentChecks = await getBuildAgentChecks()
    const platform: PlatformInfo = { kind: "linux", arch: "x64", configRoot: "/home/user/.config" }
    const agents: Partial<Record<AgentTarget, AgentDetectResult>> = {
      opencode: { installed: false },
    }

    const checks = buildAgentChecks(agents, platform)
    const oc = checks.find(c => c.id === "agent:opencode")
    expect(oc).toBeDefined()
    expect(oc!.status).toBe("warn")
  })

  test("produces only platform check for empty agents record", async () => {
    const buildAgentChecks = await getBuildAgentChecks()
    const platform: PlatformInfo = { kind: "linux", arch: "x64", configRoot: "/home/user/.config" }

    const checks = buildAgentChecks({}, platform)
    // No agent checks, but still a platform check
    expect(checks.length).toBe(1)
    expect(checks[0].id).toBe("agent:platform")
  })

  test("reports platform kind in checks", async () => {
    const buildAgentChecks = await getBuildAgentChecks()
    const platform: PlatformInfo = { kind: "darwin", arch: "arm64", configRoot: "/Users/user/.config" }
    const agents: Partial<Record<AgentTarget, AgentDetectResult>> = {
      opencode: { installed: true, version: "2.0.0" },
    }

    const checks = buildAgentChecks(agents, platform)
    const platCheck = checks.find(c => c.id === "agent:platform")
    expect(platCheck).toBeDefined()
    expect(platCheck!.message).toMatch(/darwin/i)
  })
})
