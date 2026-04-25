// src/detection/agents/opencode.ts — OpenCode agent detector

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { PlatformInfo } from "../../domain/environment"
import type { AgentDetectResult, AgentDetector } from "../types"

/**
 * Create an OpenCode agent detector with injectable dependencies.
 *
 * @param execFn — Function that runs `opencode --version` and returns stdout.
 *                 Defaults to real execSync. Inject a stub for testing.
 * @param existsFn — Function that checks if a path exists on disk.
 *                   Defaults to real existsSync. Inject a stub for testing.
 */
export function createOpenCodeDetector(
  execFn: (cmd: string) => string = defaultExec,
  existsFn: (path: string) => boolean = defaultExists
): AgentDetector {
  return {
    target: "opencode",

    detect(platform: PlatformInfo): AgentDetectResult {
      try {
        const output = execFn("opencode --version")
        const version = output.trim()
        const configPath = findOpenCodeConfig(platform, existsFn)
        return { installed: true, version, configPath }
      } catch {
        // opencode binary not found or not executable — safe fallback
        return { installed: false }
      }
    },
  }
}

/**
 * Locate the OpenCode configuration directory for the given platform.
 * Returns undefined if the directory does not exist.
 */
function findOpenCodeConfig(
  platform: PlatformInfo,
  existsFn: (path: string) => boolean
): string | undefined {
  try {
    const configDir = resolveOpenCodeConfigDir(platform)
    if (existsFn(configDir)) {
      return configDir
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve the expected OpenCode config directory path for the platform.
 * OpenCode stores config in ~/.config/opencode (POSIX) or
 * APPDATA/opencode (Windows).
 */
function resolveOpenCodeConfigDir(platform: PlatformInfo): string {
  if (platform.kind === "windows") {
    const appdata = process.env.APPDATA || process.env.LOCALAPPDATA || ""
    if (appdata) {
      return join(appdata, "opencode")
    }
    const userProfile = process.env.USERPROFILE
    if (userProfile) {
      return join(userProfile, ".config", "opencode")
    }
    return join(require("node:os").homedir(), ".config", "opencode")
  }

  // POSIX: linux, darwin, wsl
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg || (process.env.HOME || require("node:os").homedir())
  return join(base, ".config", "opencode")
}

// --- Default implementations ---

function defaultExec(cmd: string): string {
  return execSync(cmd, { encoding: "utf8", timeout: 5000 })
}

function defaultExists(path: string): boolean {
  return existsSync(path)
}
