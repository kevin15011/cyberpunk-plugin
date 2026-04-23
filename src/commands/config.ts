// src/commands/config.ts — get/set/list/init config values

import { loadConfig, ensureConfigExists } from "../config/load"
import { saveConfig, setConfigValue, getConfigValue } from "../config/save"
import { createDefaultConfig, COMPONENT_LABELS, type ComponentId } from "../config/schema"
import type { CyberpunkConfig } from "../config/schema"

export interface ConfigCommandResult {
  action: "init" | "list" | "get" | "set"
  key?: string
  value?: unknown
  config: CyberpunkConfig
  message: string
  success: boolean
}

export async function runConfigCommand(opts: {
  list?: boolean
  init?: boolean
  key?: string
  value?: string
  json?: boolean
}): Promise<ConfigCommandResult> {
  // --init: create default config if none exists
  if (opts.init) {
    const created = ensureConfigExists()
    const config = loadConfig()
    return {
      action: "init",
      config,
      message: created ? "Config creado con valores por defecto" : "Config ya existe — sin cambios",
      success: true,
    }
  }

  // --list: show all config keys
  if (opts.list) {
    const config = loadConfig()
    return {
      action: "list",
      config,
      message: "Configuración actual",
      success: true,
    }
  }

  const config = loadConfig()

  // key only: get value
  if (opts.key && !opts.value) {
    const { found, value } = getConfigValue(config, opts.key)
    if (!found) {
      return {
        action: "get",
        key: opts.key,
        config,
        message: `(no definido)`,
        success: false,
      }
    }
    return {
      action: "get",
      key: opts.key,
      value,
      config,
      message: typeof value === "string" ? value : JSON.stringify(value),
      success: true,
    }
  }

  // key + value: set value
  if (opts.key && opts.value) {
    const ok = setConfigValue(config, opts.key, opts.value)
    if (!ok) {
      return {
        action: "set",
        key: opts.key,
        config,
        message: `Clave "${opts.key}" no encontrada en config`,
        success: false,
      }
    }
    saveConfig(config)
    const { value: newValue } = getConfigValue(config, opts.key)
    return {
      action: "set",
      key: opts.key,
      value: newValue,
      config,
      message: `${opts.key} = ${JSON.stringify(newValue)}`,
      success: true,
    }
  }

  // No key, no list, no init — default to list
  return {
    action: "list",
    config,
    message: "Configuración actual",
    success: true,
  }
}

export function formatConfigOutput(result: ConfigCommandResult, asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(result.config, null, 2)
  }

  if (result.action === "get") {
    return result.value !== undefined ? String(result.value) : result.message
  }

  if (result.action === "set") {
    return result.message
  }

  if (result.action === "init") {
    return result.message
  }

  // list — pretty print
  return formatConfigTree(result.config)
}

function formatConfigTree(config: CyberpunkConfig, indent = 0): string {
  const prefix = "  ".repeat(indent)
  const lines: string[] = []

  lines.push(`${prefix}version: ${config.version}`)

  lines.push(`${prefix}components:`)
  for (const [id, state] of Object.entries(config.components)) {
    const label = COMPONENT_LABELS[id as ComponentId] || id
    const status = state.installed ? "✓ instalado" : "○ disponible"
    lines.push(`${prefix}  ${id} (${label}): ${status}`)
    if (state.version) lines.push(`${prefix}    version: ${state.version}`)
    if (state.installedAt) lines.push(`${prefix}    installedAt: ${state.installedAt}`)
    if (state.path) lines.push(`${prefix}    path: ${state.path}`)
  }

  lines.push(`${prefix}lastUpgradeCheck: ${config.lastUpgradeCheck || "(no definido)"}`)
  lines.push(`${prefix}repoUrl: ${config.repoUrl || "(no definido)"}`)

  return lines.join("\n")
}
