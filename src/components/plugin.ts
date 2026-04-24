// src/components/plugin.ts — copy plugin to ~/.config/opencode/plugins/cyberpunk.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { registerCyberpunkPlugin, unregisterCyberpunkPlugin, isOpenCodePluginRegistered, CYBERPUNK_PLUGIN_ENTRY } from "../opencode-config"

function getPluginPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || "~"
  const opencodePluginsDir = join(home, ".config", "opencode", "plugins")

  return {
    home,
    opencodePluginsDir,
    targetPath: join(opencodePluginsDir, "cyberpunk.ts"),
    sddPhaseCommonPath: join(home, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md"),
  }
}

function getConfiguredPluginPath(ctx: DoctorContext): string {
  return ctx.cyberpunkConfig?.components?.plugin?.path || getPluginPaths().targetPath
}

function isManagedPluginPath(targetPath: string): boolean {
  return targetPath === getPluginPaths().targetPath
}

// --- Patching constants for sdd-phase-common.md Section E ---
const START_MARKER = "<!-- cyberpunk:start:section-e -->"
const END_MARKER   = "<!-- cyberpunk:end:section-e -->"

const SECTION_E_TEMPLATE = `
## E. Session Stats — Always Report at the End

Before returning to the orchestrator, call \`ctx_stats\` and include the result in your \`detailed_report\` or as a separate line in the envelope.

\`\`\`
ctx_stats
\`\`\`

**Why**: Every SDD phase processes files, runs commands, and indexes content. Reporting the session savings makes the token cost visible and encourages consistent use of \`ctx_*\` tools.

**Format**: Add this at the end of your return:

\`\`\`
-- Session Stats --
$ ctx_stats output here
\`\`\`

If \`ctx_stats\` is unavailable (e.g., not installed), skip silently.
`.trim()

const SECTION_F_TEMPLATE = `
## F. RTK Routing

Prefer \`rtk\` for broad shell inspection and verbose command output when a compact CLI proxy is enough (for example: directory listings, trees, long git/gh output, or noisy test output).

- Keep using narrow file tools like \`Read\`, \`Grep\`, and \`Glob\` for targeted file/content inspection.
- Use \`context-mode\` / \`ctx_*\` tools only when you need heavy sandboxed processing, indexed follow-up questions, or the output would otherwise be genuinely large.
- If \`rtk\` is unavailable or a command is unsupported, fall back to the normal tool path.
`.trim()

const MANAGED_SDD_TEMPLATE = `${SECTION_E_TEMPLATE}\n\n${SECTION_F_TEMPLATE}`

function extractBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string
): { before: string; managed: string; after: string } | null {
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) return null
  const afterStart = startIdx + startMarker.length
  const endIdx = content.indexOf(endMarker, afterStart)
  if (endIdx === -1) return null
  return {
    before:  content.slice(0, startIdx),
    managed: content.slice(afterStart, endIdx),
    after:   content.slice(endIdx + endMarker.length),
  }
}

function patchSddPhaseCommon(): boolean {
  const { sddPhaseCommonPath } = getPluginPaths()

  // Guard: file doesn't exist — skip silently
  if (!existsSync(sddPhaseCommonPath)) return false

  const content = readFileSync(sddPhaseCommonPath, "utf8")

  // State 1: No markers → heading detection or append
  if (!content.includes(START_MARKER)) {
    const headingIndex = content.indexOf("\n## E.")
    const markedSection = `\n${START_MARKER}\n${MANAGED_SDD_TEMPLATE}\n${END_MARKER}\n`
    const newContent = headingIndex !== -1
      ? content.slice(0, headingIndex) + markedSection
      : content.trimEnd() + "\n\n" + markedSection
    const tmpPath = sddPhaseCommonPath + ".tmp"
    writeFileSync(tmpPath, newContent, "utf8")
    renameSync(tmpPath, sddPhaseCommonPath)
    return true
  }

  // State 2: Markers present, content matches → no-op
  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false
  if (extracted.managed.trim() === MANAGED_SDD_TEMPLATE) return false

  // State 3: Markers present, content mismatched → replace
  const newContent =
    extracted.before +
    START_MARKER + "\n" + MANAGED_SDD_TEMPLATE + "\n" +
    END_MARKER +
    extracted.after
  const tmpPath = sddPhaseCommonPath + ".tmp"
  writeFileSync(tmpPath, newContent, "utf8")
  renameSync(tmpPath, sddPhaseCommonPath)
  return true
}

// This is the slimmed plugin source that gets installed.
// It handles sound playback on events and includes patching helpers for sdd-phase-common.md.
const PLUGIN_SOURCE = `// cyberpunk.ts — runtime plugin (installed by cyberpunk CLI)
import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME!
const SOUNDS = join(HOME, ".config", "opencode", "sounds")
const IS_MAC = process.platform === "darwin"
const COMPLETION_THROTTLE_MS = 2000
let lastCompletionTime = 0

const SDD_PHASE_COMMON_PATH = join(HOME, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")
const START_MARKER = "<!-- cyberpunk:start:section-e -->"
const END_MARKER   = "<!-- cyberpunk:end:section-e -->"
const SECTION_E_TEMPLATE = \`
## E. Session Stats — Always Report at the End

Before returning to the orchestrator, call \\\`ctx_stats\\\` and include the result in your \\\`detailed_report\\\` or as a separate line in the envelope.

\\\`\\\`\\\`
ctx_stats
\\\`\\\`\\\`

**Why**: Every SDD phase processes files, runs commands, and indexes content. Reporting the session savings makes the token cost visible and encourages consistent use of \\\`ctx_*\\\` tools.

**Format**: Add this at the end of your return:

\\\`\\\`\\\`
-- Session Stats --
$ ctx_stats output here
\\\`\\\`\\\`

If \\\`ctx_stats\\\` is unavailable (e.g., not installed), skip silently.
\`.trim()

const SECTION_F_TEMPLATE = \`
## F. RTK Routing

Prefer \\\`rtk\\\` for broad shell inspection and verbose command output when a compact CLI proxy is enough (for example: directory listings, trees, long git/gh output, or noisy test output).

- Keep using narrow file tools like \\\`Read\\\`, \\\`Grep\\\`, and \\\`Glob\\\` for targeted file/content inspection.
- Use \\\`context-mode\\\` / \\\`ctx_*\\\` tools only when you need heavy sandboxed processing, indexed follow-up questions, or the output would otherwise be genuinely large.
- If \\\`rtk\\\` is unavailable or a command is unsupported, fall back to the normal tool path.
\`.trim()

const MANAGED_SDD_TEMPLATE = SECTION_E_TEMPLATE + "\\n\\n" + SECTION_F_TEMPLATE

function extractBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string
): { before: string; managed: string; after: string } | null {
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) return null
  const afterStart = startIdx + startMarker.length
  const endIdx = content.indexOf(endMarker, afterStart)
  if (endIdx === -1) return null
  return {
    before:  content.slice(0, startIdx),
    managed: content.slice(afterStart, endIdx),
    after:   content.slice(endIdx + endMarker.length),
  }
}

function patchSddPhaseCommon(): boolean {
  if (!existsSync(SDD_PHASE_COMMON_PATH)) return false

  const content = readFileSync(SDD_PHASE_COMMON_PATH, "utf8")

  if (!content.includes(START_MARKER)) {
    const headingIndex = content.indexOf("\\n## E.")
    const markedSection = "\\n" + START_MARKER + "\\n" + MANAGED_SDD_TEMPLATE + "\\n" + END_MARKER + "\\n"
    const newContent = headingIndex !== -1
      ? content.slice(0, headingIndex) + markedSection
      : content.trimEnd() + "\\n\\n" + markedSection
    writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
    return true
  }

  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false
  if (extracted.managed.trim() === MANAGED_SDD_TEMPLATE) return false

  const newContent =
    extracted.before +
    START_MARKER + "\\n" + MANAGED_SDD_TEMPLATE + "\\n" +
    END_MARKER +
    extracted.after
  writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
  return true
}

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
  extractBetweenMarkers,
  patchSddPhaseCommon,
  getPluginPaths,
  isManagedPluginPath,
  SECTION_E_TEMPLATE,
  SECTION_F_TEMPLATE,
  MANAGED_SDD_TEMPLATE,
  START_MARKER,
  END_MARKER,
}

// Export patching helper for doctor repair
export function applyPatch(): boolean {
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
 * Plugin doctor checks: (1) plugin file exists, (2) registered in OpenCode config,
 * (3) Section E/F patching applied in sdd-phase-common.md.
 */
export async function checkPluginDoctor(ctx: DoctorContext): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []
  const verbose = ctx.verbose
  const { targetPath, sddPhaseCommonPath } = getPluginPaths()
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

  // Check 3: Section E/F patching applied
  if (!existsSync(sddPhaseCommonPath)) {
    checks.push({
      id: "plugin:patching",
      label: "Patching sdd-phase-common.md",
      status: "warn",
      message: "sdd-phase-common.md no encontrado — patching no aplicable",
      fixable: false,
    })
  } else {
    const content = readFileSync(sddPhaseCommonPath, "utf8")
    if (!content.includes(START_MARKER)) {
      checks.push({
        id: "plugin:patching",
        label: "Patching sdd-phase-common.md",
        status: "fail",
        message: "Marcadores Section E/F ausentes en sdd-phase-common.md",
        fixable: true,
      })
    } else {
      // Check if content matches expected
      const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
      if (extracted && extracted.managed.trim() === MANAGED_SDD_TEMPLATE) {
        checks.push({
          id: "plugin:patching",
          label: "Patching sdd-phase-common.md",
          status: "pass",
          message: "Section E/F correctamente aplicada",
          fixable: false,
        })
      } else {
        checks.push({
          id: "plugin:patching",
          label: "Patching sdd-phase-common.md",
          status: "fail",
          message: "Contenido de Section E/F no coincide con el esperado (drift detectado)",
          fixable: true,
        })
      }
    }
  }

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

      // Patch sdd-phase-common.md with Section E (idempotent)
      const patched = patchSddPhaseCommon()

      return {
        component: "plugin",
        action: "install",
        status: existingPluginMatch ? "skipped" : "success",
        message: patched
          ? "Plugin instalado, Section E (ctx_stats) inyectada"
          : existingPluginMatch ? "Plugin ya instalado y actualizado" : undefined,
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
