// src/components/platform.ts — platform prerequisite checks for doctor

import { execSync } from "child_process"

export interface PlatformPrerequisites {
  ffmpeg: boolean
  npm: boolean
  bun: boolean
  curl: boolean
}

function isOnPath(command: string): boolean {
  try {
    execSync(`which ${command} 2>/dev/null`, { encoding: "utf8", stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/**
 * Check platform prerequisites. Returns availability for each tool.
 * Safe to call — no side effects.
 */
export function checkPlatformPrerequisites(): PlatformPrerequisites {
  return {
    ffmpeg: isOnPath("ffmpeg"),
    npm: isOnPath("npm"),
    bun: isOnPath("bun"),
    curl: isOnPath("curl"),
  }
}
