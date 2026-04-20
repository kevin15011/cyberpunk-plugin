// src/config/save.ts — atomic write via .tmp then rename

import { writeFileSync, renameSync } from "fs"
import { CONFIG_PATH, CONFIG_DIR } from "./load"
import type { CyberpunkConfig } from "./schema"

export function saveConfig(config: CyberpunkConfig): void {
  const tmpPath = CONFIG_PATH + ".tmp"
  const content = JSON.stringify(config, null, 2) + "\n"

  writeFileSync(tmpPath, content, "utf8")
  renameSync(tmpPath, CONFIG_PATH)
}

/**
 * Update a nested config value via dot-path key.
 * e.g. "components.plugin.installed" → config.components.plugin.installed
 */
export function setConfigValue(config: CyberpunkConfig, key: string, value: string): boolean {
  const parts = key.split(".")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = config

  for (let i = 0; i < parts.length - 1; i++) {
    if (obj == null || typeof obj !== "object") return false
    obj = obj[parts[i]]
  }

  const lastKey = parts[parts.length - 1]
  if (obj == null || typeof obj !== "object" || !(lastKey in obj)) return false

  // Try parsing value as JSON (booleans, numbers, null, quoted strings)
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    parsed = value
  }

  obj[lastKey] = parsed
  return true
}

/**
 * Get a nested config value via dot-path key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getConfigValue(config: CyberpunkConfig, key: string): { found: boolean; value: any } {
  const parts = key.split(".")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = config

  for (const part of parts) {
    if (obj == null || typeof obj !== "object") return { found: false, value: undefined }
    obj = obj[part]
  }

  return { found: true, value: obj }
}
