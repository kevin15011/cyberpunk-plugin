// src/components/context-mode.ts — npm install -g + write routing instructions

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"

const ROUTING_MARKER = "<!-- cyberpunk-managed:context-mode-routing -->"

function getContextModePaths() {
  const home = process.env.HOME || process.env.USERPROFILE || "~"
  const opencodeDir = join(home, ".config", "opencode")
  const instructionsDir = join(opencodeDir, "instructions")

  return {
    opencodeDir,
    opencodeJsonPath: join(opencodeDir, "opencode.json"),
    instructionsDir,
    routingPath: join(instructionsDir, "context-mode-routing.md"),
  }
}

export const CONTEXT_MODE_ROUTING = `${ROUTING_MARKER}
# Context-Mode Routing

This file adds routing awareness for \`context-mode\`. It complements the global \`AGENTS.md\` memory rules; it does not replace them.

## Purpose

Use \`context-mode\` when a normal tool call would likely dump too much raw data into the chat context. The goal is token reduction, not changing how code edits are made.

## Escalate to \`context-mode\` only for genuinely heavy-output work

- Use \`ctx_batch_execute\` only when the output is genuinely large, you need to inspect multiple noisy commands together, or you want indexed follow-up queries.
- Use \`ctx_execute\` when you need sandboxed code to analyze, parse, transform, or summarize data before returning the result.
- Use \`ctx_execute_file\` for large files, logs, generated output, or any source file you need to inspect without loading into chat.
- Use \`ctx_fetch_and_index\` followed by \`ctx_search\` for arbitrary web pages or large remote documents.
- Use \`ctx_search\` for follow-up questions on content that was already indexed by \`context-mode\`.

## Keep normal OpenCode tools for focused work

- Use \`read\` when you need the actual contents of 1-3 files in order to edit them.
- Use \`edit\` and \`write\` normally for code changes.
- Use \`glob\` and \`grep\` for targeted discovery when the result set is expected to stay small.
- Use short shell commands normally for repo state or file operations.
- Prefer \`rtk\` when the main problem is verbose CLI output and a compact CLI proxy is enough.

## Tool boundaries in this stack

- \`Engram\` is the persistent memory layer for decisions, discoveries, and session summaries.
- \`context-mode\` is the context-protection and sandbox-routing layer.
- \`Context7\` remains the preferred source for library and framework documentation.
- \`Supermemory\` remains user-memory and preference recall.

## Conflict handling

- If a raw tool call is denied or redirected by \`context-mode\`, switch to the matching \`ctx_*\` tool instead of retrying the same path.
- Do not duplicate memory behavior in \`context-mode\` instructions; follow the existing global \`AGENTS.md\` for \`Engram\` persistence rules.
- Keep sandbox output intentionally small: print the answer or summary, not the whole dataset.
`

function isNpmAvailable(): boolean {
  try {
    execSync("which npm", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function isContextModeInstalled(): boolean {
  try {
    execSync("which context-mode", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function installContextModeGlobally(): boolean {
  try {
    execSync("npm install -g context-mode", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function ensureRoutingFile(): boolean {
  const { instructionsDir, routingPath } = getContextModePaths()
  mkdirSync(instructionsDir, { recursive: true })

  const content = CONTEXT_MODE_ROUTING + "\n"

  if (!existsSync(routingPath)) {
    writeFileSync(routingPath, content, "utf8")
    return true
  }

  const current = readFileSync(routingPath, "utf8")
  if (!current.includes(ROUTING_MARKER)) {
    // File exists but wasn't created by us — don't overwrite
    return false
  }

  if (current === content) return false

  writeFileSync(routingPath, content, "utf8")
  return true
}

function removeRoutingFile(): void {
  const { routingPath } = getContextModePaths()
  if (!existsSync(routingPath)) return

  const current = readFileSync(routingPath, "utf8")
  if (current.includes(ROUTING_MARKER)) {
    unlinkSync(routingPath)
  }
}

function patchOpencodeJsonMcp(): boolean {
  const { opencodeJsonPath } = getContextModePaths()
  if (!existsSync(opencodeJsonPath)) return false

  let config: Record<string, any>
  try {
    config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
  } catch {
    return false
  }

  // Initialize mcp object if needed
  if (!config.mcp) {
    config.mcp = {}
  }

  // Check if already configured
  if (config.mcp["context-mode"]?.type === "local") {
    return false
  }

  // Add context-mode MCP server config
  config.mcp["context-mode"] = {
    command: ["context-mode"],
    type: "local",
    enabled: true,
  }

  writeFileSync(opencodeJsonPath, JSON.stringify(config, null, 2), "utf8")
  return true
}

function unpatchOpencodeJsonMcp(): boolean {
  const { opencodeJsonPath } = getContextModePaths()
  if (!existsSync(opencodeJsonPath)) return false

  let config: Record<string, any>
  try {
    config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
  } catch {
    return false
  }

  if (!config.mcp?.["context-mode"]) return false

  delete config.mcp["context-mode"]
  writeFileSync(opencodeJsonPath, JSON.stringify(config, null, 2), "utf8")
  return true
}

export function getContextModeComponent(): ComponentModule {
  return {
    id: "context-mode",
    label: COMPONENT_LABELS["context-mode"],

    async install(): Promise<InstallResult> {
      const { routingPath } = getContextModePaths()

      // Check npm
      if (!isNpmAvailable()) {
        return {
          component: "context-mode",
          action: "install",
          status: "error",
          message: "npm no encontrado — instalá Node.js para usar context-mode",
        }
      }

      // Install context-mode globally if not installed
      let alreadyInstalled = isContextModeInstalled()
      if (!alreadyInstalled) {
        const ok = installContextModeGlobally()
        if (!ok) {
          return {
            component: "context-mode",
            action: "install",
            status: "error",
            message: "Error al instalar context-mode via npm",
          }
        }
      }

      // Write routing instructions
      ensureRoutingFile()

      // Add MCP configuration to opencode.json
      const mcpPatched = patchOpencodeJsonMcp()

      const config = loadConfig()
      config.components["context-mode"] = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
          path: routingPath,
      }
      saveConfig(config)

      return {
        component: "context-mode",
        action: "install",
        status: alreadyInstalled ? "skipped" : "success",
        message: alreadyInstalled
          ? "context-mode ya instalado, routing y MCP actualizados"
          : mcpPatched
            ? "context-mode instalado, routing y MCP configurados"
            : undefined,
        path: routingPath,
      }
    },

    async uninstall(): Promise<InstallResult> {
      removeRoutingFile()
      unpatchOpencodeJsonMcp()

      const config = loadConfig()
      config.components["context-mode"] = { installed: false }
      saveConfig(config)

      return {
        component: "context-mode",
        action: "uninstall",
        status: "success",
        path: getContextModePaths().routingPath,
      }
    },

    async status(): Promise<ComponentStatus> {
      const { opencodeJsonPath, routingPath } = getContextModePaths()
      const cmInstalled = isContextModeInstalled()
      const routingExists = existsSync(routingPath)

      // Check if MCP is configured in opencode.json
      let mcpConfigured = false
      if (existsSync(opencodeJsonPath)) {
        try {
          const config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
          mcpConfigured = config.mcp?.["context-mode"]?.type === "local"
        } catch {}
      }

      if (cmInstalled && routingExists && mcpConfigured) {
        return {
          id: "context-mode",
          label: COMPONENT_LABELS["context-mode"],
          status: "installed",
        }
      }

      if (!cmInstalled && !isNpmAvailable()) {
        return {
          id: "context-mode",
          label: COMPONENT_LABELS["context-mode"],
          status: "error",
          error: "npm no encontrado",
        }
      }

      if (cmInstalled && !mcpConfigured) {
        return {
          id: "context-mode",
          label: COMPONENT_LABELS["context-mode"],
          status: "available",
          error: "npm instalado pero MCP no configurado en opencode.json",
        }
      }

      return {
        id: "context-mode",
        label: COMPONENT_LABELS["context-mode"],
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []
      const { opencodeJsonPath, routingPath } = getContextModePaths()

      // Check 1: npm available
      if (!ctx.prerequisites.npm && !ctx.prerequisites.bun) {
        checks.push({
          id: "context-mode:npm",
          label: "npm/bun para context-mode",
          status: "warn",
          message: "npm/bun no encontrado — context-mode no disponible",
          fixable: false,
        })
      } else {
        const which = ctx.prerequisites.npm ? "npm" : "bun"
        checks.push({
          id: "context-mode:npm",
          label: "npm/bun para context-mode",
          status: "pass",
          message: `${which} disponible`,
          fixable: false,
        })
      }

      // Check 2: context-mode binary installed
      const cmInstalled = isContextModeInstalled()
      if (!cmInstalled) {
        checks.push({
          id: "context-mode:binary",
          label: "context-mode binary",
          status: "fail",
          message: "context-mode no encontrado en PATH",
          fixable: false, // Requires npm install, not doctor scope
        })
      } else {
        checks.push({
          id: "context-mode:binary",
          label: "context-mode binary",
          status: "pass",
          message: "context-mode instalado",
          fixable: false,
        })
      }

      // Check 3: routing file exists
      if (!existsSync(routingPath)) {
        checks.push({
          id: "context-mode:routing",
          label: "Archivo routing",
          status: "fail",
          message: "context-mode-routing.md no encontrado",
          fixable: true,
        })
      } else {
        const content = readFileSync(routingPath, "utf8")
        if (content.includes(ROUTING_MARKER)) {
          checks.push({
            id: "context-mode:routing",
            label: "Archivo routing",
            status: "pass",
            message: "Archivo routing existe y está gestionado",
            fixable: false,
          })
        } else {
          checks.push({
            id: "context-mode:routing",
            label: "Archivo routing",
            status: "warn",
            message: "Archivo routing existe pero no contiene marcador cyberpunk",
            fixable: false,
          })
        }
      }

      // Check 4: MCP configured in opencode.json
      let mcpConfigured = false
      if (existsSync(opencodeJsonPath)) {
        try {
          const config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
          mcpConfigured = config.mcp?.["context-mode"]?.type === "local"
        } catch {}
      }

      if (!mcpConfigured) {
        checks.push({
          id: "context-mode:mcp",
          label: "MCP en opencode.json",
          status: "fail",
          message: "context-mode MCP no configurado en opencode.json",
          fixable: true,
        })
      } else {
        checks.push({
          id: "context-mode:mcp",
          label: "MCP en opencode.json",
          status: "pass",
          message: "context-mode MCP configurado",
          fixable: false,
        })
      }

      return { component: "context-mode", checks }
    },
  }
}
