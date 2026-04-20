// src/opencode-config.ts — register/unregister ./plugins/cyberpunk in OpenCode config

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const OPENCODE_CONFIG_DIR = join(HOME, ".config", "opencode")
const OPENCODE_CONFIG_PATH = join(OPENCODE_CONFIG_DIR, "config.json")

export const CYBERPUNK_PLUGIN_ENTRY = "./plugins/cyberpunk"

export interface OpenCodePluginUpdateResult {
  changed: boolean
  registered: boolean
  warning?: string
}

interface OpenCodeConfig {
  plugin?: string[]
  [key: string]: unknown
}

/**
 * Read OpenCode config from disk. Returns null if file doesn't exist
 * or can't be parsed.
 */
function readOpenCodeConfig(): OpenCodeConfig | null {
  if (!existsSync(OPENCODE_CONFIG_PATH)) return null
  try {
    const raw = readFileSync(OPENCODE_CONFIG_PATH, "utf8")
    return JSON.parse(raw) as OpenCodeConfig
  } catch {
    return null
  }
}

/**
 * Atomic write: write to .tmp then rename over target.
 */
function writeOpenCodeConfig(config: OpenCodeConfig): void {
  mkdirSync(OPENCODE_CONFIG_DIR, { recursive: true })
  const tmpPath = OPENCODE_CONFIG_PATH + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
  renameSync(tmpPath, OPENCODE_CONFIG_PATH)
}

/**
 * Register ./plugins/cyberpunk in OpenCode config plugin array.
 * Idempotent — will not create duplicate entries.
 * Non-fatal — missing file or invalid plugin field is skipped with warning.
 */
export function registerCyberpunkPlugin(): OpenCodePluginUpdateResult {
  const config = readOpenCodeConfig()

  if (config === null) {
    return {
      changed: false,
      registered: false,
      warning: "OpenCode config not found — registration skipped",
    }
  }

  // Validate plugin field is an array
  if (config.plugin !== undefined && !Array.isArray(config.plugin)) {
    return {
      changed: false,
      registered: false,
      warning: "OpenCode config 'plugin' field is not an array — registration skipped",
    }
  }

  // Initialize plugin array if missing
  if (!config.plugin) {
    config.plugin = []
  }

  // Idempotent: skip if already registered
  if (config.plugin.includes(CYBERPUNK_PLUGIN_ENTRY)) {
    return { changed: false, registered: true }
  }

  // Append
  config.plugin.push(CYBERPUNK_PLUGIN_ENTRY)
  writeOpenCodeConfig(config)

  return { changed: true, registered: true }
}

/**
 * Unregister ./plugins/cyberpunk from OpenCode config plugin array.
 * Only removes the cyberpunk entry, leaves others untouched.
 * Non-fatal — missing file is skipped silently.
 */
export function unregisterCyberpunkPlugin(): OpenCodePluginUpdateResult {
  const config = readOpenCodeConfig()

  if (config === null) {
    return { changed: false, registered: false }
  }

  // Validate plugin field
  if (!Array.isArray(config.plugin)) {
    return { changed: false, registered: false }
  }

  const idx = config.plugin.indexOf(CYBERPUNK_PLUGIN_ENTRY)
  if (idx === -1) {
    return { changed: false, registered: false }
  }

  config.plugin.splice(idx, 1)
  writeOpenCodeConfig(config)

  return { changed: true, registered: false }
}
