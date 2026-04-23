// tests/parse-args.test.ts — tests for CLI argument parsing

import { describe, test, expect } from "bun:test"
import { parseArgs } from "../src/cli/parse-args"

describe("parseArgs", () => {
  test("no args → TUI mode", () => {
    const result = parseArgs([])
    expect(result.command).toBe("tui")
    expect(result.components).toEqual([])
  })

  test("--help → help command", () => {
    const result = parseArgs(["--help"])
    expect(result.command).toBe("help")
  })

  test("install command with --plugin component", () => {
    const result = parseArgs(["install", "--plugin"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin"])
  })

  test("install command with --all", () => {
    const result = parseArgs(["install", "--all"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"])
  })

  test("--install --plugin bypasses TUI (non-interactive)", () => {
    const result = parseArgs(["--install", "--plugin"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin"])
  })

  test("--install --all bypasses TUI", () => {
    const result = parseArgs(["--install", "--all"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"])
  })

  test("--status --json", () => {
    const result = parseArgs(["--status", "--json"])
    expect(result.command).toBe("status")
    expect(result.flags.json).toBe(true)
  })

  test("--uninstall --theme", () => {
    const result = parseArgs(["--uninstall", "--theme"])
    expect(result.command).toBe("uninstall")
    expect(result.components).toEqual(["theme"])
  })

  test("--upgrade --check", () => {
    const result = parseArgs(["--upgrade", "--check"])
    expect(result.command).toBe("upgrade")
    expect(result.flags.check).toBe(true)
  })

  test("command aliases work", () => {
    expect(parseArgs(["i"]).command).toBe("install")
    expect(parseArgs(["u"]).command).toBe("uninstall")
    expect(parseArgs(["s"]).command).toBe("status")
    expect(parseArgs(["up"]).command).toBe("upgrade")
    expect(parseArgs(["c"]).command).toBe("config")
    expect(parseArgs(["h"]).command).toBe("help")
  })

  test("config command with key and value", () => {
    const result = parseArgs(["config", "components.sounds.installed", "true"])
    expect(result.command).toBe("config")
    expect(result.configKey).toBe("components.sounds.installed")
    expect(result.configValue).toBe("true")
  })

  test("config command with key only (read mode)", () => {
    const result = parseArgs(["config", "repoUrl"])
    expect(result.command).toBe("config")
    expect(result.configKey).toBe("repoUrl")
    expect(result.configValue).toBeUndefined()
  })

  test("config --list", () => {
    const result = parseArgs(["config", "--list"])
    expect(result.command).toBe("config")
    expect(result.flags.list).toBe(true)
  })

  test("config --init", () => {
    const result = parseArgs(["config", "--init"])
    expect(result.command).toBe("config")
    expect(result.flags.init).toBe(true)
  })

  test("multiple component flags", () => {
    const result = parseArgs(["install", "--plugin", "--sounds"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin", "sounds"])
  })

  test("--verbose flag", () => {
    const result = parseArgs(["--install", "--plugin", "--verbose"])
    expect(result.flags.verbose).toBe(true)
  })

  test("--doctor --fix", () => {
    const result = parseArgs(["--doctor", "--fix"])
    expect(result.command).toBe("doctor")
    expect(result.flags.fix).toBe(true)
  })

  test("--tmux component flag", () => {
    const result = parseArgs(["install", "--tmux"])
    expect(result.components).toEqual(["tmux"])
  })

  test("--rtk component flag", () => {
    const result = parseArgs(["install", "--rtk"])
    expect(result.components).toEqual(["rtk"])
  })

  test("--preset minimal sets preset field", () => {
    const result = parseArgs(["install", "--preset", "minimal"])
    expect(result.command).toBe("install")
    expect(result.preset).toBe("minimal")
    expect(result.components).toEqual([])
    expect(result.parseErrors).toEqual([])
  })

  test("--preset full sets preset field", () => {
    const result = parseArgs(["install", "--preset", "full"])
    expect(result.preset).toBe("full")
    expect(result.parseErrors).toEqual([])
  })

  test("--preset without value produces parse error", () => {
    const result = parseArgs(["install", "--preset"])
    expect(result.preset).toBeUndefined()
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.parseErrors[0]).toMatch(/--preset/)
  })

  test("--preset with --all produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "full", "--all"])
    expect(result.preset).toBe("full")
    expect(result.parseErrors).toEqual(
      expect.arrayContaining([expect.stringContaining("--preset")])
    )
  })

  test("--preset with component flag produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "full", "--theme"])
    expect(result.preset).toBe("full")
    expect(result.parseErrors).toEqual(
      expect.arrayContaining([expect.stringContaining("--preset")])
    )
  })

  test("--preset with --plugin produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "minimal", "--plugin"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("--preset with --context-mode produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "minimal", "--context-mode"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("--preset with --sounds produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "minimal", "--sounds"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("--preset with --rtk produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "full", "--rtk"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("--preset with --tmux produces mutual exclusion error", () => {
    const result = parseArgs(["install", "--preset", "full", "--tmux"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("parseErrors is empty by default", () => {
    const result = parseArgs(["install", "--plugin"])
    expect(result.parseErrors).toEqual([])
  })

  test("--preset before last arg with no value produces error", () => {
    const result = parseArgs(["--preset"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })
})
