// src/components/plugin.ts — copy plugin to ~/.config/opencode/plugins/cyberpunk.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { registerCyberpunkPlugin, unregisterCyberpunkPlugin, isOpenCodePluginRegistered, CYBERPUNK_PLUGIN_ENTRY } from "../opencode-config"
import { getHomeDirAuto } from "../platform/paths"

function getPluginPaths() {
  const home = getHomeDirAuto()
  const opencodePluginsDir = join(home, ".config", "opencode", "plugins")

  return {
    home,
    opencodePluginsDir,
    targetPath: join(opencodePluginsDir, "cyberpunk.ts"),
  }
}

function getConfiguredPluginPath(ctx: DoctorContext): string {
  return ctx.cyberpunkConfig?.components?.plugin?.path || getPluginPaths().targetPath
}

function isManagedPluginPath(targetPath: string): boolean {
  return targetPath === getPluginPaths().targetPath
}

// Re-export SDD patching constants and helpers from sdd-integration for backward compatibility.
// The plugin component NO LONGER owns SDD patching — it delegates to sdd-integration.
export {
  START_MARKER,
  END_MARKER,
  SECTION_E_TEMPLATE,
  SECTION_F_TEMPLATE,
  MANAGED_SDD_TEMPLATE,
  extractBetweenMarkers,
  patchSddPhaseCommon,
} from "./sdd-integration"

// This is the slimmed plugin source that gets installed.
// It handles sound playback on events only. SDD patching is NOT included.
const PLUGIN_SOURCE = `// cyberpunk.ts — runtime plugin (installed by cyberpunk CLI)
import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME!
const SOUNDS = join(HOME, ".config", "opencode", "sounds")
const IS_MAC = process.platform === "darwin"
const COMPLETION_THROTTLE_MS = 2000
let lastCompletionTime = 0

async function playSound($: any, file: string) {
  const path = join(SOUNDS, file)
  if (!existsSync(path)) return
  if (IS_MAC) {
    await $\`afplay \${path}\`.nothrow()
  } else {
    await $\`paplay \${path}\`.nothrow()
  }
}

async function playCompletionSound($: any) {
  const now = Date.now()
  if (now - lastCompletionTime > COMPLETION_THROTTLE_MS) {
    lastCompletionTime = now
    try { await playSound($, "idle.wav") } catch {}
  }
}

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await playCompletionSound($)
      }

      if (event.type === "session.status") {
        const status = (event as any).properties?.status
        if (status?.type === "idle") {
          await playCompletionSound($)
        }
      }

      if (event.type === "session.error") {
        try { await playSound($, "error.wav") } catch {}
      }

      if (event.type === "session.compacted") {
        try { await playSound($, "compact.wav") } catch {}
      }

      if (event.type === "permission.asked") {
        try { await playSound($, "permission.wav") } catch {}
      }
    },
  }
}
`

// Export helpers for testing
export {
  PLUGIN_SOURCE,
  getPluginPaths,
  isManagedPluginPath,
}

// Export patching helper for backward compatibility — delegates to sdd-integration
export function applyPatch(): boolean {
  const { patchSddPhaseCommon } = require("./sdd-integration") as typeof import("./sdd-integration")
  return patchSddPhaseCommon()
}

export function restoreBundledPluginSource(): boolean {
  const { opencodePluginsDir, targetPath } = getPluginPaths()
  mkdirSync(opencodePluginsDir, { recursive: true })
  const tmpPath = targetPath + ".tmp"
  writeFileSync(tmpPath, PLUGIN_SOURCE, "utf8")
  renameSync(tmpPath, targetPath)
  return true
}

/**
 * Plugin doctor checks: (1) plugin file exists, (2) registered in OpenCode config.
 * SDD patching checks are owned by sdd-integration component.
 */
export async function checkPluginDoctor(ctx: DoctorContext): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []
  const verbose = ctx.verbose
  const { targetPath } = getPluginPaths()
  const configuredPluginPath = getConfiguredPluginPath(ctx)

  // Check 1: plugin file exists
  if (!existsSync(targetPath)) {
    checks.push({
      id: "plugin:file",
      label: "Archivo de plugin",
      status: "fail",
      message: `Plugin no encontrado en ${targetPath}`,
      fixable: false, // Requires full install, not doctor scope
    })
  } else {
    const details = verbose ? ` (${targetPath})` : ""
    checks.push({
      id: "plugin:file",
      label: "Archivo de plugin",
      status: "pass",
      message: `Plugin existe${details}`,
      fixable: false,
    })
  }

  if (!existsSync(configuredPluginPath)) {
    checks.push({
      id: "plugin:source-drift",
      label: "Source drift del plugin",
      status: "warn",
      message: `No se pudo validar el source drift porque falta ${configuredPluginPath}`,
      fixable: false,
      detail: {
        nextStep: isManagedPluginPath(configuredPluginPath)
          ? "Reinstalá el plugin con cyberpunk install --plugin"
          : "Revisá manualmente la instalación del plugin",
      },
    })
  } else {
    const installedSource = readFileSync(configuredPluginPath, "utf8")
    const managedPath = isManagedPluginPath(configuredPluginPath)
    const sourceMatches = installedSource === PLUGIN_SOURCE
    checks.push({
      id: "plugin:source-drift",
      label: "Source drift del plugin",
      status: sourceMatches ? "pass" : "fail",
      message: sourceMatches
        ? "El plugin instalado coincide con el bundle actual"
        : `El plugin instalado difiere del bundle${verbose ? ` (${configuredPluginPath})` : ""}`,
      fixable: !sourceMatches && managedPath,
      detail: sourceMatches ? undefined : {
        nextStep: managedPath
          ? "Ejecutá cyberpunk doctor --fix --plugin para reinstalar el plugin gestionado"
          : "La ruta del plugin no es gestionada por cyberpunk; reparalo manualmente",
      },
    })
  }

  // Check 2: registered in OpenCode config
  const isRegistered = isOpenCodePluginRegistered(CYBERPUNK_PLUGIN_ENTRY)
  if (!isRegistered) {
    checks.push({
      id: "plugin:registration",
      label: "Registro en OpenCode",
      status: "fail",
      message: `"${CYBERPUNK_PLUGIN_ENTRY}" no está en el array plugin de opencode.json`,
      fixable: true,
    })
  } else {
    checks.push({
      id: "plugin:registration",
      label: "Registro en OpenCode",
      status: "pass",
      message: "Plugin registrado en opencode.json",
      fixable: false,
    })
  }

  // Note: plugin:patching check is REMOVED — owned by sdd-integration component

  return checks
}

export function getPluginComponent(): ComponentModule {
  return {
    id: "plugin",
    label: COMPONENT_LABELS.plugin,

    async install(): Promise<InstallResult> {
      const { opencodePluginsDir, targetPath } = getPluginPaths()
      // Check if already installed and identical
      let existingPluginMatch = false
      if (existsSync(targetPath)) {
        const existing = readFileSync(targetPath, "utf8")
        if (existing === PLUGIN_SOURCE) {
          existingPluginMatch = true
        } else {
          // Back up existing if different
          writeFileSync(targetPath + ".bak", existing, "utf8")
        }
      }

      if (!existingPluginMatch) {
        // Create plugins dir if needed
        mkdirSync(opencodePluginsDir, { recursive: true })
        writeFileSync(targetPath, PLUGIN_SOURCE, "utf8")

        // Update config
        const config = loadConfig()
        config.components.plugin = {
          installed: true,
          version: "bundled",
          installedAt: new Date().toISOString(),
          path: targetPath,
        }
        saveConfig(config)
      }

      // Register plugin in OpenCode config after successful file write
      const regResult = registerCyberpunkPlugin()

      // Mark pluginRegistered in cyberpunk config — only true when actually registered
      const regConfig = loadConfig()
      regConfig.pluginRegistered = regResult.registered
      saveConfig(regConfig)

      // NOTE: SDD patching is NO LONGER done by plugin install.
      // Use sdd-integration component for that.

      return {
        component: "plugin",
        action: "install",
        status: existingPluginMatch ? "skipped" : "success",
        message: existingPluginMatch ? "Plugin ya instalado y actualizado" : undefined,
        path: targetPath,
      }
    },

    async uninstall(): Promise<InstallResult> {
      const { targetPath } = getPluginPaths()

      if (!existsSync(targetPath)) {
        return {
          component: "plugin",
          action: "uninstall",
          status: "skipped",
          message: "Plugin no instalado",
        }
      }

      unlinkSync(targetPath)

      // Update config
      const config = loadConfig()
      config.components.plugin = { installed: false }
      saveConfig(config)

      // Unregister plugin from OpenCode config after successful file delete
      const unregResult = unregisterCyberpunkPlugin()

      // Mark pluginRegistered in cyberpunk config — false after unregister
      const unregConfig = loadConfig()
      unregConfig.pluginRegistered = unregResult.registered
      saveConfig(unregConfig)

      return {
        component: "plugin",
        action: "uninstall",
        status: "success",
        path: targetPath,
      }
    },

    async status(): Promise<ComponentStatus> {
      const { targetPath } = getPluginPaths()

      if (!existsSync(targetPath)) {
        return {
          id: "plugin",
          label: COMPONENT_LABELS.plugin,
          status: "available",
        }
      }

      return {
        id: "plugin",
        label: COMPONENT_LABELS.plugin,
        status: "installed",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks = await checkPluginDoctor(ctx)
      return { component: "plugin", checks }
    },
  }
}
