// src/components/rtk.ts — install rtk globally, run `rtk init -g --opencode`, write instruction reinforcement

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const OPENCODE_DIR = join(HOME, ".config", "opencode")
const INSTRUCTIONS_DIR = join(OPENCODE_DIR, "instructions")
const LOCAL_RTK_PATH = join(HOME, ".local", "bin", "rtk")
const RTK_ROUTING_PATH = join(INSTRUCTIONS_DIR, "rtk-routing.md")
const RTK_ROUTING_MARKER = "<!-- cyberpunk-managed:rtk-routing -->"

const RTK_ROUTING = `${RTK_ROUTING_MARKER}
# RTK — Token-Optimized Command Proxy

This file adds awareness for \`rtk\`, a high-performance CLI proxy that filters and summarizes command outputs before they reach your LLM context.

## Purpose

Use \`rtk\` commands as drop-in replacements for common CLI tools to reduce token waste from verbose outputs (ls, tree, git, gh, docker, etc.).

## Prefer RTK for verbose CLI output

- Use \`rtk ls\` instead of \`ls\` for directory listings.
- Use \`rtk tree\` instead of \`tree\` for directory trees.
- Use \`rtk read\` instead of \`cat\` for file inspection.
- Use \`rtk git\` instead of raw \`git\` commands when output is large.
- Use \`rtk gh\` instead of raw \`gh\` commands for GitHub operations.
- Use \`rtk test\` instead of raw test runners to show only failures.
- Use \`rtk grep\` instead of \`grep\` for compact, grouped results.
- Use \`rtk diff\` for ultra-condensed diffs.
- Use \`rtk summary\` to run a command and show a heuristic summary.

## When NOT to use RTK

- When you need the full, unfiltered output (e.g., exact bytes, precise formatting).
- When the output is already small and targeted.
- When a command is not supported by RTK.

## Relationship to other tools

- \`context-mode\` provides sandbox execution and indexing (\`ctx_*\` tools). RTK provides compact CLI proxies.
- \`Engram\` is the persistent memory layer. RTK is not a memory tool.
- RTK and context-mode are complementary: use RTK for compact CLI output, context-mode for heavy processing.
`

function isRtkAvailable(): boolean {
  return getRtkCommand() !== null
}

function isCurlAvailable(): boolean {
  try {
    execSync("which curl", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function installRtk(): boolean {
  try {
    mkdirSync(join(HOME, ".local", "bin"), { recursive: true })
    execSync(
      "sh -c \"curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh\"",
      { stdio: "pipe" }
    )
    return getRtkCommand() !== null
  } catch {
    return false
  }
}

function getRtkCommand(): string | null {
  try {
    const path = execSync("which rtk", { stdio: "pipe", encoding: "utf8" }).trim()
    if (path) return path
  } catch {}

  return existsSync(LOCAL_RTK_PATH) ? LOCAL_RTK_PATH : null
}

function runRtkInit(): boolean {
  const rtk = getRtkCommand()
  if (!rtk) return false

  try {
    execSync(`"${rtk}" init -g --opencode`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function ensureRoutingFile(): boolean {
  mkdirSync(INSTRUCTIONS_DIR, { recursive: true })

  const content = RTK_ROUTING + "\n"

  if (!existsSync(RTK_ROUTING_PATH)) {
    writeFileSync(RTK_ROUTING_PATH, content, "utf8")
    return true
  }

  const current = readFileSync(RTK_ROUTING_PATH, "utf8")
  if (!current.includes(RTK_ROUTING_MARKER)) {
    // File exists but wasn't created by us — don't overwrite
    return false
  }

  if (current === content) return false

  writeFileSync(RTK_ROUTING_PATH, content, "utf8")
  return true
}

function removeRoutingFile(): void {
  if (!existsSync(RTK_ROUTING_PATH)) return

  const current = readFileSync(RTK_ROUTING_PATH, "utf8")
  if (current.includes(RTK_ROUTING_MARKER)) {
    unlinkSync(RTK_ROUTING_PATH)
  }
}

function runRtkUninstall(): boolean {
  const rtk = getRtkCommand()
  if (!rtk) return false

  try {
    execSync(`"${rtk}" init -g --uninstall`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function getRtkComponent(): ComponentModule {
  return {
    id: "rtk",
    label: COMPONENT_LABELS.rtk,

    async install(): Promise<InstallResult> {
      // Check if rtk is already available
      let alreadyInstalled = isRtkAvailable()
      if (!alreadyInstalled) {
        // Try to install rtk
        if (!isCurlAvailable()) {
          return {
            component: "rtk",
            action: "install",
            status: "error",
            message: "curl no encontrado — necesitás curl para instalar rtk",
          }
        }
        const installed = installRtk()
        if (!installed) {
          return {
            component: "rtk",
            action: "install",
            status: "error",
            message: "Error al instalar rtk — descargá manualmente de https://github.com/rtk-ai/rtk",
          }
        }
      }

      // Run `rtk init -g --opencode`
      const initOk = runRtkInit()

      // Write routing instructions
      ensureRoutingFile()

      const config = loadConfig()
      config.components.rtk = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: RTK_ROUTING_PATH,
      }
      saveConfig(config)

      return {
        component: "rtk",
        action: "install",
        status: alreadyInstalled ? "skipped" : "success",
        message: alreadyInstalled
          ? "rtk ya instalado, routing e init actualizados"
          : initOk
            ? "rtk instalado, routing y OpenCode plugin configurados"
            : "rtk instalado pero init falló — ejecutá 'rtk init -g --opencode' manualmente",
        path: RTK_ROUTING_PATH,
      }
    },

    async uninstall(): Promise<InstallResult> {
      // Remove routing instructions
      removeRoutingFile()

      // Run rtk uninstall for OpenCode
      runRtkUninstall()

      const config = loadConfig()
      config.components.rtk = { installed: false }
      saveConfig(config)

      return {
        component: "rtk",
        action: "uninstall",
        status: "success",
        path: RTK_ROUTING_PATH,
      }
    },

    async status(): Promise<ComponentStatus> {
      const rtkInstalled = isRtkAvailable()
      const routingExists = existsSync(RTK_ROUTING_PATH)

      // Check if RTK plugin is in opencode plugins dir
      let pluginConfigured = false
      const rtkPluginPath = join(OPENCODE_DIR, "plugins", "rtk.ts")
      if (existsSync(rtkPluginPath)) {
        pluginConfigured = true
      }

      if (rtkInstalled && routingExists && pluginConfigured) {
        return {
          id: "rtk",
          label: COMPONENT_LABELS.rtk,
          status: "installed",
        }
      }

      if (!rtkInstalled && !isCurlAvailable()) {
        return {
          id: "rtk",
          label: COMPONENT_LABELS.rtk,
          status: "error",
          error: "curl no encontrado (necesario para instalar rtk)",
        }
      }

      if (rtkInstalled && !pluginConfigured) {
        return {
          id: "rtk",
          label: COMPONENT_LABELS.rtk,
          status: "available",
          error: "rtk en PATH pero plugin OpenCode no configurado",
        }
      }

      return {
        id: "rtk",
        label: COMPONENT_LABELS.rtk,
        status: "available",
      }
    },
  }
}
