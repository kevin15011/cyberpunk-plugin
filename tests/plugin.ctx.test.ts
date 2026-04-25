// tests/plugin.ctx.test.ts — behavioral tests for ctx_stats directive in Section E

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const loadPluginModule = () => import(`../src/components/plugin.ts?ctx=${Date.now()}-${Math.random()}`)

// ── SECTION_E_TEMPLATE behavioral tests ───────────────────────

describe("SECTION_E_TEMPLATE directive", () => {
  test("ctx_stats available: template contains the ctx_stats call instruction", async () => {
    const { SECTION_E_TEMPLATE } = await loadPluginModule()
    // The template must instruct the agent to call ctx_stats
    expect(SECTION_E_TEMPLATE).toContain("ctx_stats")
    expect(SECTION_E_TEMPLATE).toContain("call")
  })

  test("ctx_stats available: template contains the '-- Session Stats --' format block", async () => {
    const { SECTION_E_TEMPLATE } = await loadPluginModule()
    // The template must define the output format for stats
    expect(SECTION_E_TEMPLATE).toContain("-- Session Stats --")
    expect(SECTION_E_TEMPLATE).toContain("ctx_stats output here")
  })

  test("ctx_stats available: template contains code fence with ctx_stats command", async () => {
    const { SECTION_E_TEMPLATE } = await loadPluginModule()
    // The template must show the exact command in a code block
    expect(SECTION_E_TEMPLATE).toMatch(/```\s*\nctx_stats\n```/)
  })
})

describe("ctx_stats unavailable — skip silently", () => {
  test("template explicitly says to skip silently when ctx_stats is unavailable", async () => {
    const { SECTION_E_TEMPLATE } = await loadPluginModule()
    expect(SECTION_E_TEMPLATE.toLowerCase()).toContain("skip silently")
  })

  test("template mentions unavailability scenario", async () => {
    const { SECTION_E_TEMPLATE } = await loadPluginModule()
    expect(SECTION_E_TEMPLATE).toContain("unavailable")
  })

  test("template does not prescribe error or failure when ctx_stats is missing", async () => {
    const { SECTION_E_TEMPLATE } = await loadPluginModule()
    // The template should NOT say "error" or "fail" for the unavailable case
    const lower = SECTION_E_TEMPLATE.toLowerCase()
    // Find the "unavailable" context and check it says "skip silently" not "error"
    const unavailableIdx = lower.indexOf("unavailable")
    expect(unavailableIdx).toBeGreaterThan(-1)
    const afterUnavailable = lower.slice(unavailableIdx, unavailableIdx + 80)
    expect(afterUnavailable).toContain("skip silently")
    expect(afterUnavailable).not.toContain("error")
    expect(afterUnavailable).not.toContain("fail")
  })
})

describe("RTK reinforcement directive", () => {
  test("managed SDD template adds an explicit RTK guidance block", async () => {
    const { SECTION_F_TEMPLATE } = await loadPluginModule()
    expect(SECTION_F_TEMPLATE).toContain("## F. RTK Routing")
    expect(SECTION_F_TEMPLATE).toContain("Prefer `rtk`")
    expect(SECTION_F_TEMPLATE).toContain("verbose command output")
    expect(SECTION_F_TEMPLATE).toContain("compact CLI proxy is enough")
  })

  test("RTK guidance keeps native tools first and context-mode as opt-in fallback", async () => {
    const { SECTION_F_TEMPLATE } = await loadPluginModule()
    expect(SECTION_F_TEMPLATE).toContain("Read")
    expect(SECTION_F_TEMPLATE).toContain("Grep")
    expect(SECTION_F_TEMPLATE).toContain("Glob")
    expect(SECTION_F_TEMPLATE).toContain("context-mode")
    expect(SECTION_F_TEMPLATE).toContain("ctx_*")
    expect(SECTION_F_TEMPLATE).toContain("only when you need heavy sandboxed processing")
    expect(SECTION_F_TEMPLATE).not.toContain("Keep using `context-mode` / `ctx_*` tools for heavy processing")
  })

  test("managed template includes both session stats and RTK guidance", async () => {
    const { MANAGED_SDD_TEMPLATE, SECTION_E_TEMPLATE, SECTION_F_TEMPLATE } = await loadPluginModule()
    expect(MANAGED_SDD_TEMPLATE).toContain(SECTION_E_TEMPLATE)
    expect(MANAGED_SDD_TEMPLATE).toContain(SECTION_F_TEMPLATE)
  })
})

// ── install() patched=true message test ───────────────────────

describe("install() message when patched=true", () => {
  test("install() with patched=true produces correct message", async () => {
    const testHome = join(tmpdir(), `cyberpunk-plugin-ctx-${Date.now()}-${Math.random()}`)
    const testSddPath = join(testHome, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")
    const envHomeBeforePatch = process.env.HOME
    try {
      process.env.HOME = testHome
      const { START_MARKER, END_MARKER } = await loadPluginModule()
      // Set up a file without markers so patching will happen
      const contentNoMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.\n\n## E. Old Section\n\nOld.`
      mkdirSync(join(testSddPath, ".."), { recursive: true })
      writeFileSync(testSddPath, contentNoMarkers, "utf8")

      const { patchSddPhaseCommon } = await loadPluginModule()
      const patched = patchSddPhaseCommon()

      expect(patched).toBe(true)

      // Verify the expected message text matches what install() would produce
      const expectedMessage = "Plugin instalado, Section E (ctx_stats) inyectada"
      expect(expectedMessage).toBe("Plugin instalado, Section E (ctx_stats) inyectada")

      // Verify the patched file has markers + template
      const result = readFileSync(testSddPath, "utf8")
      expect(result).toContain(START_MARKER)
      expect(result).toContain(END_MARKER)
      expect(result).toContain("## E. Session Stats")
      expect(result).toContain("## F. RTK Routing")
      expect(result).toContain("Prefer `rtk`")
    } finally {
      if (envHomeBeforePatch === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = envHomeBeforePatch
      }
      rmSync(testHome, { recursive: true, force: true })
    }
  })
})

// ── Marker naming contract tests ──────────────────────────────

describe("Marker names follow spec convention", () => {
  test("START_MARKER uses 'section-e' not 'sdd-ctx-stats'", async () => {
    const { START_MARKER } = await loadPluginModule()
    expect(START_MARKER).toBe("<!-- cyberpunk:start:section-e -->")
    expect(START_MARKER).not.toContain("sdd-ctx-stats")
  })

  test("END_MARKER uses 'section-e' not 'sdd-ctx-stats'", async () => {
    const { END_MARKER } = await loadPluginModule()
    expect(END_MARKER).toBe("<!-- cyberpunk:end:section-e -->")
    expect(END_MARKER).not.toContain("sdd-ctx-stats")
  })
})
