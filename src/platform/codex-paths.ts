// src/platform/codex-paths.ts — Codex path resolution and managed instruction helpers

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"
import { getHomeDirAuto } from "./paths"

export const CODEX_AGENTS_BLOCK_START = "<!-- cyberpunk-managed:codex-instructions:start -->"
export const CODEX_AGENTS_BLOCK_END = "<!-- cyberpunk-managed:codex-instructions:end -->"
const CODEX_MANAGED_MARKER = "cyberpunk-managed:"

export function getCodexHome(): string {
  const envHome = process.env.CODEX_HOME
  if (envHome && envHome.trim() && envHome !== "~") return envHome
  return join(getHomeDirAuto(), ".codex")
}

export function getCodexPaths() {
  const codexHome = getCodexHome()
  const instructionsDir = join(codexHome, "instructions")
  return {
    codexHome,
    instructionsDir,
    agentsPath: join(codexHome, "AGENTS.md"),
    configTomlPath: join(codexHome, "config.toml"),
    rtkRoutingPath: join(instructionsDir, "rtk-routing.md"),
    contextModeRoutingPath: join(instructionsDir, "context-mode-routing.md"),
    codebaseMemoryRoutingPath: join(instructionsDir, "codebase-memory-routing.md"),
  }
}

export function ensureCodexInstructionFile(path: string, content: string): boolean {
  mkdirSync(getCodexPaths().instructionsDir, { recursive: true })
  const normalized = content.endsWith("\n") ? content : content + "\n"
  if (!existsSync(path)) {
    writeFileSync(path, normalized, "utf8")
    return true
  }
  const current = readFileSync(path, "utf8")
  const firstLine = normalized.split("\n")[0]
  if (!firstLine || !current.includes(firstLine)) return false
  if (current === normalized) return false
  writeFileSync(path, normalized, "utf8")
  return true
}

export function removeCodexInstructionFile(path: string, marker: string): void {
  if (!existsSync(path)) return
  const current = readFileSync(path, "utf8")
  if (current.includes(marker)) unlinkSync(path)
}

function getManagedCodexInstructionFileNames(extraFileNames: string[] = []): string[] {
  const { instructionsDir } = getCodexPaths()
  const fileNames = new Set(extraFileNames)

  if (existsSync(instructionsDir)) {
    for (const fileName of readdirSync(instructionsDir)) {
      if (!fileName.endsWith(".md")) continue
      try {
        const content = readFileSync(join(instructionsDir, fileName), "utf8")
        if (content.includes(CODEX_MANAGED_MARKER)) fileNames.add(fileName)
      } catch {
        // Ignore unreadable files; they are outside our managed include state.
      }
    }
  }

  return [...fileNames].sort()
}

function buildCodexAgentsBlock(instructionFileNames: string[]): string {
  return [
    CODEX_AGENTS_BLOCK_START,
    "# Cyberpunk token-saving tool routing",
    "",
    "The following instruction files are managed by Cyberpunk:",
    ...instructionFileNames.map(name => `- @instructions/${name}`),
    CODEX_AGENTS_BLOCK_END,
  ].join("\n")
}

function writeTextFileAtomic(path: string, content: string): void {
  const tmpPath = `${path}.tmp`
  writeFileSync(tmpPath, content, "utf8")
  renameSync(tmpPath, path)
}

export function ensureCodexAgentsInclude(instructionFileNames: string[] = []): boolean {
  const { codexHome, agentsPath } = getCodexPaths()
  mkdirSync(codexHome, { recursive: true })
  const managedFileNames = getManagedCodexInstructionFileNames(instructionFileNames)
  if (managedFileNames.length === 0) return false
  const current = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : ""
  const body = buildCodexAgentsBlock(managedFileNames)

  const blockRe = new RegExp(`${CODEX_AGENTS_BLOCK_START}[\\s\\S]*?${CODEX_AGENTS_BLOCK_END}`)
  const next = blockRe.test(current)
    ? current.replace(blockRe, body)
    : (current.trimEnd() ? current.trimEnd() + "\n\n" + body + "\n" : body + "\n")
  if (next === current) return false
  writeFileSync(agentsPath, next, "utf8")
  return true
}

export function removeCodexAgentsInclude(): void {
  rewriteCodexAgentsIncludeAfterRemoval()
}

export function rewriteCodexAgentsIncludeAfterRemoval(removeFileNames: string[] = []): void {
  const { agentsPath } = getCodexPaths()
  if (!existsSync(agentsPath)) return
  const current = readFileSync(agentsPath, "utf8")
  const removed = new Set(removeFileNames)
  const remainingFileNames = getManagedCodexInstructionFileNames().filter(name => !removed.has(name))
  const blockRe = new RegExp(`${CODEX_AGENTS_BLOCK_START}[\\s\\S]*?${CODEX_AGENTS_BLOCK_END}`)
  const surroundingBlockRe = new RegExp(`\\n?${CODEX_AGENTS_BLOCK_START}[\\s\\S]*?${CODEX_AGENTS_BLOCK_END}\\n?`)
  const next = remainingFileNames.length > 0
    ? current.replace(blockRe, buildCodexAgentsBlock(remainingFileNames))
    : current.replace(surroundingBlockRe, "\n").replace(/\n{3,}/g, "\n\n")
  if (next.trim().length === 0) {
    unlinkSync(agentsPath)
    return
  }
  if (next !== current) writeFileSync(agentsPath, next, "utf8")
}

export function patchCodexMcpToml(serverName: string, command: string): boolean {
  const { configTomlPath } = getCodexPaths()
  if (!existsSync(configTomlPath)) return false
  const current = readFileSync(configTomlPath, "utf8")
  if (current.trim() && !current.includes("[mcp_servers") && !current.includes("[mcp.")) return false
  const header = `[mcp_servers.${serverName}]`
  if (current.includes(header)) return false
  const block = `\n${header}\ncommand = ${JSON.stringify(command)}\n`
  writeTextFileAtomic(configTomlPath, current.trimEnd() + block + "\n")
  return true
}

export function unpatchCodexMcpToml(serverName: string): boolean {
  const { configTomlPath } = getCodexPaths()
  if (!existsSync(configTomlPath)) return false
  const current = readFileSync(configTomlPath, "utf8")
  const header = `[mcp_servers.${serverName}]`
  const lines = current.split("\n")
  const output: string[] = []
  let skipping = false
  for (const line of lines) {
    if (line.trim() === header) {
      skipping = true
      continue
    }
    if (skipping && line.startsWith("[") && line.trim() !== header) {
      skipping = false
    }
    if (!skipping) output.push(line)
  }
  const next = output.join("\n").replace(/\n{3,}/g, "\n\n")
  if (next === current) return false
  writeTextFileAtomic(configTomlPath, next)
  return true
}
