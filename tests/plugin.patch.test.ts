// tests/plugin.patch.test.ts — tests for PLUGIN_SOURCE (sound hooks only, no SDD patching)

import { describe, test, expect } from "bun:test"

const loadPluginModule = () => import(`../src/components/plugin.ts?patch=${Date.now()}-${Math.random()}`)

// ── PLUGIN_SOURCE must NOT contain SDD patching code ──────────

describe("PLUGIN_SOURCE: no SDD patching code", () => {
  test("must NOT contain SDD_PHASE_COMMON_PATH", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("SDD_PHASE_COMMON_PATH")
  })

  test("must NOT contain START_MARKER or END_MARKER constants", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("cyberpunk:start:section-e")
    expect(PLUGIN_SOURCE).not.toContain("cyberpunk:end:section-e")
  })

  test("must NOT contain MANAGED_SDD_TEMPLATE", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("MANAGED_SDD_TEMPLATE")
  })

  test("must NOT contain patchSddPhaseCommon function", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("patchSddPhaseCommon")
  })

  test("must NOT contain extractBetweenMarkers function", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("extractBetweenMarkers")
  })

  test("must NOT contain SECTION_E_TEMPLATE or SECTION_F_TEMPLATE", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("SECTION_E_TEMPLATE")
    expect(PLUGIN_SOURCE).not.toContain("SECTION_F_TEMPLATE")
  })

  test("must NOT contain writeFileSync import (runtime patching)", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("writeFileSync")
  })

  test("must NOT contain readFileSync import (runtime patching)", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("readFileSync")
  })
})

// ── Sound Interaction Trigger Tests ────────────────────────────

describe("PLUGIN_SOURCE: sound interaction trigger fix", () => {
  // 3.1 — session.idle handler must exist
  test("must contain session.idle completion handler", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain('event.type === "session.idle"')
  })

  // 3.2 — throttle constant exists
  test("must contain COMPLETION_THROTTLE_MS = 2000 constant", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain("COMPLETION_THROTTLE_MS = 2000")
  })

  // 3.3 — throttle tracking variable exists
  test("must contain lastCompletionTime variable declaration", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain("let lastCompletionTime = 0")
  })

  // 3.4 — throttle guard pattern inside completion handler
  test("must contain throttle guard in completion handler", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain("now - lastCompletionTime > COMPLETION_THROTTLE_MS")
  })

  // 3.5 — permission.asked handler preserved
  test("must preserve permission.asked handler", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain('event.type === "permission.asked"')
    expect(PLUGIN_SOURCE).toContain('playSound($, "permission.wav")')
  })

  // 3.6 — session.error handler preserved
  test("must preserve session.error handler", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain('event.type === "session.error"')
    expect(PLUGIN_SOURCE).toContain('playSound($, "error.wav")')
  })

  // 3.7 — session.compacted handler preserved
  test("must preserve session.compacted handler", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain('event.type === "session.compacted"')
    expect(PLUGIN_SOURCE).toContain('playSound($, "compact.wav")')
  })

  // 3.8 — idle.wav filename unchanged for completion
  test("must use idle.wav for completion sound", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain('playSound($, "idle.wav")')
  })

  // 3.9 — session.status idle completion behavior encoded
  test("must gate completion on session.status idle", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).toContain('event.type === "session.status"')
    expect(PLUGIN_SOURCE).toContain('status?.type === "idle"')
  })

  // 3.10 — message.updated completion handler must be gone
  test("must NOT contain message.updated completion handler", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain('event.type === "message.updated"')
    expect(PLUGIN_SOURCE).not.toContain("info?.finish")
  })

  // 3.11 — dead code lastSoundTime must be gone
  test("must NOT contain dead lastSoundTime variable", async () => {
    const { PLUGIN_SOURCE } = await loadPluginModule()
    expect(PLUGIN_SOURCE).not.toContain("lastSoundTime")
  })
})
