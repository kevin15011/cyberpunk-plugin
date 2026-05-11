// tests/sdd-integration.test.ts — tests for sdd-integration component

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const loadSddModule = () => import(`../src/components/sdd-integration.ts?patch=${Date.now()}-${Math.random()}`)

const REQUIRED_SDD_ASSETS = [
  ["skills", "_shared", "sdd-phase-common.md"],
  ["skills", "sdd-propose", "SKILL.md"],
  ["skills", "sdd-spec", "SKILL.md"],
  ["skills", "sdd-design", "SKILL.md"],
  ["skills", "sdd-tasks", "SKILL.md"],
  ["skills", "sdd-apply", "SKILL.md"],
  ["skills", "sdd-review", "SKILL.md"],
  ["skills", "sdd-verify", "SKILL.md"],
  ["skills", "sdd-archive", "SKILL.md"],
]

function writeRequiredSddAssets(home: string) {
  for (const parts of REQUIRED_SDD_ASSETS) {
    const filePath = join(home, ".config", "opencode", ...parts)
    mkdirSync(join(filePath, ".."), { recursive: true })
    writeFileSync(filePath, parts.includes("sdd-phase-common.md") ? "# SDD Phase Common\n" : "---\nname: test\n---\n", "utf8")
  }
  const judgmentPath = join(home, ".config", "opencode", "skills", "judgment-day", "SKILL.md")
  mkdirSync(join(judgmentPath, ".."), { recursive: true })
  writeFileSync(judgmentPath, "---\nname: judgment-day\n---\n", "utf8")
}

function writeMinimalOpenCodeConfig(home: string) {
  const opencodeDir = join(home, ".config", "opencode")
  mkdirSync(opencodeDir, { recursive: true })
  writeFileSync(join(opencodeDir, "opencode.json"), JSON.stringify({
    agent: {
      "gentle-orchestrator": {
        prompt: "# Orchestrator\n\n### Review Workload Guard (MANDATORY)\n",
        permission: { task: {} },
      },
      "sdd-claude-review": { model: "anthropic/claude-opus" },
    },
  }), "utf8")
}

// ── extractBetweenMarkers tests ──────────────────────────────

describe("sdd-integration: extractBetweenMarkers", () => {
  const start = "<!-- start -->"
  const end = "<!-- end -->"

  test("extracts content between matching markers", async () => {
    const { extractBetweenMarkers } = await loadSddModule()
    const content = `before<!-- start -->managed content<!-- end -->after`
    const result = extractBetweenMarkers(content, start, end)
    expect(result).not.toBeNull()
    expect(result!.before).toBe("before")
    expect(result!.managed).toBe("managed content")
    expect(result!.after).toBe("after")
  })

  test("returns null when no markers exist", async () => {
    const { extractBetweenMarkers } = await loadSddModule()
    const result = extractBetweenMarkers("just some regular content", start, end)
    expect(result).toBeNull()
  })

  test("handles multiline content between markers", async () => {
    const { extractBetweenMarkers } = await loadSddModule()
    const content = `header\n<!-- start -->\nline1\nline2\n<!-- end -->\nfooter`
    const result = extractBetweenMarkers(content, start, end)
    expect(result).not.toBeNull()
    expect(result!.managed).toBe("\nline1\nline2\n")
  })
})

// ── patchSddPhaseCommon tests ────────────────────────────────

describe("sdd-integration: patchSddPhaseCommon", () => {
  const ORIGINAL_HOME = process.env.HOME
  let tempHome = ""
  let sharedDir = ""
  let targetFile = ""

  beforeEach(() => {
    tempHome = join(tmpdir(), `cyberpunk-sdd-test-${Date.now()}-${Math.random()}`)
    sharedDir = join(tempHome, ".config", "opencode", "skills", "_shared")
    targetFile = join(sharedDir, "sdd-phase-common.md")
    process.env.HOME = tempHome
    mkdirSync(sharedDir, { recursive: true })
  })

  afterEach(() => {
    if (ORIGINAL_HOME === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = ORIGINAL_HOME
    }
    if (tempHome && existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test("fresh install: file exists with no markers → file written, returns true", async () => {
    const { START_MARKER, END_MARKER } = await loadSddModule()
    const contentWithoutMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content here.`
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(targetFile, contentWithoutMarkers, "utf8")

    const { patchSddPhaseCommon } = await loadSddModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(true)

    const patched = readFileSync(targetFile, "utf8")
    expect(patched).toContain(START_MARKER)
    expect(patched).toContain(END_MARKER)
    expect(patched).toContain("## E. Session Stats")
  })

  test("fresh install with existing Section E heading → replaces heading", async () => {
    const { END_MARKER, SECTION_E_TEMPLATE, START_MARKER } = await loadSddModule()
    const contentWithE = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.\n\n## E. Old Stats Section\n\nOld content.`
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(targetFile, contentWithE, "utf8")

    const { patchSddPhaseCommon } = await loadSddModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(true)

    const patched = readFileSync(targetFile, "utf8")
    expect(patched).toContain(START_MARKER)
    expect(patched).toContain(END_MARKER)
    expect(patched).toContain(SECTION_E_TEMPLATE)
    expect(patched).not.toContain("Old Stats Section")
  })

  test("no-op: file with matching marked section → returns false", async () => {
    const { END_MARKER, MANAGED_SDD_TEMPLATE, START_MARKER } = await loadSddModule()
    const markedSection = `\n${START_MARKER}\n${MANAGED_SDD_TEMPLATE}\n${END_MARKER}\n`
    const contentWithMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.${markedSection}`
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(targetFile, contentWithMarkers, "utf8")

    const { patchSddPhaseCommon } = await loadSddModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(false)

    const after = readFileSync(targetFile, "utf8")
    expect(after).toBe(contentWithMarkers)
  })

  test("drift: file with mismatched marked section → file written, returns true", async () => {
    const { END_MARKER, SECTION_E_TEMPLATE, START_MARKER } = await loadSddModule()
    const markedSection = `\n${START_MARKER}\n## E. Different Content\n\nThis is wrong.\n${END_MARKER}\n`
    const contentWithBadMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.${markedSection}`
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(targetFile, contentWithBadMarkers, "utf8")

    const { patchSddPhaseCommon } = await loadSddModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(true)

    const patched = readFileSync(targetFile, "utf8")
    expect(patched).toContain(START_MARKER)
    expect(patched).toContain(END_MARKER)
    expect(patched).toContain(SECTION_E_TEMPLATE)
    expect(patched).toContain("## F. RTK Routing")
    expect(patched).not.toContain("Different Content")
  })

  test("missing file: sdd-phase-common.md absent → returns false, no error", async () => {
    if (existsSync(targetFile)) {
      rmSync(targetFile)
    }

    const { patchSddPhaseCommon } = await loadSddModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(false)
  })
})

// ── OpenCode SDD readiness gating ────────────────────────────────

describe("sdd-integration: OpenCode SDD readiness", () => {
  const ORIGINAL_HOME = process.env.HOME
  let tempHome = ""

  beforeEach(() => {
    tempHome = join(tmpdir(), `cyberpunk-sdd-readiness-${Date.now()}-${Math.random()}`)
    process.env.HOME = tempHome
    mkdirSync(tempHome, { recursive: true })
  })

  afterEach(() => {
    if (ORIGINAL_HOME === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = ORIGINAL_HOME
    }
    if (tempHome && existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test("readiness is satisfied only when all required OpenCode SDD assets exist", async () => {
    writeRequiredSddAssets(tempHome)

    const { detectOpenCodeSddReadiness } = await loadSddModule()
    const readiness = detectOpenCodeSddReadiness()

    expect(readiness.ready).toBe(true)
    expect(readiness.required.length).toBe(REQUIRED_SDD_ASSETS.length)
    expect(readiness.missingRequired).toEqual([])
  })

  test("readiness lists missing required phase skill assets", async () => {
    const sharedDir = join(tempHome, ".config", "opencode", "skills", "_shared")
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(join(sharedDir, "sdd-phase-common.md"), "# SDD Phase Common\n", "utf8")

    const { detectOpenCodeSddReadiness } = await loadSddModule()
    const readiness = detectOpenCodeSddReadiness()

    expect(readiness.ready).toBe(false)
    expect(readiness.missingRequired.some(path => path.includes("sdd-apply/SKILL.md"))).toBe(true)
    expect(readiness.missingRequired.some(path => path.includes("sdd-phase-common.md"))).toBe(false)
  })

  test("install skips and names missing assets when only sdd-phase-common exists", async () => {
    const sharedDir = join(tempHome, ".config", "opencode", "skills", "_shared")
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(join(sharedDir, "sdd-phase-common.md"), "# SDD Phase Common\n", "utf8")

    const { getSddIntegrationComponent } = await loadSddModule()
    const result = await getSddIntegrationComponent().install()

    expect(result.status).toBe("skipped")
    expect(result.message).toContain("sdd-apply/SKILL.md")
  })

  test("install bootstraps managed sdd-review skill when that is the only missing required asset", async () => {
    writeRequiredSddAssets(tempHome)
    const reviewPath = join(tempHome, ".config", "opencode", "skills", "sdd-review", "SKILL.md")
    rmSync(reviewPath)
    writeMinimalOpenCodeConfig(tempHome)

    const { getSddIntegrationComponent, SDD_REVIEW_START_MARKER } = await loadSddModule()
    const result = await getSddIntegrationComponent().install()

    expect(result.status).toBe("success")
    expect(existsSync(reviewPath)).toBe(true)
    expect(readFileSync(reviewPath, "utf8")).toContain(SDD_REVIEW_START_MARKER)
  })

  test("install bootstraps owned review asset but does not create external judgment-day skill", async () => {
    writeRequiredSddAssets(tempHome)
    const reviewPath = join(tempHome, ".config", "opencode", "skills", "sdd-review", "SKILL.md")
    const judgmentPath = join(tempHome, ".config", "opencode", "skills", "judgment-day", "SKILL.md")
    rmSync(reviewPath)
    rmSync(judgmentPath)
    writeMinimalOpenCodeConfig(tempHome)

    const { getSddIntegrationComponent, SDD_REVIEW_START_MARKER } = await loadSddModule()
    const result = await getSddIntegrationComponent().install()

    expect(result.status).toBe("success")
    expect(readFileSync(reviewPath, "utf8")).toContain(SDD_REVIEW_START_MARKER)
    expect(existsSync(judgmentPath)).toBe(false)
  })

  test("doctor does not pass when required SDD assets are missing", async () => {
    const sharedDir = join(tempHome, ".config", "opencode", "skills", "_shared")
    mkdirSync(sharedDir, { recursive: true })
    writeFileSync(join(sharedDir, "sdd-phase-common.md"), "# SDD Phase Common\n", "utf8")

    const { getSddIntegrationComponent } = await loadSddModule()
    const result = await getSddIntegrationComponent().doctor!({
      cyberpunkConfig: { version: 2, components: { "sdd-integration": { installed: true } } } as any,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false },
    })

    const readinessCheck = result.checks.find(check => check.id === "sdd-integration:readiness")
    expect(readinessCheck?.status).toBe("fail")
    expect(readinessCheck?.message).toContain("sdd-apply/SKILL.md")
  })

  test("status is installed only when all managed SDD patches are applied", async () => {
    writeRequiredSddAssets(tempHome)
    writeMinimalOpenCodeConfig(tempHome)
    const { getSddIntegrationComponent, patchSddPhaseCommon, patchSddReviewSkill, patchJudgmentDaySkill, patchOpenCodeSddOrchestrator } = await loadSddModule()

    expect(patchSddPhaseCommon()).toBe(true)
    expect(patchSddReviewSkill()).toBe(true)
    expect(patchJudgmentDaySkill()).toBe(true)
    expect(patchOpenCodeSddOrchestrator()).toBe(true)
    const status = await getSddIntegrationComponent().status()

    expect(status.status).toBe("installed")
  })

  test("orchestrator patch allows sdd-review and removes primary claude review", async () => {
    writeMinimalOpenCodeConfig(tempHome)
    const { patchOpenCodeSddOrchestrator, ORCHESTRATOR_REVIEW_GATE_START_MARKER, ORCHESTRATOR_JUDGMENT_DAY_START_MARKER } = await loadSddModule()

    expect(patchOpenCodeSddOrchestrator()).toBe(true)
    const opencodeJson = JSON.parse(readFileSync(join(tempHome, ".config", "opencode", "opencode.json"), "utf8"))

    expect(opencodeJson.agent["gentle-orchestrator"].prompt).toContain(ORCHESTRATOR_REVIEW_GATE_START_MARKER)
    expect(opencodeJson.agent["gentle-orchestrator"].prompt).toContain(ORCHESTRATOR_JUDGMENT_DAY_START_MARKER)
    expect(opencodeJson.agent["gentle-orchestrator"].prompt).toContain("Judge B MUST use `sdd-review-adversary`")
    expect(opencodeJson.agent["gentle-orchestrator"].permission.task["sdd-review"]).toBe("allow")
    expect(opencodeJson.agent["sdd-claude-review"]).toBeUndefined()
  })

  test("patches judgment-day to prefer review and adversary agents", async () => {
    writeRequiredSddAssets(tempHome)
    const { patchJudgmentDaySkill, JUDGMENT_DAY_START_MARKER } = await loadSddModule()

    expect(patchJudgmentDaySkill()).toBe(true)
    const content = readFileSync(join(tempHome, ".config", "opencode", "skills", "judgment-day", "SKILL.md"), "utf8")

    expect(content).toContain(JUDGMENT_DAY_START_MARKER)
    expect(content).toContain("Judge B: launch `sdd-review-adversary`")
  })
})

// ── unpatchSddPhaseCommon tests ────────────────────────────

describe("sdd-integration: unpatchSddPhaseCommon", () => {
  const ORIGINAL_HOME = process.env.HOME
  let tempHome = ""
  let sharedDir = ""
  let targetFile = ""

  beforeEach(() => {
    tempHome = join(tmpdir(), `cyberpunk-sdd-unpatch-${Date.now()}-${Math.random()}`)
    sharedDir = join(tempHome, ".config", "opencode", "skills", "_shared")
    targetFile = join(sharedDir, "sdd-phase-common.md")
    process.env.HOME = tempHome
    mkdirSync(sharedDir, { recursive: true })
  })

  afterEach(() => {
    if (ORIGINAL_HOME === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = ORIGINAL_HOME
    }
    if (tempHome && existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test("removes marker block while preserving surrounding content", async () => {
    const { START_MARKER, END_MARKER, MANAGED_SDD_TEMPLATE } = await loadSddModule()
    const before = "# Before\n\nSome content.\n\n"
    const after = "\n\n## After\n\nMore content."
    const content = `${before}${START_MARKER}\n${MANAGED_SDD_TEMPLATE}\n${END_MARKER}${after}`
    writeFileSync(targetFile, content, "utf8")

    const { unpatchSddPhaseCommon } = await loadSddModule()
    const result = unpatchSddPhaseCommon()

    expect(result).toBe(true)

    const cleaned = readFileSync(targetFile, "utf8")
    expect(cleaned).not.toContain(START_MARKER)
    expect(cleaned).not.toContain(END_MARKER)
    expect(cleaned).toContain("# Before")
    expect(cleaned).toContain("## After")
  })

  test("returns false when no markers exist", async () => {
    writeFileSync(targetFile, "# No markers here\n", "utf8")

    const { unpatchSddPhaseCommon } = await loadSddModule()
    const result = unpatchSddPhaseCommon()

    expect(result).toBe(false)
  })

  test("returns false when file doesn't exist", async () => {
    const { unpatchSddPhaseCommon } = await loadSddModule()
    const result = unpatchSddPhaseCommon()

    expect(result).toBe(false)
  })
})

// ── Plugin does not patch ────────────────────────────────────

describe("sdd-integration: plugin does not patch", () => {
  const ORIGINAL_HOME = process.env.HOME
  let tempHome = ""
  let sharedDir = ""
  let targetFile = ""

  beforeEach(() => {
    tempHome = join(tmpdir(), `cyberpunk-plugin-no-patch-${Date.now()}-${Math.random()}`)
    sharedDir = join(tempHome, ".config", "opencode", "skills", "_shared")
    targetFile = join(sharedDir, "sdd-phase-common.md")
    process.env.HOME = tempHome
    mkdirSync(sharedDir, { recursive: true })
  })

  afterEach(() => {
    if (ORIGINAL_HOME === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = ORIGINAL_HOME
    }
    if (tempHome && existsSync(tempHome)) {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test("plugin install does NOT touch sdd-phase-common.md", async () => {
    const contentWithoutMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.`
    writeFileSync(targetFile, contentWithoutMarkers, "utf8")

    // Load plugin module with current HOME
    const { getPluginComponent } = await import(`../src/components/plugin.ts?nptest-${Date.now()}`)
    const plugin = getPluginComponent()

    // Set up minimal config for plugin install
    const configDir = join(tempHome, ".config", "cyberpunk")
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      version: 2,
      components: {
        plugin: { installed: false },
        "sdd-integration": { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
        "tui-plugins": { installed: false },
        "codebase-memory": { installed: false },
      },
    }), "utf8")

    const result = await plugin.install()
    expect(result.status).toBe("success")

    // sdd-phase-common.md should be untouched
    const afterInstall = readFileSync(targetFile, "utf8")
    expect(afterInstall).toBe(contentWithoutMarkers)
  })
})
