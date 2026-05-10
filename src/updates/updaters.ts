// src/updates/updaters.ts — explicit updater actions only

import { execSync } from "child_process"
import { runUpgrade } from "../commands/upgrade"
import type { ToolUpdateResult, UpdateTool } from "./types"

function ok(tool: UpdateTool, message: string): ToolUpdateResult {
  return { tool, status: "updated", message }
}

function fail(tool: UpdateTool, err: unknown): ToolUpdateResult {
  return { tool, status: "error", message: err instanceof Error ? err.message : String(err) }
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
        execSync("npm install -g context-mode@latest", { stdio: "pipe", timeout: 120000 })
        return ok(tool, "context-mode updated via npm")
      case "rtk":
        execSync("sh -c \"curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh\"", { stdio: "pipe", timeout: 120000 })
        return ok(tool, "RTK updated via upstream install script")
      case "codebase-memory":
        execSync("sh -c \"curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash\"", { stdio: "pipe", timeout: 120000 })
        return ok(tool, "codebase-memory-mcp updated via upstream install script")
    }
  } catch (err) {
    return fail(tool, err)
  }
}
