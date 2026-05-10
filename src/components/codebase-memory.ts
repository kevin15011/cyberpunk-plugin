// src/components/codebase-memory.ts — install codebase-memory-mcp binary, add MCP config, write routing instructions

import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { delimiter, join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { isCommandOnPath } from "../platform/shell"
import { ensureCodexAgentsInclude, ensureCodexInstructionFile, getCodexPaths, patchCodexMcpToml, removeCodexAgentsInclude, removeCodexInstructionFile, unpatchCodexMcpToml } from "../platform/codex-paths"
import type { AgentTarget } from "../domain/environment"

const ROUTING_MARKER = "<!-- cyberpunk-managed:codebase-memory-routing -->"
const BINARY_NAME = "codebase-memory-mcp"
const MCP_NAME = "codebase-memory"
const LEGACY_MCP_NAME = "codebase-memory-mcp"
const INSTALL_URL = "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh"

function getPaths() {
  const home = getHomeDirAuto()
  const opencodeDir = join(home, ".config", "opencode")
  const instructionsDir = join(opencodeDir, "instructions")
  return {
    opencodeDir,
    opencodeJsonPath: join(opencodeDir, "opencode.json"),
    instructionsDir,
    routingPath: join(instructionsDir, "codebase-memory-routing.md"),
    localBinPath: join(home, ".local", "bin", BINARY_NAME),
  }
}

function getPathsForTarget(target: AgentTarget = "opencode") {
  if (target === "codex") {
    const codex = getCodexPaths()
    return {
      opencodeDir: codex.codexHome,
      opencodeJsonPath: codex.configTomlPath,
      instructionsDir: codex.instructionsDir,
      routingPath: codex.codebaseMemoryRoutingPath,
      localBinPath: join(getHomeDirAuto(), ".local", "bin", BINARY_NAME),
    }
  }
  return getPaths()
}

/**
 * Resolve bare "codebase-memory-mcp" command name to an absolute executable path.
 * Returns the absolute path if found, or null if not resolvable.
 */
export function resolveCodebaseMemoryExecutable(): string | null {
  // First check ~/.local/bin which is the default install location
  const { localBinPath } = getPaths()
  if (isExecutableFile(localBinPath)) {
    return localBinPath
  }

  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean)
  for (const pathEntry of pathEntries) {
    const candidate = join(pathEntry, BINARY_NAME)
    if (isExecutableFile(candidate)) {
      return candidate
    }
  }

  return null
}

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const ROUTING_CONTENT = `${ROUTING_MARKER}
# Codebase Memory MCP — Routing

This file adds routing awareness for \`codebase-memory-mcp\`. Use it for structural exploration of codebases.

## Purpose

Use \`codebase-memory-mcp\` for broad structural queries: architecture overview, call graphs, route maps, symbol lookup, \`detect_changes\`, \`trace_call_path\`, \`search_graph\`, and \`query_graph\`.

## When to use

- Architecture overview and dependency graphs
- Call path tracing between modules
- Symbol and route discovery across a codebase
- Detecting what changed in a codebase structure

## When NOT to use

- **Editing files** — always read actual files with \`read\` before editing. Never edit based solely on graph data.
- **As a source of truth for file contents** — index may be stale
- **Replacing focused grep/glob** — for small, targeted searches use native tools

## Index Hygiene Rules

These rules keep the graph useful and prevent stale-data mistakes.

### New Repo Rule
- When starting work on a new repo for the first time: **index it**. Run a full scan so the graph has structural data to work with.

### Pre-Exploration Rule
- Before a major exploration (architecture review, cross-module trace, dependency audit): **verify the index exists and is fresh**. A missing or stale index wastes time with wrong answers.

### Post-Change Rule
- After large changes (refactors, bulk renames, new modules, API surface changes): run \`detect_changes\` or **reindex**. Small targeted edits do not require reindex.

### Stale Index Heuristic
- If query results seem unexpected, return paths that don't exist, or symbols that look wrong: **assume the index is stale**. Reindex or run \`detect_changes\` before trusting further results.

### Read-Before-Edit Rule (STRONG)
- **Always read actual files before editing.** The graph is a navigation aid, not a source of truth for file contents. Editing based solely on graph data will produce incorrect changes.

## Commit Boundary Rule

Commits confirm that changes are final — ensure the graph reflects reality around this boundary.

### Before Commit
- Run \`detect_changes\` when available to catch any structural drift since the last scan.
- This is lightweight and should always be done regardless of change size.

### After Commit
- For **trivial changes** (typos, comments, minor formatting): \`detect_changes\` is sufficient. No full reindex needed.
- For **significant changes** (renames, moves, new/removed files, public interface changes, large refactors): **reindex or verify** that auto-sync updated the index. The commit confirms changes are final — the graph must reflect them.
- If unsure whether changes are significant, err on the side of reindexing.

## Freshness

- If results seem stale or outdated, reindex or verify freshness before trusting them
- The index reflects the codebase at last scan time, not real-time state

## Relationship to other tools

- \`Engram\` is for persistent decisions, discoveries, and session summaries — codebase-memory is for structural code knowledge
- \`context-mode\` provides sandbox execution and indexed document queries
- \`RTK\` provides compact CLI output for verbose commands
- \`Context7\` remains the preferred source for library and framework documentation
`

function isBinaryAvailable(): boolean {
  return resolveCodebaseMemoryExecutable() !== null
}

function isCurlAvailable(): boolean {
  return isCommandOnPath("curl")
}

function downloadBinary(): boolean {
  try {
    const home = getHomeDirAuto()
    mkdirSync(join(home, ".local", "bin"), { recursive: true })
    execSync(
      `sh -c "curl -fsSL ${INSTALL_URL} | bash"`,
      { stdio: "pipe", timeout: 30000 }
    )
    return isBinaryAvailable()
  } catch {
    return false
  }
}

function ensureRoutingFile(): boolean {
  const { instructionsDir, routingPath } = getPaths()
  mkdirSync(instructionsDir, { recursive: true })

  const content = ROUTING_CONTENT + "\n"

  if (!existsSync(routingPath)) {
    writeFileSync(routingPath, content, "utf8")
    return true
  }

  const current = readFileSync(routingPath, "utf8")
  if (!current.includes(ROUTING_MARKER)) {
    return false // Don't overwrite non-managed file
  }

  if (current === content) return false
  writeFileSync(routingPath, content, "utf8")
  return true
}

function removeRoutingFile(): void {
  const { routingPath } = getPaths()
  if (!existsSync(routingPath)) return
  const current = readFileSync(routingPath, "utf8")
  if (current.includes(ROUTING_MARKER)) {
    unlinkSync(routingPath)
  }
}

function ensureCodexRoutingFile(): boolean {
  ensureCodexAgentsInclude(["codebase-memory-routing.md"])
  return ensureCodexInstructionFile(getCodexPaths().codebaseMemoryRoutingPath, ROUTING_CONTENT + "\n")
}

function removeCodexRoutingFile(): void {
  removeCodexInstructionFile(getCodexPaths().codebaseMemoryRoutingPath, ROUTING_MARKER)
  removeCodexAgentsInclude()
}

function patchOpencodeJsonMcp(): boolean {
  const { opencodeJsonPath } = getPaths()
  if (!existsSync(opencodeJsonPath)) return false

  let config: Record<string, unknown>
  try {
    config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
  } catch {
    return false
  }

  if (!config.mcp) {
    config.mcp = {} as Record<string, unknown>
  }

  const mcpObj = config.mcp as Record<string, Record<string, unknown>>
  const legacyEntry = mcpObj[LEGACY_MCP_NAME]

  if (mcpObj[MCP_NAME]?.type === "local") {
    if (legacyEntry) {
      delete mcpObj[LEGACY_MCP_NAME]
      const tmpPath = opencodeJsonPath + ".tmp"
      writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
      const { renameSync } = require("fs") as typeof import("fs")
      renameSync(tmpPath, opencodeJsonPath)
      return true
    }
    return false
  }

  // Resolve to absolute path
  const absolutePath = resolveCodebaseMemoryExecutable()

  mcpObj[MCP_NAME] = {
    command: Array.isArray(legacyEntry?.command)
      ? legacyEntry.command
      : absolutePath ? [absolutePath] : [BINARY_NAME],
    type: "local",
    enabled: legacyEntry?.enabled === false ? false : true,
  }
  delete mcpObj[LEGACY_MCP_NAME]

  const tmpPath = opencodeJsonPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
  const { renameSync } = require("fs") as typeof import("fs")
  renameSync(tmpPath, opencodeJsonPath)
  return true
}

function unpatchOpencodeJsonMcp(): boolean {
  const { opencodeJsonPath } = getPaths()
  if (!existsSync(opencodeJsonPath)) return false

  let config: Record<string, unknown>
  try {
    config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
  } catch {
    return false
  }

  const mcpObj = config.mcp as Record<string, Record<string, unknown>> | undefined
  if (!mcpObj?.[MCP_NAME]) return false

  delete mcpObj[MCP_NAME]
  const tmpPath = opencodeJsonPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
  const { renameSync } = require("fs") as typeof import("fs")
  renameSync(tmpPath, opencodeJsonPath)
  return true
}

export function getCodebaseMemoryComponent(): ComponentModule {
  return {
    id: "codebase-memory",
    label: COMPONENT_LABELS["codebase-memory"],

    async install(ctx): Promise<InstallResult> {
      const target = ctx?.target ?? "opencode"
      const { routingPath } = getPathsForTarget(target)

      // Auto-download if missing
      let alreadyInstalled = isBinaryAvailable()
      if (!alreadyInstalled) {
        if (!isCurlAvailable()) {
          return {
            component: "codebase-memory",
            action: "install",
            status: "error",
            message: "curl no encontrado — necesitás curl para instalar codebase-memory-mcp",
          }
        }
        const downloaded = downloadBinary()
        if (!downloaded) {
          return {
            component: "codebase-memory",
            action: "install",
            status: "error",
            message: "Error al descargar codebase-memory-mcp — descargá manualmente de https://github.com/DeusData/codebase-memory-mcp",
          }
        }
      }

      // Write routing instructions
      target === "codex" ? ensureCodexRoutingFile() : ensureRoutingFile()

      // Add MCP configuration only when target config is verified safe.
      const executable = resolveCodebaseMemoryExecutable() ?? BINARY_NAME
      target === "codex" ? patchCodexMcpToml(MCP_NAME, executable) : patchOpencodeJsonMcp()

      const config = loadConfig()
      config.components["codebase-memory"] = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: routingPath,
      }
      saveConfig(config)

      return {
        component: "codebase-memory",
        action: "install",
        status: alreadyInstalled ? "skipped" : "success",
        message: alreadyInstalled
          ? "codebase-memory-mcp ya instalado, routing y MCP actualizados"
          : "codebase-memory-mcp instalado, routing y MCP configurados",
        path: routingPath,
      }
    },

    async uninstall(ctx): Promise<InstallResult> {
      const target = ctx?.target ?? "opencode"
      if (target === "codex") {
        removeCodexRoutingFile()
        unpatchCodexMcpToml(MCP_NAME)
      } else {
        removeRoutingFile()
        unpatchOpencodeJsonMcp()
      }

      const config = loadConfig()
      config.components["codebase-memory"] = { installed: false }
      saveConfig(config)

      return {
        component: "codebase-memory",
        action: "uninstall",
        status: "success",
        path: getPaths().routingPath,
      }
    },

    async status(ctx): Promise<ComponentStatus> {
      const target = ctx?.target ?? "opencode"
      const { opencodeJsonPath, routingPath } = getPathsForTarget(target)
      const binaryOk = isBinaryAvailable()
      const routingExists = existsSync(routingPath)

      let mcpConfigured = false
      if (target === "codex") {
        mcpConfigured = existsSync(opencodeJsonPath) && readFileSync(opencodeJsonPath, "utf8").includes(`[mcp_servers.${MCP_NAME}]`)
      } else if (existsSync(opencodeJsonPath)) {
        try {
          const config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
          const mcp = config.mcp as Record<string, Record<string, unknown>> | undefined
          mcpConfigured = mcp?.[MCP_NAME]?.type === "local"
        } catch { /* ignore */ }
      }

      if (binaryOk && routingExists && (mcpConfigured || target === "codex")) {
        return {
          id: "codebase-memory",
          label: COMPONENT_LABELS["codebase-memory"],
          status: "installed",
        }
      }

      if (!binaryOk && !isCurlAvailable()) {
        return {
          id: "codebase-memory",
          label: COMPONENT_LABELS["codebase-memory"],
          status: "error",
          error: "curl no encontrado (necesario para instalar codebase-memory-mcp)",
        }
      }

      if (binaryOk && !mcpConfigured) {
        return {
          id: "codebase-memory",
          label: COMPONENT_LABELS["codebase-memory"],
          status: "available",
          error: "codebase-memory-mcp disponible pero MCP no configurado",
        }
      }

      return {
        id: "codebase-memory",
        label: COMPONENT_LABELS["codebase-memory"],
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []
      const target = ctx.target ?? "opencode"
      const { opencodeJsonPath, routingPath } = getPathsForTarget(target)

      // Check 1: binary
      if (!isBinaryAvailable()) {
        checks.push({
          id: "codebase-memory:binary",
          label: "codebase-memory-mcp binary",
          status: "fail",
          message: "codebase-memory-mcp no encontrado en PATH ni en ~/.local/bin",
          fixable: false,
        })
      } else {
        checks.push({
          id: "codebase-memory:binary",
          label: "codebase-memory-mcp binary",
          status: "pass",
          message: "codebase-memory-mcp disponible",
          fixable: false,
        })
      }

      // Check 2: routing file
      if (!existsSync(routingPath)) {
        checks.push({
          id: "codebase-memory:routing",
          label: "Archivo routing",
          status: "fail",
          message: "codebase-memory-routing.md no encontrado",
          fixable: true,
        })
      } else {
        const content = readFileSync(routingPath, "utf8")
        if (content.includes(ROUTING_MARKER)) {
          checks.push({
            id: "codebase-memory:routing",
            label: "Archivo routing",
            status: "pass",
            message: "Archivo routing existe y está gestionado",
            fixable: false,
          })
        } else {
          checks.push({
            id: "codebase-memory:routing",
            label: "Archivo routing",
            status: "warn",
            message: "Archivo routing existe pero no contiene marcador cyberpunk",
            fixable: false,
          })
        }
      }

      // Check 3: MCP config
      let mcpConfigured = false
      let mcpBareName = false
      if (target === "codex") {
        mcpConfigured = existsSync(opencodeJsonPath) && readFileSync(opencodeJsonPath, "utf8").includes(`[mcp_servers.${MCP_NAME}]`)
      } else if (existsSync(opencodeJsonPath)) {
        try {
          const config = JSON.parse(readFileSync(opencodeJsonPath, "utf8"))
          const mcp = config.mcp as Record<string, Record<string, unknown>> | undefined
          mcpConfigured = mcp?.[MCP_NAME]?.type === "local"
          if (mcpConfigured) {
            const command = mcp![MCP_NAME].command as string[] | undefined
            if (command && command.length === 1 && command[0] === BINARY_NAME) {
              mcpBareName = true
            }
          }
        } catch { /* ignore */ }
      }

      // Check 3a: Bare command name → fail with fixable:true
      if (mcpBareName) {
        const absolutePath = resolveCodebaseMemoryExecutable()
        checks.push({
          id: "codebase-memory:mcp-path",
          label: "MCP path absoluto",
          status: "fail",
          message: absolutePath
            ? `MCP usa nombre bare "${BINARY_NAME}" — necesita path absoluto: ${absolutePath}`
            : `MCP usa nombre bare "${BINARY_NAME}" — binary no encontrado en PATH`,
          fixable: !!absolutePath,
        })
      } else if (!mcpConfigured) {
        checks.push({
          id: "codebase-memory:mcp",
          label: target === "codex" ? "MCP en Codex config" : "MCP en opencode.json",
          status: target === "codex" ? "warn" : "fail",
          message: target === "codex" ? "Codex MCP no verificado; instalado en modo instrucciones" : "codebase-memory MCP no configurado en opencode.json",
          fixable: target !== "codex",
        })
      } else {
        checks.push({
          id: "codebase-memory:mcp",
          label: "MCP en opencode.json",
          status: "pass",
          message: "codebase-memory MCP configurado con path absoluto",
          fixable: false,
        })
      }

      return { component: "codebase-memory", checks }
    },
  }
}
