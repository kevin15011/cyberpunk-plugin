// src/cli/parse-args.ts — parse process.argv into ParsedArgs interface

import type { ComponentId, COMPONENT_IDS } from "../config/schema"
import type { AgentTarget, UserProfile } from "../domain/environment"

/** CLI interaction mode for TUI flow control. */
export type CliMode = "guided" | "advanced"

const VALID_TARGETS = new Set<string>(["opencode", "claude", "codex"])
const VALID_PROFILES = new Set<string>(["non-technical", "developer", "admin"])
const VALID_MODES = new Set<string>(["guided", "advanced"])

export interface ParsedArgs {
  command: "tui" | "install" | "uninstall" | "status" | "upgrade" | "config" | "doctor" | "help"
  components: ComponentId[]
  flags: {
    json: boolean
    verbose: boolean
    all: boolean
    check: boolean
    list: boolean
    init: boolean
    fix: boolean
  }
  /** Selected agent target — defaults to "opencode" */
  target: AgentTarget
  /** User experience profile — undefined when not specified */
  profile?: UserProfile
  /** CLI interaction mode — undefined when not specified */
  mode?: CliMode
  preset?: string
  parseErrors: string[]
  configKey?: string
  configValue?: string
}

const VALID_COMPONENTS = new Set<string>(["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"])

const COMMAND_ALIASES: Record<string, ParsedArgs["command"]> = {
  i: "install",
  u: "uninstall",
  s: "status",
  up: "upgrade",
  c: "config",
  d: "doctor",
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
      fix: false,
    },
    target: "opencode",
    parseErrors: [],
  }

  // Separate positional args from flags, handle value-taking flags specially
  const positionals: string[] = []
  const flags: string[] = []

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--preset") {
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        result.preset = next
        i++ // skip the value
      } else {
        result.parseErrors.push("--preset requires a preset name")
      }
    } else if (argv[i] === "--target") {
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        if (VALID_TARGETS.has(next)) {
          result.target = next as AgentTarget
        } else {
          result.parseErrors.push(`--target: unknown target "${next}". Valid: opencode, claude, codex`)
        }
        i++ // skip the value
      } else {
        result.parseErrors.push("--target requires a value (opencode, claude, codex)")
      }
    } else if (argv[i] === "--profile") {
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        if (VALID_PROFILES.has(next)) {
          result.profile = next as UserProfile
        } else {
          result.parseErrors.push(`--profile: unknown profile "${next}". Valid: non-technical, developer, admin`)
        }
        i++ // skip the value
      } else {
        result.parseErrors.push("--profile requires a value (non-technical, developer, admin)")
      }
    } else if (argv[i] === "--mode") {
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        if (VALID_MODES.has(next)) {
          result.mode = next as CliMode
        } else {
          result.parseErrors.push(`--mode: unknown mode "${next}". Valid: guided, advanced`)
        }
        i++ // skip the value
      } else {
        result.parseErrors.push("--mode requires a value (guided, advanced)")
      }
    } else if (argv[i].startsWith("--")) {
      flags.push(argv[i])
    } else {
      positionals.push(argv[i])
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
      case "--fix":
        result.flags.fix = true
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
      case "--doctor":
        if (result.command === "tui") result.command = "doctor"
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
      case "--tmux":
        result.components.push("tmux" as ComponentId)
        break
    }
  }

  // Parse first positional as command
  if (positionals.length > 0) {
    const cmd = positionals[0]
    if (COMMAND_ALIASES[cmd]) {
      result.command = COMMAND_ALIASES[cmd]
    } else if (cmd === "install" || cmd === "uninstall" || cmd === "status" || cmd === "upgrade" || cmd === "config" || cmd === "doctor" || cmd === "help") {
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
    result.components = ["plugin", "theme", "sounds", "context-mode", "rtk", "tmux"]
  }

  // Validate: --preset is mutually exclusive with --all and component flags
  if (result.preset) {
    if (result.flags.all) {
      result.parseErrors.push("--preset no se puede combinar con --all")
    }
    if (result.components.length > 0) {
      result.parseErrors.push("--preset no se puede combinar con flags de componentes")
    }
  }

  return result
}
