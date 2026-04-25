// src/components/platform.ts — platform prerequisite checks for doctor

import type { DoctorCheck } from "./types"
import { detectEnvironment, getPlaybackDependency, getPlatformLabel } from "../platform/detect"
import { isCommandOnPath } from "../platform/shell"

export interface PlatformPrerequisites {
  ffmpeg: boolean
  npm: boolean
  bun: boolean
  curl: boolean
  git: boolean
}

export function getRuntimeDependencyChecks(): DoctorCheck[] {
  const environment = detectEnvironment()
  const playbackDependency = getPlaybackDependency(environment)
  const platformLabel = getPlatformLabel(environment)

  const opencodeAvailable = isCommandOnPath("opencode")
  const playbackAvailable = isCommandOnPath(playbackDependency)

  return [
    {
      id: "platform:opencode",
      label: "OpenCode CLI",
      status: opencodeAvailable ? "pass" : "warn",
      message: opencodeAvailable
        ? "OpenCode CLI available on PATH"
        : "OpenCode CLI not found on PATH",
      fixable: false,
      detail: opencodeAvailable ? { group: "runtime" } : {
        group: "runtime",
        nextStep: `Install OpenCode CLI for ${platformLabel} and verify 'opencode' is on PATH`,
      },
    },
    {
      id: "platform:playback",
      label: `Playback (${playbackDependency})`,
      status: playbackAvailable ? "pass" : "warn",
      message: playbackAvailable
        ? `${playbackDependency} available on PATH`
        : `${playbackDependency} not found on PATH`,
      fixable: false,
      detail: playbackAvailable ? { group: "runtime" } : {
        group: "runtime",
        nextStep: `Install ${playbackDependency} for ${platformLabel} or enable a compatible playback tool`,
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
    ffmpeg: isCommandOnPath("ffmpeg"),
    npm: isCommandOnPath("npm"),
    bun: isCommandOnPath("bun"),
    curl: isCommandOnPath("curl"),
    git: isCommandOnPath("git"),
  }
}

/**
 * Check if xattr command is available (macOS quarantine handling).
 */
export function isXattrAvailable(): boolean {
  return isCommandOnPath("xattr")
}

/**
 * Check if codesign command is available (macOS binary verification).
 */
export function canCheckCodesign(): boolean {
  return isCommandOnPath("codesign")
}
