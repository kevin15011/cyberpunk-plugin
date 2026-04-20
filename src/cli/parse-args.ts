// src/cli/parse-args.ts — parse process.argv into ParsedArgs interface

import type { ComponentId, COMPONENT_IDS } from "../config/schema"

export interface ParsedArgs {
  command: "tui" | "install" | "uninstall" | "status" | "upgrade" | "config" | "help"
  components: ComponentId[]
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

const VALID_COMPONENTS = new Set<string>(["plugin", "theme", "sounds", "context-mode", "rtk"])

const COMMAND_ALIASES: Record<string, ParsedArgs["command"]> = {
  i: "install",
  u: "uninstall",
  s: "status",
  up: "upgrade",
  c: "config",
  h: "help",
}

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
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

  // Separate positional args from flags
  const positionals: string[] = []
  const flags: string[] = []

  for (const arg of argv) {
    if (arg.startsWith("--")) {
      flags.push(arg)
    } else {
      positionals.push(arg)
    }
  }

  // Parse flags — including top-level command flags (--install, --status, etc.)
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
      // Top-level command flags — bypass TUI when specified with components
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
      // Component flags
      case "--plugin":
      case "--theme":
      case "--sounds":
      case "--context-mode":
        result.components.push(flag.slice(2) as ComponentId)
        break
      case "--rtk":
        result.components.push("rtk" as ComponentId)
        break
    }
  }

  // Parse first positional as command
  if (positionals.length > 0) {
    const cmd = positionals[0]
    if (COMMAND_ALIASES[cmd]) {
      result.command = COMMAND_ALIASES[cmd]
    } else if (cmd === "install" || cmd === "uninstall" || cmd === "status" || cmd === "upgrade" || cmd === "config" || cmd === "help") {
      result.command = cmd
    }

    // Config command takes key and optional value from remaining positionals
    if (result.command === "config" && positionals.length > 1) {
      result.configKey = positionals[1]
      if (positionals.length > 2) {
        result.configValue = positionals.slice(2).join(" ")
      }
    }
  }

  // If --all flag, include all components
  if (result.flags.all) {
    result.components = ["plugin", "theme", "sounds", "context-mode", "rtk"]
  }

  return result
}
