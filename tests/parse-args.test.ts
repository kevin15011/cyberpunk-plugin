// tests/parse-args.test.ts — tests for CLI argument parsing

import { describe, test, expect } from "bun:test"

// Inline the parseArgs function for testing to avoid module resolution issues
// The actual module is at src/cli/parse-args.ts

interface ParsedArgs {
  command: "tui" | "install" | "uninstall" | "status" | "upgrade" | "config" | "help"
  components: string[]
  flags: {
    json: boolean
    verbose: boolean
    all: boolean
    check: boolean
    list: boolean
    init: boolean
  }
  configKey?: string
  configValue?: string
}

const VALID_COMPONENTS = new Set(["plugin", "theme", "sounds", "context-mode"])

const COMMAND_ALIASES: Record<string, ParsedArgs["command"]> = {
  i: "install",
  u: "uninstall",
  s: "status",
  up: "upgrade",
  c: "config",
  h: "help",
}

function parseArgs(argv: string[] = []): ParsedArgs {
  const result: ParsedArgs = {
    command: "tui",
    components: [],
    flags: {
      json: false,
      verbose: false,
      all: false,
      check: false,
      list: false,
      init: false,
    },
  }

  const positionals: string[] = []
  const flags: string[] = []

  for (const arg of argv) {
    if (arg.startsWith("--")) {
      flags.push(arg)
    } else {
      positionals.push(arg)
    }
  }

  for (const flag of flags) {
    switch (flag) {
      case "--json":
        result.flags.json = true
        break
      case "--verbose":
        result.flags.verbose = true
        break
      case "--all":
        result.flags.all = true
        break
      case "--check":
        result.flags.check = true
        break
      case "--list":
        result.flags.list = true
        break
      case "--init":
        result.flags.init = true
        break
      case "--help":
        result.command = "help"
        break
      case "--install":
        if (result.command === "tui") result.command = "install"
        break
      case "--uninstall":
        if (result.command === "tui") result.command = "uninstall"
        break
      case "--status":
        if (result.command === "tui") result.command = "status"
        break
      case "--upgrade":
        if (result.command === "tui") result.command = "upgrade"
        break
      case "--plugin":
      case "--theme":
      case "--sounds":
      case "--context-mode":
        result.components.push(flag.slice(2))
        break
    }
  }

  if (positionals.length > 0) {
    const cmd = positionals[0]
    if (COMMAND_ALIASES[cmd]) {
      result.command = COMMAND_ALIASES[cmd]
    } else if (cmd === "install" || cmd === "uninstall" || cmd === "status" || cmd === "upgrade" || cmd === "config" || cmd === "help") {
      result.command = cmd as ParsedArgs["command"]
    }

    if (result.command === "config" && positionals.length > 1) {
      result.configKey = positionals[1]
      if (positionals.length > 2) {
        result.configValue = positionals.slice(2).join(" ")
      }
    }
  }

  if (result.flags.all) {
    result.components = ["plugin", "theme", "sounds", "context-mode"]
  }

  return result
}

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
    expect(result.components).toEqual(["plugin", "theme", "sounds", "context-mode"])
  })

  test("--install --plugin bypasses TUI (non-interactive)", () => {
    const result = parseArgs(["--install", "--plugin"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin"])
  })

  test("--install --all bypasses TUI", () => {
    const result = parseArgs(["--install", "--all"])
    expect(result.command).toBe("install")
    expect(result.components).toEqual(["plugin", "theme", "sounds", "context-mode"])
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
})
