// src/config/load.ts — read config, auto-create dirs + file on first access

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { join } from "path"
import type { CyberpunkConfig } from "./schema"
import { createDefaultConfig } from "./schema"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
export const CONFIG_DIR = join(HOME, ".config", "cyberpunk")
export const CONFIG_PATH = join(CONFIG_DIR, "config.json")

/**
 * Ensure config directory and file exist. Creates defaults if missing.
 * Returns true if config was created fresh.
 */
export function ensureConfigExists(): boolean {
  if (existsSync(CONFIG_PATH)) return false
  mkdirSync(CONFIG_DIR, { recursive: true })
  const defaultConfig = createDefaultConfig()
  const tmpPath = CONFIG_PATH + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8")
  renameSync(tmpPath, CONFIG_PATH)
  return true
}

/**
 * Load config from disk. Auto-creates if missing.
 * Normalizes missing installMode to "repo" in memory (no disk write).
 */
export function loadConfig(): CyberpunkConfig {
  ensureConfigExists()
  const raw = readFileSync(CONFIG_PATH, "utf8")
  const config = JSON.parse(raw) as CyberpunkConfig
  // Normalize missing installMode to "repo" in memory without writing to disk
  if (!config.installMode) {
    config.installMode = "repo"
  }
  return config
}
