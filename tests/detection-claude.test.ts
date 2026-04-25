// tests/detection-claude.test.ts — RED: assert Claude probe returns `installed`
// when binary shim present, `unsupported` when absent, `unknown` on error.

import { describe, test, expect } from "bun:test"
import type { PlatformInfo } from "../src/domain/environment"

// --- Helpers ---

function linuxPlatform(): PlatformInfo {
  return { kind: "linux", arch: "x64", configRoot: "/home/test/.config/cyberpunk" }
}

function windowsPlatform(): PlatformInfo {
  return { kind: "windows", arch: "x64", configRoot: "C:\\Users\\test\\AppData\\Roaming\\cyberpunk" }
}

function darwinPlatform(): PlatformInfo {
  return { kind: "darwin", arch: "arm64", configRoot: "/Users/test/.config/cyberpunk" }
}

// ============================================================================
// Task 5.1 — Claude Safe Detection
// ============================================================================

describe("Claude detector (createClaudeDetector)", () => {
  test("returns target 'claude'", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(() => "claude 1.0.0")
    expect(detector.target).toBe("claude")
  })

  test("returns installed with version and status 'installed' when execFn succeeds", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(() => "claude 1.2.3\n")

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(true)
    expect(result.version).toBe("claude 1.2.3")
    expect(result.status).toBe("installed")
  })

  test("returns configPath on POSIX when existsFn finds ~/.claude", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(
      () => "claude 1.0.0",
      (path: string) => path.endsWith(".claude") || path.endsWith("claude")
    )

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(true)
    expect(result.configPath).toBeDefined()
    expect(result.configPath).toContain(".claude")
  })

  test("returns configPath on Windows when existsFn finds APPDATA/claude", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(
      () => "claude 1.0.0",
      (path: string) => path.includes("claude")
    )

    const result = detector.detect(windowsPlatform())
    expect(result.installed).toBe(true)
    expect(result.configPath).toBeDefined()
  })

  test("returns installed=false and status 'unsupported' when binary not found", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(() => {
      throw new Error("command not found: claude")
    })

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(false)
    expect(result.version).toBeUndefined()
    expect(result.configPath).toBeUndefined()
    expect(result.status).toBe("unsupported")
  })

  test("returns status 'unknown' with rationale when execFn throws unexpected error", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(() => {
      throw new Error("EACCES: permission denied")
    })

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(false)
    expect(result.status).toBe("unknown")
    expect(result.rationale).toBeDefined()
    expect(typeof result.rationale).toBe("string")
  })

  test("detect never throws even when execFn and existsFn both fail", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(
      () => { throw new Error("ENOENT") },
      () => { throw new Error("permission denied") }
    )

    // Should not throw — detector must be safe
    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(false)
  })

  test("omits configPath when config directory absent on POSIX", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(
      () => "claude 1.0.0",
      () => false
    )

    const result = detector.detect(linuxPlatform())
    expect(result.installed).toBe(true)
    expect(result.configPath).toBeUndefined()
  })

  test("resolves Windows config path using USERPROFILE fallback", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    // On Linux runners APPDATA is unset; detector falls back to USERPROFILE/.claude
    // or os.homedir()/.claude — accept any .claude path
    const detector = mod.createClaudeDetector(
      () => "claude 1.0.0",
      (p: string) => p.endsWith(".claude")
    )

    const result = detector.detect(windowsPlatform())
    expect(result.installed).toBe(true)
    expect(result.configPath).toBeDefined()
    expect(result.configPath).toContain(".claude")
  })

  test("works on darwin platform", async () => {
    const mod = await import(`../src/detection/agents/claude.ts?t=${Date.now()}`)
    const detector = mod.createClaudeDetector(
      () => "claude 2.0.0",
      () => false
    )

    const result = detector.detect(darwinPlatform())
    expect(result.installed).toBe(true)
    expect(result.version).toBe("claude 2.0.0")
    expect(result.status).toBe("installed")
  })
})
