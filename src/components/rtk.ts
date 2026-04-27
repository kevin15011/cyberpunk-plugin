// src/components/rtk.ts — install rtk globally, run `rtk init -g --opencode`, write instruction reinforcement

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { isCommandOnPath } from "../platform/shell"

const RTK_ROUTING_MARKER = "<!-- cyberpunk-managed:rtk-routing -->"

function getRtkPaths() {
  const home = getHomeDirAuto()
  const opencodeDir = join(home, ".config", "opencode")
  const instructionsDir = join(opencodeDir, "instructions")

  return {
    instructionsDir,
    localRtkPath: join(home, ".local", "bin", "rtk"),
    routingPath: join(instructionsDir, "rtk-routing.md"),
  }
}

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
  return isCommandOnPath("curl")
}

function installRtk(): boolean {
  try {
    mkdirSync(join(getHomeDirAuto(), ".local", "bin"), { recursive: true })
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
  const { localRtkPath } = getRtkPaths()
  if (isCommandOnPath("rtk")) {
    try {
      const { detectEnvironment } = require("../platform/detect") as typeof import("../platform/detect")
      const env = detectEnvironment()
      const cmd = env === "windows" ? "where rtk" : "which rtk"
      const path = execSync(cmd, { stdio: "pipe", encoding: "utf8" }).trim()
      if (path) return path.split("\n")[0].trim()
    } catch {
      // Lookup failed but isCommandOnPath said it's there — use local path
    }
  }

  return existsSync(localRtkPath) ? localRtkPath : null
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
  const { instructionsDir, routingPath } = getRtkPaths()
  mkdirSync(instructionsDir, { recursive: true })

  const content = RTK_ROUTING + "\n"

  if (!existsSync(routingPath)) {
    writeFileSync(routingPath, content, "utf8")
    return true
  }

  const current = readFileSync(routingPath, "utf8")
  if (!current.includes(RTK_ROUTING_MARKER)) {
    // File exists but wasn't created by us — don't overwrite
    return false
  }

  if (current === content) return false

  writeFileSync(routingPath, content, "utf8")
  return true
}

function removeRoutingFile(): void {
  const { routingPath } = getRtkPaths()
  if (!existsSync(routingPath)) return

  const current = readFileSync(routingPath, "utf8")
  if (current.includes(RTK_ROUTING_MARKER)) {
    unlinkSync(routingPath)
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
      const { routingPath } = getRtkPaths()
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
          path: routingPath,
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
        path: routingPath,
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
        path: getRtkPaths().routingPath,
      }
    },

    async status(): Promise<ComponentStatus> {
      const { routingPath } = getRtkPaths()
      const rtkInstalled = isRtkAvailable()
      const routingExists = existsSync(routingPath)

      if (rtkInstalled && routingExists) {
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

      return {
        id: "rtk",
        label: COMPONENT_LABELS.rtk,
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []
      const { routingPath } = getRtkPaths()

      // Check 1: rtk binary on PATH
      const rtkInstalled = isRtkAvailable()
      if (!rtkInstalled) {
        checks.push({
          id: "rtk:binary",
          label: "rtk binary",
          status: "fail",
          message: "rtk no encontrado en PATH",
          fixable: false, // Requires download, not doctor scope
        })
      } else {
        const details = ctx.verbose ? ` (${getRtkCommand()})` : ""
        checks.push({
          id: "rtk:binary",
          label: "rtk binary",
          status: "pass",
          message: `rtk disponible en PATH${details}`,
          fixable: false,
        })
      }

      // Check 2: routing file exists
      if (!existsSync(routingPath)) {
        checks.push({
          id: "rtk:routing",
          label: "Archivo routing RTK",
          status: "fail",
          message: "rtk-routing.md no encontrado",
          fixable: true,
        })
      } else {
        const content = readFileSync(routingPath, "utf8")
        if (content.includes(RTK_ROUTING_MARKER)) {
          checks.push({
            id: "rtk:routing",
            label: "Archivo routing RTK",
            status: "pass",
            message: "Archivo routing RTK existe y está gestionado",
            fixable: false,
          })
        } else {
          checks.push({
            id: "rtk:routing",
            label: "Archivo routing RTK",
            status: "warn",
            message: "Archivo routing RTK existe pero no contiene marcador cyberpunk",
            fixable: false,
          })
        }
      }

      return { component: "rtk", checks }
    },
  }
}
