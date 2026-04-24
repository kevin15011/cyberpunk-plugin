// src/platform/detect.ts — lightweight runtime platform detection

import * as fs from "node:fs"

export type DetectedEnvironment = "linux" | "wsl" | "darwin"

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
  if (process.platform === "darwin") {
    return "darwin"
  }

  return isWSL() ? "wsl" : "linux"
}
