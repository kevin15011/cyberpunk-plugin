// src/updates/types.ts — multi-tool update contracts

export type UpdateTool = "cyberpunk" | "context-mode" | "rtk" | "codebase-memory"

export interface UpdateManagerOptions {
  ttlMs: number
  timeoutMs: number
  force?: boolean
}

export interface ToolUpdateStatus {
  tool: UpdateTool
  current?: string
  latest?: string
  available: boolean
  checkedAt: string
  error?: string
}

export interface ToolUpdateResult {
  tool: UpdateTool
  status: "updated" | "up-to-date" | "error"
  message?: string
}

export interface UpdateCacheFile {
  checkedAt: string
  tools: ToolUpdateStatus[]
}

export const UPDATE_TOOLS: UpdateTool[] = ["cyberpunk", "context-mode", "rtk", "codebase-memory"]
