// src/opencode-config.ts — register/unregister OpenCode plugin entries in opencode.json

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "fs"
import { join } from "path"

export const CYBERPUNK_PLUGIN_ENTRY = "./plugins/cyberpunk"
export const RTK_PLUGIN_ENTRY = "./plugins/rtk"

export interface OpenCodePluginUpdateResult {
  changed: boolean
  registered: boolean
  warning?: string
}

interface OpenCodeConfig {
  plugin?: string[]
  [key: string]: unknown
}

function getOpenCodeConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "~"
  return join(home, ".config", "opencode")
}

function getOpenCodeConfigPath(): string {
  return join(getOpenCodeConfigDir(), "opencode.json")
}

function hasValidPluginArray(config: OpenCodeConfig): config is OpenCodeConfig & { plugin: string[] } {
  return Array.isArray(config.plugin) && config.plugin.every(entry => typeof entry === "string")
}

/**
 * Read OpenCode config from disk. Returns null if file doesn't exist
 * or can't be parsed.
 */
function readOpenCodeConfig(): OpenCodeConfig | null {
  const configPath = getOpenCodeConfigPath()
  if (!existsSync(configPath)) return null
  try {
    const raw = readFileSync(configPath, "utf8")
    return JSON.parse(raw) as OpenCodeConfig
  } catch {
    return null
  }
}

/**
 * Atomic write: write to .tmp then rename over target.
 */
function writeOpenCodeConfig(config: OpenCodeConfig): void {
  const configDir = getOpenCodeConfigDir()
  const configPath = getOpenCodeConfigPath()
  mkdirSync(configDir, { recursive: true })
  const tmpPath = configPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
  renameSync(tmpPath, configPath)
}

/**
 * Register a plugin entry in OpenCode config plugin array.
 * Idempotent — will not create duplicate entries.
 * Non-fatal — missing file or invalid plugin field is skipped with warning.
 */
export function registerOpenCodePlugin(pluginEntry: string): OpenCodePluginUpdateResult {
  const config = readOpenCodeConfig()

  if (config === null) {
    return {
      changed: false,
      registered: false,
      warning: "OpenCode config not found — registration skipped",
    }
  }

  // Validate plugin field is an array
  if (config.plugin !== undefined && !hasValidPluginArray(config)) {
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
  if (config.plugin.includes(pluginEntry)) {
    return { changed: false, registered: true }
  }

  // Append
  config.plugin.push(pluginEntry)
  writeOpenCodeConfig(config)

  return { changed: true, registered: true }
}

export function registerCyberpunkPlugin(): OpenCodePluginUpdateResult {
  return registerOpenCodePlugin(CYBERPUNK_PLUGIN_ENTRY)
}

/**
 * Unregister a plugin entry from OpenCode config plugin array.
 * Only removes the target entry, leaves others untouched.
 * Non-fatal — missing file or invalid plugin field is skipped silently.
 */
export function unregisterOpenCodePlugin(pluginEntry: string): OpenCodePluginUpdateResult {
  const config = readOpenCodeConfig()

  if (config === null) {
    return { changed: false, registered: false }
  }

  // Validate plugin field
  if (!hasValidPluginArray(config)) {
    return { changed: false, registered: false }
  }

  const idx = config.plugin.indexOf(pluginEntry)
  if (idx === -1) {
    return { changed: false, registered: false }
  }

  config.plugin.splice(idx, 1)
  writeOpenCodeConfig(config)

  return { changed: true, registered: false }
}

export function unregisterCyberpunkPlugin(): OpenCodePluginUpdateResult {
  return unregisterOpenCodePlugin(CYBERPUNK_PLUGIN_ENTRY)
}

export function isOpenCodePluginRegistered(pluginEntry: string): boolean {
  const config = readOpenCodeConfig()
  return config !== null && hasValidPluginArray(config) && config.plugin.includes(pluginEntry)
}
