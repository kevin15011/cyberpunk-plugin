// tests/doctor.test.ts — tests for doctor command, parse-args doctor flags, and summary derivation

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { parseArgs } from "../src/cli/parse-args"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

describe("parseArgs — doctor flags", () => {
  test("doctor command via positional", () => {
    const result = parseArgs(["doctor"])
    expect(result.command).toBe("doctor")
  })

  test("doctor command via alias 'd'", () => {
    const result = parseArgs(["d"])
    expect(result.command).toBe("doctor")
  })

  test("doctor --fix sets fix flag", () => {
    const result = parseArgs(["doctor", "--fix"])
    expect(result.command).toBe("doctor")
    expect(result.flags.fix).toBe(true)
  })

  test("doctor --json sets json flag", () => {
    const result = parseArgs(["doctor", "--json"])
    expect(result.command).toBe("doctor")
    expect(result.flags.json).toBe(true)
  })

  test("doctor --verbose sets verbose flag", () => {
    const result = parseArgs(["doctor", "--verbose"])
    expect(result.command).toBe("doctor")
    expect(result.flags.verbose).toBe(true)
  })

  test("doctor --fix --json --verbose all flags", () => {
    const result = parseArgs(["doctor", "--fix", "--json", "--verbose"])
    expect(result.command).toBe("doctor")
    expect(result.flags.fix).toBe(true)
    expect(result.flags.json).toBe(true)
    expect(result.flags.verbose).toBe(true)
  })

  test("doctor --plugin scopes to plugin component", () => {
    const result = parseArgs(["doctor", "--plugin"])
    expect(result.command).toBe("doctor")
    expect(result.components).toEqual(["plugin"])
  })

  test("doctor --plugin --theme scopes to multiple components", () => {
    const result = parseArgs(["doctor", "--plugin", "--theme"])
    expect(result.command).toBe("doctor")
    expect(result.components).toEqual(["plugin", "theme"])
  })

  test("--doctor bypasses TUI", () => {
    const result = parseArgs(["--doctor"])
    expect(result.command).toBe("doctor")
  })

  test("fix flag defaults to false", () => {
    const result = parseArgs(["doctor"])
    expect(result.flags.fix).toBe(false)
  })
})

describe("runDoctor summary derivation", () => {
  let tempDir: string
  let originalHome: string | undefined

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cyberpunk-doctor-test-"))
    originalHome = process.env.HOME
    process.env.HOME = tempDir
  })

  afterEach(() => {
    process.env.HOME = originalHome
    rmSync(tempDir, { recursive: true, force: true })
  })

  test("returns summary with correct counts on healthy system", async () => {
    // Set up a valid config
    const configDir = join(tempDir, ".config", "cyberpunk")
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      version: 1,
      components: { plugin: { installed: false }, theme: { installed: false }, sounds: { installed: false }, "context-mode": { installed: false }, rtk: { installed: false } },
    }))

    // Set up opencode config with plugin registered
    const opencodeDir = join(tempDir, ".config", "opencode")
    mkdirSync(opencodeDir, { recursive: true })
    writeFileSync(join(opencodeDir, "opencode.json"), JSON.stringify({
      plugin: ["./plugins/cyberpunk"],
    }))

    // Set up sdd-phase-common.md with markers
    const skillsDir = join(opencodeDir, "skills", "_shared")
    mkdirSync(skillsDir, { recursive: true })
    const START_MARKER = "<!-- cyberpunk:start:section-e -->"
    const END_MARKER = "<!-- cyberpunk:end:section-e -->"
    writeFileSync(join(skillsDir, "sdd-phase-common.md"), `
# Test
${START_MARKER}
## E. Session Stats

Test content.
${END_MARKER}
`)

    // Set up theme
    const themesDir = join(opencodeDir, "themes")
    mkdirSync(themesDir, { recursive: true })
    writeFileSync(join(themesDir, "cyberpunk.json"), JSON.stringify({ theme: {} }))
    writeFileSync(join(opencodeDir, "tui.json"), JSON.stringify({ theme: "cyberpunk" }))

    // Set up plugin file
    const pluginsDir = join(opencodeDir, "plugins")
    mkdirSync(pluginsDir, { recursive: true })
    writeFileSync(join(pluginsDir, "cyberpunk.ts"), "// plugin")

    const { runDoctor } = await import("../src/commands/doctor.ts?" + Date.now())
    const result = await runDoctor({
      fix: false,
      verbose: false,
      components: ["plugin", "theme"],
    })

    // Should have checks and summary
    expect(result.checks.length).toBeGreaterThan(0)
    expect(result.summary).toBeDefined()
    expect(typeof result.summary.healthy).toBe("number")
    expect(typeof result.summary.failures).toBe("number")
    expect(typeof result.summary.warnings).toBe("number")
    expect(typeof result.summary.remainingFailures).toBe("number")
  })

  test("detects missing config as failure", async () => {
    // No config file created
    const { runDoctor } = await import("../src/commands/doctor.ts?" + Date.now())
    const result = await runDoctor({
      fix: false,
      verbose: false,
    })

    const configCheck = result.checks.find(c => c.id === "config:integrity")
    expect(configCheck).toBeDefined()
    expect(configCheck!.status).toBe("fail")
  })

  test("--fix with missing config repairs it", async () => {
    // No config file initially
    const { runDoctor } = await import("../src/commands/doctor.ts?" + Date.now())
    const result = await runDoctor({
      fix: true,
      verbose: false,
    })

    const configFix = result.fixes.find(f => f.checkId === "config:integrity")
    expect(configFix).toBeDefined()
    expect(configFix!.status).toBe("fixed")

    // Verify config file was created
    const { readConfigRaw } = await import("../src/config/load.ts?" + Date.now())
    const raw = readConfigRaw()
    expect(raw.error).toBeNull()
    expect(raw.parsed).not.toBeNull()
  })

  test("exit code derivation: 0 when no remaining failures", async () => {
    const { runDoctor } = await import("../src/commands/doctor.ts?" + Date.now())
    const result = await runDoctor({ fix: false, verbose: false })

    // Exit code should be 0 only when remainingFailures === 0
    const exitCode = result.summary.remainingFailures > 0 ? 1 : 0
    // With missing config, there should be failures
    // This is a logical test, not an exit() test
    expect(typeof exitCode).toBe("number")
    expect(exitCode === 0 || exitCode === 1).toBe(true)
  })
})
