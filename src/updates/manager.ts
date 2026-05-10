// src/updates/manager.ts — update manager with TTL/cache and explicit apply

import { loadConfig } from "../config/load"
import { isUpdateCacheFresh, readUpdateCache, removeUpdateCache, writeUpdateCache } from "./cache"
import { checkToolUpdate } from "./checkers"
import { updateTool } from "./updaters"
import type { ToolUpdateResult, ToolUpdateStatus, UpdateManagerOptions, UpdateTool } from "./types"
import { UPDATE_TOOLS } from "./types"

export class UpdateManager {
  constructor(private options: UpdateManagerOptions) {}

  async checkAll(): Promise<ToolUpdateStatus[]> {
    const cached = readUpdateCache()
    if (!this.options.force && cached && isUpdateCacheFresh(cached, this.options.ttlMs)) {
      return cached.tools
    }

    const checked = await Promise.all(UPDATE_TOOLS.map(tool => checkToolUpdate(tool, this.options.timeoutMs)))
    writeUpdateCache({ checkedAt: new Date().toISOString(), tools: checked })
    return checked
  }

  async apply(tools: UpdateTool[]): Promise<ToolUpdateResult[]> {
    const results: ToolUpdateResult[] = []
    for (const tool of tools) results.push(await updateTool(tool))
    if (results.some(result => result.status === "updated")) removeUpdateCache()
    return results
  }
}

export function createUpdateManager(force = false): UpdateManager {
  const config = loadConfig()
  return new UpdateManager({ ttlMs: config.updates?.ttlMs ?? 24 * 60 * 60 * 1000, timeoutMs: config.updates?.timeoutMs ?? 2500, force })
}

export function formatUpdateNotice(statuses: ToolUpdateStatus[]): string {
  const available = statuses.filter(s => s.available)
  if (available.length === 0) return ""
  return [
    "Updates available:",
    ...available.map(s => `  - ${s.tool}: ${s.current ?? "unknown"} → ${s.latest ?? "latest"}`),
    "Run: cyberpunk upgrade --tool <name|all>",
  ].join("\n")
}
