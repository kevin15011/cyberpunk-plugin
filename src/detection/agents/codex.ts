// src/detection/agents/codex.ts — Codex agent detector for conservative token-tool support

import type { PlatformInfo } from "../../domain/environment"
import type { AgentDetectResult, AgentDetector } from "../types"
import { existsSync, readFileSync } from "fs"
import { CODEX_AGENTS_BLOCK_START, getCodexPaths } from "../../platform/codex-paths"

const CODEX_RATIONALE = "Codex full ecosystem support cannot be verified safely; only RTK/context-mode/codebase-memory token-saving assets are implemented"

/**
 * Create a Codex agent detector.
 *
 * This detector only checks Codex file locations. It does not invoke Codex.
 */
export function createCodexDetector(): AgentDetector {
  return {
    target: "codex",

    detect(_platform: PlatformInfo): AgentDetectResult {
      const paths = getCodexPaths()
      const installed = hasManagedCodexAssets(paths)
      return {
        installed,
        status: installed ? "installed" : "unknown",
        rationale: CODEX_RATIONALE,
        implemented: true,
        configPath: installed ? (existsSync(paths.configTomlPath) ? paths.configTomlPath : paths.agentsPath) : undefined,
      }
    },
  }
}

function hasManagedCodexAssets(paths: ReturnType<typeof getCodexPaths>): boolean {
  if (existsSync(paths.rtkRoutingPath) || existsSync(paths.contextModeRoutingPath) || existsSync(paths.codebaseMemoryRoutingPath)) return true
  if (!existsSync(paths.agentsPath)) return false
  try {
    return readFileSync(paths.agentsPath, "utf8").includes(CODEX_AGENTS_BLOCK_START)
  } catch {
    return false
  }
}
