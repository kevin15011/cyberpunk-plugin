// src/updates/updaters.ts — explicit updater actions only

import { execSync } from "child_process"
import { accessSync, constants } from "fs"
import { delimiter, join } from "path"
import { runUpgrade } from "../commands/upgrade"
import type { ToolUpdateResult, UpdateTool } from "./types"

function ok(tool: UpdateTool, message: string): ToolUpdateResult {
  return { tool, status: "updated", message }
}

function fail(tool: UpdateTool, err: unknown): ToolUpdateResult {
  return { tool, status: "error", message: err instanceof Error ? err.message : String(err) }
}

function commandExists(command: string): boolean {
  const pathValue = process.env.PATH ?? ""
  if (!pathValue) return false

  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""]

  for (const dir of pathValue.split(delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      const candidate = join(dir, process.platform === "win32" ? `${command}${ext}` : command)
      try {
        accessSync(candidate, constants.X_OK)
        return true
      } catch {}
    }
  }
  return false
}

function requireCommands(tool: UpdateTool, commands: string[]): void {
  const missing = commands.filter(command => !commandExists(command))
  if (missing.length > 0) {
    throw new Error(`${tool} updater requires missing command(s): ${missing.join(", ")}`)
  }
}

export async function updateTool(tool: UpdateTool): Promise<ToolUpdateResult> {
  try {
    switch (tool) {
      case "cyberpunk": {
        const result = await runUpgrade()
        if (result.status === "up-to-date") return { tool, status: "up-to-date", message: "Cyberpunk is already up to date" }
        if (result.status === "error") return { tool, status: "error", message: result.error }
        return ok(tool, `Cyberpunk updated to ${result.toVersion ?? "latest"}`)
      }
      case "context-mode":
        requireCommands(tool, ["npm"])
        execSync("npm install -g context-mode@latest", { stdio: "pipe", timeout: 120000 })
        return ok(tool, "context-mode updated via npm")
      case "rtk":
        requireCommands(tool, ["sh", "curl"])
        execSync("sh -c \"curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh\"", { stdio: "pipe", timeout: 120000 })
        return ok(tool, "RTK updated via upstream install script")
      case "codebase-memory":
        requireCommands(tool, ["sh", "curl", "bash"])
        execSync("sh -c \"curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash\"", { stdio: "pipe", timeout: 120000 })
        return ok(tool, "codebase-memory-mcp updated via upstream install script")
    }
  } catch (err) {
    return fail(tool, err)
  }
}
