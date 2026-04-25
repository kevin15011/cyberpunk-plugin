// src/platform/paths.ts — Windows-safe home/config path resolution and path joins

import { posix, win32 } from "node:path"
import { homedir } from "node:os"
import type { PlatformInfo } from "../domain/environment"

/**
 * Select the appropriate path module for the platform.
 * Windows uses backslash separators; POSIX uses forward slashes.
 */
function pathFor(platform: PlatformInfo["kind"]) {
  return platform === "windows" ? win32 : posix
}

/**
 * Get the configuration root directory for the given platform.
 * - Windows: APPDATA/cyberpunk, LOCALAPPDATA/cyberpunk, or USERPROFILE/.config/cyberpunk
 * - POSIX (linux, darwin, wsl): XDG_CONFIG_HOME/cyberpunk or HOME/.config/cyberpunk
 */
export function getConfigRoot(platform: PlatformInfo): string {
  const path = pathFor(platform.kind)

  if (platform.kind === "windows") {
    const appdata = process.env.APPDATA
    if (appdata) {
      return path.join(appdata, "cyberpunk")
    }
    const localAppdata = process.env.LOCALAPPDATA
    if (localAppdata) {
      return path.join(localAppdata, "cyberpunk")
    }
    const userProfile = normalizeHomeEnv(process.env.USERPROFILE)
    if (userProfile) {
      return path.join(userProfile, ".config", "cyberpunk")
    }
    // Ultimate fallback — should not happen on a healthy Windows system
    return path.join(homedir(), ".config", "cyberpunk")
  }

  // POSIX: linux, darwin, wsl
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) {
    return path.join(xdg, "cyberpunk")
  }
  const home = normalizeHomeEnv(process.env.HOME) || homedir()
  return path.join(home, ".config", "cyberpunk")
}

/**
 * Get the home directory for the given platform.
 * - Windows: USERPROFILE
 * - POSIX: HOME or os.homedir()
 */
export function getHomeDir(platform: PlatformInfo): string {
  if (platform.kind === "windows") {
    return normalizeHomeEnv(process.env.USERPROFILE) || homedir()
  }
  return normalizeHomeEnv(process.env.HOME) || homedir()
}

function normalizeHomeEnv(value: string | undefined): string | undefined {
  if (!value || value === "~") return undefined
  return value
}

/**
 * Platform-aware path join. Uses the appropriate separator for the current OS.
 */
export function joinPath(...segments: string[]): string {
  return posix.join(...segments)
}

/**
 * Convenience: get the home directory for the current runtime environment.
 * Detects the platform automatically and delegates to getHomeDir().
 */
export function getHomeDirAuto(): string {
  const { detectEnvironment } = require("./detect") as typeof import("./detect")
  const kind = detectEnvironment()
  return getHomeDir({ kind, arch: process.arch as NodeJS.Architecture, configRoot: "" })
}
