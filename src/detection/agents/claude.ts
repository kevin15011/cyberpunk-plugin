// src/detection/agents/claude.ts — Claude agent detector (conservative, safe)

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { PlatformInfo } from "../../domain/environment"
import type { AgentDetectResult, AgentDetector } from "../types"

/**
 * Create a Claude agent detector with injectable dependencies.
 *
 * Conservative detection strategy:
 * - Probes for the `claude` CLI via `claude --version`
 * - Resolves the config directory for the platform
 * - Returns `status: "installed"` when binary is found
 * - Returns `status: "unsupported"` when binary is absent
 * - Returns `status: "unknown"` when detection encounters an unexpected error
 *
 * @param execFn — Function that runs a command and returns stdout.
 *                 Defaults to real execSync. Inject a stub for testing.
 * @param existsFn — Function that checks if a path exists on disk.
 *                   Defaults to real existsSync. Inject a stub for testing.
 */
export function createClaudeDetector(
  execFn: (cmd: string) => string = defaultExec,
  existsFn: (path: string) => boolean = defaultExists
): AgentDetector {
  return {
    target: "claude",

    detect(platform: PlatformInfo): AgentDetectResult {
      try {
        const output = execFn("claude --version")
        const version = output.trim()
        const configPath = findClaudeConfig(platform, existsFn)
        return { installed: true, version, configPath, status: "installed" }
      } catch (err) {
        // Distinguish between "not found" (unsupported) and unexpected errors (unknown)
        const message = err instanceof Error ? err.message : String(err)
        if (
          message.includes("not found") ||
          message.includes("ENOENT") ||
          message.includes("not recognized") ||
          message.includes("command not found")
        ) {
          return {
            installed: false,
            status: "unsupported",
            rationale: "Claude CLI binary not found on PATH",
          }
        }
        return {
          installed: false,
          status: "unknown",
          rationale: `Claude detection failed: ${message}`,
        }
      }
    },
  }
}

/**
 * Locate the Claude configuration directory for the given platform.
 * Claude Code stores config in:
 * - POSIX: ~/.claude/
 * - Windows: APPDATA/claude/ or USERPROFILE/.claude/
 *
 * Returns undefined if the directory does not exist.
 */
function findClaudeConfig(
  platform: PlatformInfo,
  existsFn: (path: string) => boolean
): string | undefined {
  try {
    const candidates = resolveClaudeConfigDirs(platform)
    for (const dir of candidates) {
      if (existsFn(dir)) {
        return dir
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve candidate Claude config directory paths for the platform.
 * Returns multiple candidates in priority order.
 */
function resolveClaudeConfigDirs(platform: PlatformInfo): string[] {
  if (platform.kind === "windows") {
    const candidates: string[] = []
    const appdata = process.env.APPDATA
    if (appdata) {
      candidates.push(join(appdata, "claude"))
    }
    const localAppdata = process.env.LOCALAPPDATA
    if (localAppdata) {
      candidates.push(join(localAppdata, "claude"))
    }
    const userProfile = process.env.USERPROFILE
    if (userProfile) {
      candidates.push(join(userProfile, ".claude"))
    }
    if (candidates.length === 0) {
      candidates.push(join(require("node:os").homedir(), ".claude"))
    }
    return candidates
  }

  // POSIX: linux, darwin, wsl
  const home = process.env.HOME || require("node:os").homedir()
  return [
    join(home, ".claude"),
    join(home, ".config", "claude"),
  ]
}

// --- Default implementations ---

function defaultExec(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", timeout: 5000 })
}

function defaultExists(path: string): boolean {
  return existsSync(path)
}
