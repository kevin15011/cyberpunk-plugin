// src/components/tui-plugins.ts — register TUI plugins in tui.json (sdd-engram-manage + subagent-statusline)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"

const TUI_PLUGIN_ENTRIES = [
  "opencode-sdd-engram-manage",
  "opencode-subagent-statusline",
]

function getTuiPaths() {
  const home = getHomeDirAuto()
  const configDir = join(home, ".config", "opencode")
  return {
    configDir,
    tuiPath: join(configDir, "tui.json"),
  }
}

interface TuiConfig {
  "$schema"?: string
  theme?: string
  plugins?: string[]
  [key: string]: unknown
}

function readTuiConfig(): TuiConfig | null {
  const { tuiPath } = getTuiPaths()
  if (!existsSync(tuiPath)) return null
  try {
    return JSON.parse(readFileSync(tuiPath, "utf8")) as TuiConfig
  } catch {
    return null
  }
}

function writeTuiConfig(config: TuiConfig): void {
  const { configDir, tuiPath } = getTuiPaths()
  mkdirSync(configDir, { recursive: true })
  const tmpPath = tuiPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
  const { renameSync } = require("fs") as typeof import("fs")
  renameSync(tmpPath, tuiPath)
}

function isTuiPluginRegistered(pluginName: string): boolean {
  const config = readTuiConfig()
  return config !== null && Array.isArray(config.plugins) && config.plugins.includes(pluginName)
}

function ensurePlugins(): boolean {
  let config = readTuiConfig()
  let changed = false

  if (!config) {
    config = {
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
      plugins: [],
    }
    changed = true
  }

  if (!config.plugins) {
    config.plugins = []
    changed = true
  }

  for (const entry of TUI_PLUGIN_ENTRIES) {
    if (!config.plugins.includes(entry)) {
      config.plugins.push(entry)
      changed = true
    }
  }

  if (changed) {
    writeTuiConfig(config)
  }

  return changed
}

function removePlugins(): boolean {
  const config = readTuiConfig()
  if (!config || !Array.isArray(config.plugins)) return false

  let changed = false
  for (const entry of TUI_PLUGIN_ENTRIES) {
    const idx = config.plugins.indexOf(entry)
    if (idx !== -1) {
      config.plugins.splice(idx, 1)
      changed = true
    }
  }

  if (changed) {
    writeTuiConfig(config)
  }

  return changed
}

export function getTuiPluginsComponent(): ComponentModule {
  return {
    id: "tui-plugins",
    label: COMPONENT_LABELS["tui-plugins"],

    async install(): Promise<InstallResult> {
      const changed = ensurePlugins()

      const config = loadConfig()
      config.components["tui-plugins"] = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
      }
      saveConfig(config)

      return {
        component: "tui-plugins",
        action: "install",
        status: changed ? "success" : "skipped",
        message: changed
          ? "TUI plugins registrados en tui.json"
          : "TUI plugins ya registrados",
      }
    },

    async uninstall(): Promise<InstallResult> {
      removePlugins()

      const config = loadConfig()
      config.components["tui-plugins"] = { installed: false }
      saveConfig(config)

      return {
        component: "tui-plugins",
        action: "uninstall",
        status: "success",
      }
    },

    async status(): Promise<ComponentStatus> {
      const allRegistered = TUI_PLUGIN_ENTRIES.every(p => isTuiPluginRegistered(p))

      if (allRegistered) {
        return {
          id: "tui-plugins",
          label: COMPONENT_LABELS["tui-plugins"],
          status: "installed",
        }
      }

      const someRegistered = TUI_PLUGIN_ENTRIES.some(p => isTuiPluginRegistered(p))
      if (someRegistered) {
        return {
          id: "tui-plugins",
          label: COMPONENT_LABELS["tui-plugins"],
          status: "available",
          error: "Algunos TUI plugins no están registrados",
        }
      }

      return {
        id: "tui-plugins",
        label: COMPONENT_LABELS["tui-plugins"],
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []

      for (const pluginName of TUI_PLUGIN_ENTRIES) {
        const registered = isTuiPluginRegistered(pluginName)
        if (!registered) {
          checks.push({
            id: `tui-plugins:registration:${pluginName}`,
            label: `TUI plugin: ${pluginName}`,
            status: "fail",
            message: `${pluginName} no registrado en tui.json`,
            fixable: true,
          })
        } else {
          checks.push({
            id: `tui-plugins:registration:${pluginName}`,
            label: `TUI plugin: ${pluginName}`,
            status: "pass",
            message: `${pluginName} registrado en tui.json`,
            fixable: false,
          })
        }
      }

      return { component: "tui-plugins", checks }
    },
  }
}
