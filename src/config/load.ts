// src/config/load.ts — read config, auto-create dirs + file on first access

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import type { CyberpunkConfig, ComponentId, ComponentState } from "./schema"
import { createDefaultConfig, COMPONENT_IDS } from "./schema"

function getHomeDir(): string {
  const envHome = process.env.HOME
  if (envHome && envHome !== "~") return envHome

  const userProfile = process.env.USERPROFILE
  if (userProfile && userProfile !== "~") return userProfile

  return homedir()
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
 * Normalize a config object to v2 shape in memory without mutating the original.
 *
 * - Adds `target: "opencode"` when missing (legacy v1 compat)
 * - Defaults `installMode` to `"repo"` when missing
 * - Ensures all 6 component entries exist with `installed: false` defaults
 * - Adds empty `agentState` when missing
 * - Upgrades `version` to 2 when incoming is v1
 *
 * The returned object is a fresh copy — the input is never mutated.
 * No disk write occurs.
 */
export function normalizeConfig(config: CyberpunkConfig): CyberpunkConfig {
  const defaults = createDefaultConfig()

  // Build normalized components, filling missing entries with defaults
  const components: Record<ComponentId, ComponentState> = { ...defaults.components }
  for (const id of COMPONENT_IDS) {
    if (config.components && config.components[id]) {
      components[id] = { ...config.components[id] }
    }
  }

  return {
    ...config,
    version: config.version < 2 ? 2 : config.version,
    components,
    installMode: config.installMode ?? "repo",
    target: config.target ?? "opencode",
    profile: config.profile,
    agentState: config.agentState ?? {},
    repoUrl: config.repoUrl ?? defaults.repoUrl,
    lastUpgradeCheck: config.lastUpgradeCheck,
    pluginRegistered: config.pluginRegistered,
  }
}

/**
 * Load config from disk. Auto-creates if missing.
 * Normalizes to v2 shape in memory (no disk write).
 */
export function loadConfig(): CyberpunkConfig {
  ensureConfigExists()
  const raw = readFileSync(getConfigPath(), "utf8")
  const config = JSON.parse(raw) as CyberpunkConfig
  return normalizeConfig(config)
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
