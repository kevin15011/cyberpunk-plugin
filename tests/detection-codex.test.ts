// tests/detection-codex.test.ts — RED: assert Codex probe always returns `unknown` with rationale.

import { describe, test, expect } from "bun:test"
import type { PlatformInfo } from "../src/domain/environment"

// --- Helpers ---

function linuxPlatform(): PlatformInfo {
  return { kind: "linux", arch: "x64", configRoot: "/home/test/.config/cyberpunk" }
}

function windowsPlatform(): PlatformInfo {
  return { kind: "windows", arch: "x64", configRoot: "C:\\Users\\test\\AppData\\Roaming\\cyberpunk" }
}

// ============================================================================
// Task 5.3 — Codex Safe Detection
// ============================================================================

describe("Codex detector (createCodexDetector)", () => {
  test("returns target 'codex'", async () => {
    const mod = await import(`../src/detection/agents/codex.ts?t=${Date.now()}`)
    const detector = mod.createCodexDetector()
    expect(detector.target).toBe("codex")
  })

  test("always returns installed=false and status 'unknown'", async () => {
    const mod = await import(`../src/detection/agents/codex.ts?t=${Date.now()}`)
    const detector = mod.createCodexDetector()

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(false)
    expect(result.status).toBe("unknown")
  })

  test("always returns a rationale explaining why it is unknown", async () => {
    const mod = await import(`../src/detection/agents/codex.ts?t=${Date.now()}`)
    const detector = mod.createCodexDetector()

    const result = detector.detect(linuxPlatform())
    expect(result.rationale).toBeDefined()
    expect(typeof result.rationale).toBe("string")
    expect(result.rationale!.length).toBeGreaterThan(0)
  })

  test("rationale mentions cannot be verified safely", async () => {
    const mod = await import(`../src/detection/agents/codex.ts?t=${Date.now()}`)
    const detector = mod.createCodexDetector()

    const result = detector.detect(linuxPlatform())
    expect(result.rationale).toMatch(/cannot be verified safely/i)
  })

  test("never throws, even on any platform", async () => {
    const mod = await import(`../src/detection/agents/codex.ts?t=${Date.now()}`)
    const detector = mod.createCodexDetector()

    // Must not throw on any platform
    const linuxResult = detector.detect(linuxPlatform())
    expect(linuxResult.installed).toBe(false)

    const windowsResult = detector.detect(windowsPlatform())
    expect(windowsResult.installed).toBe(false)
  })

  test("does not set version or configPath", async () => {
    const mod = await import(`../src/detection/agents/codex.ts?t=${Date.now()}`)
    const detector = mod.createCodexDetector()

    const result = detector.detect(linuxPlatform())
    expect(result.version).toBeUndefined()
    expect(result.configPath).toBeUndefined()
  })
})
