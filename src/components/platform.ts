// src/components/platform.ts — platform prerequisite checks for doctor

import { execSync } from "child_process"
import type { DoctorCheck } from "./types"
import { detectEnvironment, getPlaybackDependency, getPlatformLabel } from "../platform/detect"

export interface PlatformPrerequisites {
  ffmpeg: boolean
  npm: boolean
  bun: boolean
  curl: boolean
  git: boolean
}

function isOnPath(command: string): boolean {
  try {
    execSync(`which ${command} 2>/dev/null`, { encoding: "utf8", stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function getRuntimeDependencyChecks(): DoctorCheck[] {
  const environment = detectEnvironment()
  const playbackDependency = getPlaybackDependency(environment)
  const platformLabel = getPlatformLabel(environment)

  const opencodeAvailable = isOnPath("opencode")
  const playbackAvailable = isOnPath(playbackDependency)

  return [
    {
      id: "platform:opencode",
      label: "OpenCode CLI",
      status: opencodeAvailable ? "pass" : "warn",
      message: opencodeAvailable
        ? "OpenCode CLI disponible en PATH"
        : "OpenCode CLI no encontrado en PATH",
      fixable: false,
      detail: opencodeAvailable ? { group: "runtime" } : {
        group: "runtime",
        nextStep: `Instalá OpenCode CLI para ${platformLabel} y verificá que 'opencode' esté en PATH`,
      },
    },
    {
      id: "platform:playback",
      label: `Playback (${playbackDependency})`,
      status: playbackAvailable ? "pass" : "warn",
      message: playbackAvailable
        ? `${playbackDependency} disponible en PATH`
        : `${playbackDependency} no encontrado en PATH`,
      fixable: false,
      detail: playbackAvailable ? { group: "runtime" } : {
        group: "runtime",
        nextStep: `Instalá ${playbackDependency} para ${platformLabel} o habilitá una herramienta de reproducción compatible`,
      },
    },
  ]
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
    git: isOnPath("git"),
  }
}
