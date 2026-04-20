// src/components/context-mode.ts — npm install -g + write routing instructions

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const OPENCODE_DIR = join(HOME, ".config", "opencode")
const OPENCODE_JSON_PATH = join(OPENCODE_DIR, "opencode.json")
const INSTRUCTIONS_DIR = join(OPENCODE_DIR, "instructions")
const ROUTING_PATH = join(INSTRUCTIONS_DIR, "context-mode-routing.md")
const ROUTING_MARKER = "<!-- cyberpunk-managed:context-mode-routing -->"

const CONTEXT_MODE_ROUTING = `${ROUTING_MARKER}
# Context-Mode Routing

This file adds routing awareness for \`context-mode\`. It complements the global \`AGENTS.md\` memory rules; it does not replace them.

## Purpose

Use \`context-mode\` when a normal tool call would likely dump too much raw data into the chat context. The goal is token reduction, not changing how code edits are made.

## Prefer \`context-mode\` for heavy-output work

- Use \`ctx_batch_execute\` by default for multi-command inspection, git/test output, or broad searches.
- Use \`ctx_execute\` when you need code to analyze, parse, transform, or summarize data before returning the result.
- Use \`ctx_execute_file\` for large files, logs, generated output, or any source file you need to inspect without loading into chat.
- Use \`ctx_fetch_and_index\` followed by \`ctx_search\` for arbitrary web pages or large remote documents.
- Use \`ctx_search\` for follow-up questions on content that was already indexed by \`context-mode\`.

## Keep normal OpenCode tools for focused work

- Use \`read\` when you need the actual contents of 1-3 files in order to edit them.
- Use \`edit\` and \`write\` normally for code changes.
- Use \`glob\` and \`grep\` for targeted discovery when the result set is expected to stay small.
- Use short shell commands normally for repo state or file operations.

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
  mkdirSync(INSTRUCTIONS_DIR, { recursive: true })

  const content = CONTEXT_MODE_ROUTING + "\n"

  if (!existsSync(ROUTING_PATH)) {
    writeFileSync(ROUTING_PATH, content, "utf8")
    return true
  }

  const current = readFileSync(ROUTING_PATH, "utf8")
  if (!current.includes(ROUTING_MARKER)) {
    // File exists but wasn't created by us — don't overwrite
    return false
  }

  if (current === content) return false

  writeFileSync(ROUTING_PATH, content, "utf8")
  return true
}

function removeRoutingFile(): void {
  if (!existsSync(ROUTING_PATH)) return

  const current = readFileSync(ROUTING_PATH, "utf8")
  if (current.includes(ROUTING_MARKER)) {
    unlinkSync(ROUTING_PATH)
  }
}

function patchOpencodeJsonMcp(): boolean {
  if (!existsSync(OPENCODE_JSON_PATH)) return false

  let config: Record<string, any>
  try {
    config = JSON.parse(readFileSync(OPENCODE_JSON_PATH, "utf8"))
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

  writeFileSync(OPENCODE_JSON_PATH, JSON.stringify(config, null, 2), "utf8")
  return true
}

function unpatchOpencodeJsonMcp(): boolean {
  if (!existsSync(OPENCODE_JSON_PATH)) return false

  let config: Record<string, any>
  try {
    config = JSON.parse(readFileSync(OPENCODE_JSON_PATH, "utf8"))
  } catch {
    return false
  }

  if (!config.mcp?.["context-mode"]) return false

  delete config.mcp["context-mode"]
  writeFileSync(OPENCODE_JSON_PATH, JSON.stringify(config, null, 2), "utf8")
  return true
}

export function getContextModeComponent(): ComponentModule {
  return {
    id: "context-mode",
    label: COMPONENT_LABELS["context-mode"],

    async install(): Promise<InstallResult> {
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
        path: ROUTING_PATH,
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
        path: ROUTING_PATH,
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
        path: ROUTING_PATH,
      }
    },

    async status(): Promise<ComponentStatus> {
      const cmInstalled = isContextModeInstalled()
      const routingExists = existsSync(ROUTING_PATH)

      // Check if MCP is configured in opencode.json
      let mcpConfigured = false
      if (existsSync(OPENCODE_JSON_PATH)) {
        try {
          const config = JSON.parse(readFileSync(OPENCODE_JSON_PATH, "utf8"))
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
  }
}
