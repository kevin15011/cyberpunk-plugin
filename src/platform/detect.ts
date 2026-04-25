// src/platform/detect.ts — lightweight runtime platform detection

import * as fs from "node:fs"

export type DetectedEnvironment = "linux" | "wsl" | "darwin" | "windows"

export function getPlaybackDependency(environment?: DetectedEnvironment | null): "paplay" | "afplay" | "ffmpeg" {
  if (environment === "darwin") {
    return "afplay"
  }

  if (environment === "windows") {
    // Windows uses ffmpeg for sound generation and playback
    return "ffmpeg"
  }

  // Linux, WSL use paplay (PulseAudio)
  return "paplay"
}

export function getPlatformLabel(environment?: DetectedEnvironment | null): string {
  switch (environment) {
    case "darwin":
      return "macOS"
    case "wsl":
      return "WSL"
    case "windows":
      return "Windows"
    case "linux":
    default:
      return "Linux"
  }
}

export function isWSL(): boolean {
  if (process.platform !== "linux") {
    return false
  }

  try {
    const version = fs.readFileSync("/proc/version", "utf8").toLowerCase()
    return version.includes("microsoft") || version.includes("wsl")
  } catch {
    return false
  }
}

export function detectEnvironment(): DetectedEnvironment {
  if (process.platform === "win32") {
    return "windows"
  }

  if (process.platform === "darwin") {
    return "darwin"
  }

  return isWSL() ? "wsl" : "linux"
}
