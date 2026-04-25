// tests/detection-registry.test.ts — RED: assert registering an AgentDetector returns
// installed/version/path for OpenCode via shimmed execSync.

import { describe, test, expect } from "bun:test"
import type { PlatformInfo } from "../src/domain/environment"

// --- Helpers ---

function linuxPlatform(): PlatformInfo {
  return { kind: "linux", arch: "x64", configRoot: "/home/test/.config/cyberpunk" }
}

// ============================================================================
// Task 2.1 — Detection Registry + AgentDetector contract
// ============================================================================

describe("Detection Registry: detectAgents()", () => {
  test("returns installed/version/configPath for a registered OpenCode detector", async () => {
    const { detectAgents } = await import(`../src/detection/registry.ts?t=${Date.now()}`)
    const { AgentDetector, AgentDetectResult } = await import(`../src/detection/types.ts?t=${Date.now()}`)

    const mockDetector: AgentDetector = {
      target: "opencode",
      detect: (_platform: PlatformInfo): AgentDetectResult => ({
        installed: true,
        version: "1.2.3",
        configPath: "/home/test/.config/opencode",
      }),
    }

    const result = detectAgents([mockDetector], linuxPlatform())
    expect(result.opencode.installed).toBe(true)
    expect(result.opencode.version).toBe("1.2.3")
    expect(result.opencode.configPath).toBe("/home/test/.config/opencode")
  })

  test("returns installed=false when detector reports not installed", async () => {
    const { detectAgents } = await import(`../src/detection/registry.ts?t=${Date.now()}`)
    const { AgentDetector, AgentDetectResult } = await import(`../src/detection/types.ts?t=${Date.now()}`)

    const mockDetector: AgentDetector = {
      target: "opencode",
      detect: (): AgentDetectResult => ({ installed: false }),
    }

    const result = detectAgents([mockDetector], linuxPlatform())
    expect(result.opencode.installed).toBe(false)
    expect(result.opencode.version).toBeUndefined()
    expect(result.opencode.configPath).toBeUndefined()
  })

  test("supports multiple detectors for different targets", async () => {
    const { detectAgents } = await import(`../src/detection/registry.ts?t=${Date.now()}`)
    const { AgentDetector, AgentDetectResult } = await import(`../src/detection/types.ts?t=${Date.now()}`)

    const detectors: AgentDetector[] = [
      {
        target: "opencode",
        detect: (): AgentDetectResult => ({ installed: true, version: "1.0.0" }),
      },
      {
        target: "claude",
        detect: (): AgentDetectResult => ({ installed: false }),
      },
      {
        target: "codex",
        detect: (): AgentDetectResult => ({ installed: false }),
      },
    ]

    const result = detectAgents(detectors, linuxPlatform())
    expect(result.opencode.installed).toBe(true)
    expect(result.opencode.version).toBe("1.0.0")
    expect(result.claude.installed).toBe(false)
    expect(result.codex.installed).toBe(false)
  })

  test("returns empty record when no detectors provided", async () => {
    const { detectAgents } = await import(`../src/detection/registry.ts?t=${Date.now()}`)

    const result = detectAgents([], linuxPlatform())
    expect(Object.keys(result)).toHaveLength(0)
  })
})

// ============================================================================
// OpenCode detector via shimmed execSync
// ============================================================================

describe("OpenCode detector (createOpenCodeDetector)", () => {
  test("returns installed with version when execFn succeeds", async () => {
    const mod = await import(`../src/detection/agents/opencode.ts?t=${Date.now()}`)
    const detector = mod.createOpenCodeDetector(() => "opencode v1.5.0\n")

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(true)
    expect(result.version).toBe("opencode v1.5.0")
  })

  test("returns not installed when execFn throws", async () => {
    const mod = await import(`../src/detection/agents/opencode.ts?t=${Date.now()}`)
    const detector = mod.createOpenCodeDetector(() => {
      throw new Error("command not found: opencode")
    })

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(false)
    expect(result.version).toBeUndefined()
    expect(result.configPath).toBeUndefined()
  })

  test("target property is 'opencode'", async () => {
    const mod = await import(`../src/detection/agents/opencode.ts?t=${Date.now()}`)
    const detector = mod.createOpenCodeDetector(() => "1.0.0")
    expect(detector.target).toBe("opencode")
  })

  test("returns configPath when config directory exists", async () => {
    const mod = await import(`../src/detection/agents/opencode.ts?t=${Date.now()}`)
    // Provide a mock existsFn that always returns true
    const detector = mod.createOpenCodeDetector(
      () => "opencode v1.0.0",
      () => true  // existsFn shim — config dir present
    )

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(true)
    expect(result.configPath).toBeDefined()
    expect(typeof result.configPath).toBe("string")
  })

  test("omits configPath when config directory absent", async () => {
    const mod = await import(`../src/detection/agents/opencode.ts?t=${Date.now()}`)
    const detector = mod.createOpenCodeDetector(
      () => "opencode v1.0.0",
      () => false  // existsFn shim — config dir absent
    )

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(true)
    expect(result.configPath).toBeUndefined()
  })

  test("detect never throws even when execFn and existsFn both fail", async () => {
    const mod = await import(`../src/detection/agents/opencode.ts?t=${Date.now()}`)
    const detector = mod.createOpenCodeDetector(
      () => { throw new Error("ENOENT") },
      () => { throw new Error("permission denied") }
    )

    // Should not throw — detector must be safe
    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(false)
  })
})
