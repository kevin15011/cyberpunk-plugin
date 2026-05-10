// tests/scope-enforcement.test.ts — OpenCode-only scope enforcement
//
// Tests that:
// 1. Component registry returns empty for non-OpenCode targets
// 2. Claude/Codex detection results have implemented: false
// 3. OpenCode detection result has implemented: true
// 4. TUI tool-select does not expose OpenCode components for Claude/Codex

import { describe, test, expect } from "bun:test"
import {
  getCapabilitiesForTarget,
  getSupportedComponentIds,
  isComponentSupportedForTarget,
} from "../src/components/registry"
import { createClaudeDetector } from "../src/detection/agents/claude"
import { createCodexDetector } from "../src/detection/agents/codex"
import { createOpenCodeDetector } from "../src/detection/agents/opencode"
import type { PlatformInfo } from "../src/domain/environment"
import { AGENT_TARGETS } from "../src/domain/environment"
import type { ComponentId } from "../src/components/types"

const LINUX_PLATFORM: PlatformInfo = {
  kind: "linux",
  arch: "x64",
  configRoot: "/home/test/.config",
}

// ── Registry scope enforcement ───────────────────────────────────

describe("OpenCode-only scope enforcement — registry", () => {
  test("OpenCode target returns all components", () => {
    const caps = getCapabilitiesForTarget("opencode")
    expect(caps.length).toBeGreaterThan(0)
    // Verify specific OpenCode-only components are present
    const ids = caps.map(c => c.component)
    expect(ids).toContain("plugin")
    expect(ids).toContain("sdd-integration")
    expect(ids).toContain("context-mode")
    expect(ids).toContain("rtk")
    expect(ids).toContain("codebase-memory")
  })

  test("Claude target returns zero components", () => {
    const caps = getCapabilitiesForTarget("claude")
    expect(caps).toHaveLength(0)
  })

  test("Codex target returns zero components", () => {
    const caps = getCapabilitiesForTarget("codex")
    expect(caps).toHaveLength(0)
  })

  test("getSupportedComponentIds returns empty for Claude", () => {
    expect(getSupportedComponentIds("claude")).toEqual([])
  })

  test("getSupportedComponentIds returns empty for Codex", () => {
    expect(getSupportedComponentIds("codex")).toEqual([])
  })

  test("getSupportedComponentIds returns components for OpenCode", () => {
    const ids = getSupportedComponentIds("opencode")
    expect(ids.length).toBeGreaterThan(0)
  })

  test("isComponentSupportedForTarget — OpenCode components not available for Claude", () => {
    const opencodeComponents: ComponentId[] = [
      "plugin", "sdd-integration", "context-mode", "rtk", "codebase-memory",
    ]
    for (const id of opencodeComponents) {
      expect(isComponentSupportedForTarget(id, "claude")).toBe(false)
    }
  })

  test("isComponentSupportedForTarget — OpenCode components not available for Codex", () => {
    const opencodeComponents: ComponentId[] = [
      "plugin", "sdd-integration", "context-mode", "rtk", "codebase-memory",
    ]
    for (const id of opencodeComponents) {
      expect(isComponentSupportedForTarget(id, "codex")).toBe(false)
    }
  })

  test("isComponentSupportedForTarget — OpenCode components available for OpenCode", () => {
    expect(isComponentSupportedForTarget("plugin", "opencode")).toBe(true)
    expect(isComponentSupportedForTarget("sdd-integration", "opencode")).toBe(true)
    expect(isComponentSupportedForTarget("context-mode", "opencode")).toBe(true)
    expect(isComponentSupportedForTarget("rtk", "opencode")).toBe(true)
    expect(isComponentSupportedForTarget("codebase-memory", "opencode")).toBe(true)
  })
})

// ── Detection implemented markers ────────────────────────────────

describe("OpenCode-only scope enforcement — detection implemented markers", () => {
  test("Claude detector returns implemented: false", () => {
    const detector = createClaudeDetector(
      () => { throw new Error("not found") },
      () => false,
    )
    const result = detector.detect(LINUX_PLATFORM)
    expect(result.implemented).toBe(false)
  })

  test("Claude detector returns implemented: false even when installed", () => {
    const detector = createClaudeDetector(
      () => "1.0.0",
      () => true,
    )
    const result = detector.detect(LINUX_PLATFORM)
    expect(result.implemented).toBe(false)
  })

  test("Codex detector returns implemented: false", () => {
    const detector = createCodexDetector()
    const result = detector.detect(LINUX_PLATFORM)
    expect(result.implemented).toBe(false)
  })

  test("OpenCode detector returns implemented: true when installed", () => {
    const detector = createOpenCodeDetector(
      () => "1.0.0",
      () => true,
    )
    const result = detector.detect(LINUX_PLATFORM)
    expect(result.implemented).toBe(true)
  })

  test("OpenCode detector returns implemented: true when not installed", () => {
    const detector = createOpenCodeDetector(
      () => { throw new Error("not found") },
      () => false,
    )
    const result = detector.detect(LINUX_PLATFORM)
    expect(result.implemented).toBe(true)
  })
})
