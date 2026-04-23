// src/config/load.ts — read config, auto-create dirs + file on first access

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { join } from "path"
import type { CyberpunkConfig } from "./schema"
import { createDefaultConfig } from "./schema"

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || "~"
}

export function getConfigDir(): string {
  return join(getHomeDir(), ".config", "cyberpunk")
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json")
}

/**
 * Ensure config directory and file exist. Creates defaults if missing.
 * Returns true if config was created fresh.
 */
export function ensureConfigExists(): boolean {
  const configDir = getConfigDir()
  const configPath = getConfigPath()

  if (existsSync(configPath)) return false
  mkdirSync(configDir, { recursive: true })
  const defaultConfig = createDefaultConfig()
  const tmpPath = configPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8")
  renameSync(tmpPath, configPath)
  return true
}

/**
 * Load config from disk. Auto-creates if missing.
 * Normalizes missing installMode to "repo" in memory (no disk write).
 */
export function loadConfig(): CyberpunkConfig {
  ensureConfigExists()
  const raw = readFileSync(getConfigPath(), "utf8")
  const config = JSON.parse(raw) as CyberpunkConfig
  // Normalize missing installMode to "repo" in memory without writing to disk
  if (!config.installMode) {
    config.installMode = "repo"
  }
  return config
}

/**
 * Raw, non-mutating config read for doctor diagnostics.
 * Does NOT auto-create, normalize, or write anything.
 * Returns the parsed object, raw string, file path, and any parse error.
 */
export function readConfigRaw(): {
  parsed: Record<string, unknown> | null
  raw: string
  path: string
  error: string | null
} {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return { parsed: null, raw: "", path: configPath, error: "Config file does not exist" }
  }
  let raw: string
  try {
    raw = readFileSync(configPath, "utf8")
  } catch (err) {
    return {
      parsed: null,
      raw: "",
      path: configPath,
      error: `Cannot read config: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return { parsed, raw, path: configPath, error: null }
  } catch (err) {
    return {
      parsed: null,
      raw,
      path: configPath,
      error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
