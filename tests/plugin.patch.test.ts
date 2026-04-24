// tests/plugin.patch.test.ts — tests for extractBetweenMarkers and patchSddPhaseCommon

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const loadPluginModule = () => import(`../src/components/plugin.ts?patch=${Date.now()}-${Math.random()}`)

// ── extractBetweenMarkers tests ──────────────────────────────

describe("extractBetweenMarkers", () => {
  const start = "<!-- start -->"
  const end = "<!-- end -->"

  test("extracts content between matching markers", async () => {
    const { extractBetweenMarkers } = await loadPluginModule()
    const content = `before<!-- start -->managed content<!-- end -->after`
    const result = extractBetweenMarkers(content, start, end)
    expect(result).not.toBeNull()
    expect(result!.before).toBe("before")
    expect(result!.managed).toBe("managed content")
    expect(result!.after).toBe("after")
  })

  test("returns null when only start marker exists", async () => {
    const { extractBetweenMarkers } = await loadPluginModule()
    const content = `before<!-- start -->some content without end`
    const result = extractBetweenMarkers(content, start, end)
    expect(result).toBeNull()
  })

  test("returns null when only end marker exists", async () => {
    const { extractBetweenMarkers } = await loadPluginModule()
    const content = `some content without start<!-- end -->after`
    const result = extractBetweenMarkers(content, start, end)
    expect(result).toBeNull()
  })

  test("returns null when no markers exist", async () => {
    const { extractBetweenMarkers } = await loadPluginModule()
    const content = "just some regular content"
    const result = extractBetweenMarkers(content, start, end)
    expect(result).toBeNull()
  })

  test("returns null for empty string", async () => {
    const { extractBetweenMarkers } = await loadPluginModule()
    const result = extractBetweenMarkers("", start, end)
    expect(result).toBeNull()
  })

  test("handles multiline content between markers", async () => {
    const { extractBetweenMarkers } = await loadPluginModule()
    const content = `header\n<!-- start -->\nline1\nline2\n<!-- end -->\nfooter`
    const result = extractBetweenMarkers(content, start, end)
    expect(result).not.toBeNull()
    expect(result!.managed).toBe("\nline1\nline2\n")
    expect(result!.before).toBe("header\n")
    expect(result!.after).toBe("\nfooter")
  })
})

// ── patchSddPhaseCommon tests ────────────────────────────────
// We test patchSddPhaseCommon by temporarily overriding HOME
// and creating a fake sdd-phase-common.md file.

describe("patchSddPhaseCommon", () => {
  const TEMP_HOME = join(tmpdir(), `cyberpunk-patch-test-${Date.now()}`)
  const SHARED_DIR = join(TEMP_HOME, ".config", "opencode", "skills", "_shared")
  const TARGET_FILE = join(SHARED_DIR, "sdd-phase-common.md")
  const ORIGINAL_HOME = process.env.HOME

  // We dynamically import after setting HOME
  // But since the module-level HOME is already computed, we need to test
  // by directly manipulating the file that patchSddPhaseCommon reads.
  // Instead, we'll test the logic by using the exported function directly
  // which reads from the real HOME path. For isolated testing, we'll
  // temporarily create the file at the real path if safe, or use a
  // different approach.

  // Better approach: test the patching logic by calling patchSddPhaseCommon
  // with the actual HOME. Since the function is idempotent, running it
  // on the actual file is safe. But for true unit tests, let's test
  // with a controlled environment.

  // We'll use the real sdd-phase-common.md for integration-style tests,
  // or we directly test the logic patterns.

  const REAL_SDD_PATH = join(
    process.env.HOME || "~",
    ".config", "opencode", "skills", "_shared", "sdd-phase-common.md"
  )

  // Store original content for restoration
  let originalContent: string | null = null

  beforeEach(() => {
    // Save original file if it exists
    if (existsSync(REAL_SDD_PATH)) {
      originalContent = readFileSync(REAL_SDD_PATH, "utf8")
    } else {
      originalContent = null
      mkdirSync(SHARED_DIR, { recursive: true })
    }
  })

  afterEach(() => {
    // Restore original content
    if (originalContent !== null) {
      writeFileSync(REAL_SDD_PATH, originalContent, "utf8")
    } else if (existsSync(REAL_SDD_PATH)) {
      rmSync(REAL_SDD_PATH)
    }
    // Clean up temp dir
    if (existsSync(TEMP_HOME)) {
      rmSync(TEMP_HOME, { recursive: true, force: true })
    }
  })

  test("fresh install: file exists with no markers → file written, returns true", async () => {
    const { START_MARKER, END_MARKER } = await loadPluginModule()
    // Write a file that has no markers
    const contentWithoutMarkers = `# SDD Phase Common

## A. Skill Loading

Some content here.

## B. Something Else

More content.`
    mkdirSync(join(REAL_SDD_PATH, ".."), { recursive: true })
    writeFileSync(REAL_SDD_PATH, contentWithoutMarkers, "utf8")

    // Dynamic re-import to get fresh function with current HOME
    const { patchSddPhaseCommon } = await loadPluginModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(true)

    const patched = readFileSync(REAL_SDD_PATH, "utf8")
    expect(patched).toContain(START_MARKER)
    expect(patched).toContain(END_MARKER)
    expect(patched).toContain("## E. Session Stats")
    // Original content preserved before markers
    expect(patched).toContain("## A. Skill Loading")
  })

  test("fresh install with existing Section E heading → replaces heading", async () => {
    const { END_MARKER, SECTION_E_TEMPLATE, START_MARKER } = await loadPluginModule()
    const contentWithE = `# SDD Phase Common

## A. Skill Loading

Some content.

## E. Old Stats Section

Old content that should be replaced.`
    mkdirSync(join(REAL_SDD_PATH, ".."), { recursive: true })
    writeFileSync(REAL_SDD_PATH, contentWithE, "utf8")

    const { patchSddPhaseCommon } = await loadPluginModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(true)

    const patched = readFileSync(REAL_SDD_PATH, "utf8")
    expect(patched).toContain(START_MARKER)
    expect(patched).toContain(END_MARKER)
    expect(patched).toContain(SECTION_E_TEMPLATE)
    // Old Section E should be gone
    expect(patched).not.toContain("Old Stats Section")
    // Sections before E preserved
    expect(patched).toContain("## A. Skill Loading")
  })

  test("no-op: file with matching marked section → returns false", async () => {
    const { END_MARKER, MANAGED_SDD_TEMPLATE, START_MARKER } = await loadPluginModule()
    // First, install the markers
    const markedSection = `\n${START_MARKER}\n${MANAGED_SDD_TEMPLATE}\n${END_MARKER}\n`
    const contentWithMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.${markedSection}`
    mkdirSync(join(REAL_SDD_PATH, ".."), { recursive: true })
    writeFileSync(REAL_SDD_PATH, contentWithMarkers, "utf8")

    const { patchSddPhaseCommon } = await loadPluginModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(false)

    // File should be unchanged
    const after = readFileSync(REAL_SDD_PATH, "utf8")
    expect(after).toBe(contentWithMarkers)
  })

  test("mismatch: file with mismatched marked section → file written, returns true", async () => {
    const { END_MARKER, SECTION_E_TEMPLATE, START_MARKER } = await loadPluginModule()
    const markedSection = `\n${START_MARKER}\n## E. Different Content\n\nThis is wrong.\n${END_MARKER}\n`
    const contentWithBadMarkers = `# SDD Phase Common\n\n## A. Skill Loading\n\nSome content.${markedSection}`
    mkdirSync(join(REAL_SDD_PATH, ".."), { recursive: true })
    writeFileSync(REAL_SDD_PATH, contentWithBadMarkers, "utf8")

    const { patchSddPhaseCommon } = await loadPluginModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(true)

    const patched = readFileSync(REAL_SDD_PATH, "utf8")
    expect(patched).toContain(START_MARKER)
    expect(patched).toContain(END_MARKER)
    expect(patched).toContain(SECTION_E_TEMPLATE)
    expect(patched).toContain("## F. RTK Routing")
    expect(patched).not.toContain("Different Content")
  })

  test("missing file: sdd-phase-common.md absent → returns false, no error", async () => {
    // Remove the file if it exists
    if (existsSync(REAL_SDD_PATH)) {
      rmSync(REAL_SDD_PATH)
    }

    const { patchSddPhaseCommon } = await loadPluginModule()
    const result = patchSddPhaseCommon()

    expect(result).toBe(false)
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
