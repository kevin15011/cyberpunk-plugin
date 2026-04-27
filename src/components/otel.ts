// src/components/otel.ts — register OpenCode OTEL plugin, write OTEL env vars in shell profile

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { registerOpenCodePlugin, unregisterOpenCodePlugin, isOpenCodePluginRegistered, readOpenCodeConfig, writeOpenCodeConfig } from "../opencode-config"

const OTEL_PLUGIN_ENTRY = "@devtheops/opencode-plugin-otel"
const LEGACY_OTEL_PLUGIN_ENTRIES = ["opencode-plugin-otel"]
const ENV_MARKER_START = "# >>> cyberpunk-managed:otel-env >>>"
const ENV_MARKER_END = "# <<< cyberpunk-managed:otel-env <<<"

const OTEL_ENV_VARS: Record<string, string> = {
  OPENCODE_ENABLE_TELEMETRY: "1",
  OPENCODE_OTLP_ENDPOINT: "http://localhost:4317",
  OPENCODE_OTLP_PROTOCOL: "grpc",
  OPENCODE_METRIC_PREFIX: "opencode.",
}

const DEFAULT_OTEL_PORT = 4317

function getPaths() {
  const home = getHomeDirAuto()
  return {
    home,
    bashrcPath: join(home, ".bashrc"),
    zshrcPath: join(home, ".zshrc"),
  }
}

function getProfilePaths(): string[] {
  const { bashrcPath, zshrcPath } = getPaths()
  const profiles: string[] = []
  if (existsSync(bashrcPath)) profiles.push(bashrcPath)
  if (existsSync(zshrcPath)) profiles.push(zshrcPath)
  // If neither exists, default to .bashrc
  if (profiles.length === 0) profiles.push(bashrcPath)
  return profiles
}

function buildEnvBlock(): string {
  const lines = [ENV_MARKER_START]
  for (const [key, value] of Object.entries(OTEL_ENV_VARS)) {
    lines.push(`export ${key}="${value}"`)
  }
  lines.push(ENV_MARKER_END)
  return lines.join("\n")
}

function isEnvBlockPresent(content: string): boolean {
  return content.includes(ENV_MARKER_START) && content.includes(ENV_MARKER_END)
}

function addEnvBlock(content: string): string {
  if (isEnvBlockPresent(content)) return content
  const block = buildEnvBlock()
  // Append at end, with a newline if content doesn't end with one
  const separator = content.endsWith("\n") ? "" : "\n"
  return content + separator + "\n" + block + "\n"
}

function removeEnvBlock(content: string): string {
  if (!isEnvBlockPresent(content)) return content
  const startIdx = content.indexOf(ENV_MARKER_START)
  const endIdx = content.indexOf(ENV_MARKER_END) + ENV_MARKER_END.length
  // Remove the block and any trailing newline
  let newContent = content.substring(0, startIdx) + content.substring(endIdx)
  // Clean up double newlines
  newContent = newContent.replace(/\n{3,}/g, "\n\n")
  return newContent
}

function writeEnvToProfiles(): boolean {
  let changed = false
  const profiles = getProfilePaths()
  const block = buildEnvBlock()

  for (const profilePath of profiles) {
    let content = ""
    if (existsSync(profilePath)) {
      content = readFileSync(profilePath, "utf8")
    }

    if (isEnvBlockPresent(content)) continue

    content = addEnvBlock(content)
    mkdirSync(join(profilePath, ".."), { recursive: true })
    const tmpPath = profilePath + ".tmp"
    writeFileSync(tmpPath, content, "utf8")
    const { renameSync } = require("fs") as typeof import("fs")
    renameSync(tmpPath, profilePath)
    changed = true
  }

  return changed
}

function removeEnvFromProfiles(): boolean {
  let changed = false
  const { bashrcPath, zshrcPath } = getPaths()

  for (const profilePath of [bashrcPath, zshrcPath]) {
    if (!existsSync(profilePath)) continue
    const content = readFileSync(profilePath, "utf8")
    if (!isEnvBlockPresent(content)) continue

    const newContent = removeEnvBlock(content)
    const tmpPath = profilePath + ".tmp"
    writeFileSync(tmpPath, newContent, "utf8")
    const { renameSync } = require("fs") as typeof import("fs")
    renameSync(tmpPath, profilePath)
    changed = true
  }

  return changed
}

function isEnvBlockInAnyProfile(): boolean {
  const { bashrcPath, zshrcPath } = getPaths()
  for (const p of [bashrcPath, zshrcPath]) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8")
      if (isEnvBlockPresent(content)) return true
    }
  }
  return false
}

function unregisterLegacyOtelPlugins(): boolean {
  let changed = false
  for (const entry of LEGACY_OTEL_PLUGIN_ENTRIES) {
    const result = unregisterOpenCodePlugin(entry)
    changed = changed || result.changed
  }
  return changed
}

/**
 * Parse port number from an endpoint URL string.
 * Pure function — no side effects.
 * Returns port number or null if not parseable.
 */
export function parseEndpointPort(endpoint: string): number | null {
  if (!endpoint) return null
  const match = endpoint.match(/:(\d+)(?:\/|$)/)
  if (!match) return null
  const port = parseInt(match[1], 10)
  return Number.isNaN(port) ? null : port
}

/**
 * Build the otel:endpoint doctor check result.
 * Pure function — no side effects, fully deterministic.
 * @param isListening - whether the port is actually listening
 * @param endpoint - the endpoint URL string (used for display)
 */
export function buildEndpointCheck(isListening: boolean, endpoint: string): DoctorCheck {
  const port = parseEndpointPort(endpoint) ?? DEFAULT_OTEL_PORT
  const label = `OTEL endpoint (localhost:${port})`
  if (isListening) {
    return {
      id: "otel:endpoint",
      label,
      status: "pass",
      message: `Endpoint OTEL activo en localhost:${port}`,
      fixable: false,
    }
  }
  return {
    id: "otel:endpoint",
    label,
    status: "warn",
    message: `Puerto ${port} no escuchando — inicia otel-collector`,
    fixable: false,
  }
}

/**
 * Check if a TCP port is listening using `ss -tlnp`.
 * Returns true if the port is in LISTEN state.
 */
export function isPortListening(port: number): boolean {
  const { execSync } = require("child_process") as typeof import("child_process")
  try {
    const result = execSync(
      `ss -tlnp 2>/dev/null | grep ':${port}' || true`,
      { encoding: "utf8", stdio: "pipe", timeout: 3000 }
    )
    return result.includes(`:${port}`)
  } catch {
    return false
  }
}

export function getOtelComponent(): ComponentModule {
  return {
    id: "otel",
    label: COMPONENT_LABELS.otel,

    async install(): Promise<InstallResult> {
      // Remove unpublished legacy package names before registering the maintained scoped package.
      const legacyChanged = unregisterLegacyOtelPlugins()

      // Register plugin in opencode.json
      const regResult = registerOpenCodePlugin(OTEL_PLUGIN_ENTRY)

      // Write env vars to shell profiles
      const envChanged = writeEnvToProfiles()

      const config = loadConfig()
      config.components.otel = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
      }
      saveConfig(config)

      const wasNew = regResult.changed || envChanged || legacyChanged
      return {
        component: "otel",
        action: "install",
        status: wasNew ? "success" : "skipped",
        message: wasNew
          ? "OTEL plugin registrado y variables de entorno configuradas"
          : "OTEL plugin ya configurado",
      }
    },

    async uninstall(): Promise<InstallResult> {
      unregisterOpenCodePlugin(OTEL_PLUGIN_ENTRY)
      unregisterLegacyOtelPlugins()
      removeEnvFromProfiles()

      const config = loadConfig()
      config.components.otel = { installed: false }
      saveConfig(config)

      return {
        component: "otel",
        action: "uninstall",
        status: "success",
      }
    },

    async status(): Promise<ComponentStatus> {
      const pluginRegistered = isOpenCodePluginRegistered(OTEL_PLUGIN_ENTRY)
      const envPresent = isEnvBlockInAnyProfile()

      if (pluginRegistered && envPresent) {
        return {
          id: "otel",
          label: COMPONENT_LABELS.otel,
          status: "installed",
        }
      }

      if (pluginRegistered && !envPresent) {
        return {
          id: "otel",
          label: COMPONENT_LABELS.otel,
          status: "available",
          error: "Plugin registrado pero variables de entorno no configuradas",
        }
      }

      return {
        id: "otel",
        label: COMPONENT_LABELS.otel,
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []

      // Check 1: plugin registered
      const pluginRegistered = isOpenCodePluginRegistered(OTEL_PLUGIN_ENTRY)
      if (!pluginRegistered) {
        checks.push({
          id: "otel:plugin",
          label: "Plugin OTEL en OpenCode",
          status: "fail",
          message: `${OTEL_PLUGIN_ENTRY} no registrado en opencode.json`,
          fixable: true,
        })
      } else {
        checks.push({
          id: "otel:plugin",
          label: "Plugin OTEL en OpenCode",
          status: "pass",
          message: `${OTEL_PLUGIN_ENTRY} registrado en opencode.json`,
          fixable: false,
        })
      }

      // Check 2: env block in profile
      const envPresent = isEnvBlockInAnyProfile()
      if (!envPresent) {
        checks.push({
          id: "otel:env",
          label: "Variables de entorno OTEL",
          status: "fail",
          message: "Bloque de variables OTEL no encontrado en shell profile",
          fixable: true,
        })
      } else {
        checks.push({
          id: "otel:env",
          label: "Variables de entorno OTEL",
          status: "pass",
          message: "Variables OTEL configuradas en shell profile",
          fixable: false,
        })
      }

      // Check 3: endpoint reachable via port check (not HTTP curl to gRPC)
      const endpoint = OTEL_ENV_VARS.OPENCODE_OTLP_ENDPOINT
      const port = parseEndpointPort(endpoint) ?? DEFAULT_OTEL_PORT
      const listening = isPortListening(port)
      checks.push(buildEndpointCheck(listening, endpoint))

      return { component: "otel", checks }
    },
  }
}

// Export helpers for testing
export { buildEnvBlock, addEnvBlock, removeEnvBlock, isEnvBlockPresent, ENV_MARKER_START, ENV_MARKER_END, OTEL_ENV_VARS, OTEL_PLUGIN_ENTRY, LEGACY_OTEL_PLUGIN_ENTRIES }
