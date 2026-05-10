// src/components/sdd-integration.ts — Optional SDD patching component

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"

// --- Patching constants for sdd-phase-common.md Section E ---
export const START_MARKER = "<!-- cyberpunk:start:section-e -->"
export const END_MARKER   = "<!-- cyberpunk:end:section-e -->"

export const SECTION_E_TEMPLATE = `
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

export const SECTION_F_TEMPLATE = `
## F. RTK Routing

Prefer \`rtk\` for broad shell inspection and verbose command output when a compact CLI proxy is enough (for example: directory listings, trees, long git/gh output, or noisy test output).

- Keep using narrow file tools like \`Read\`, \`Grep\`, and \`Glob\` for targeted file/content inspection.
- Use \`context-mode\` / \`ctx_*\` tools only when you need heavy sandboxed processing, indexed follow-up questions, or the output would otherwise be genuinely large.
- If \`rtk\` is unavailable or a command is unsupported, fall back to the normal tool path.
`.trim()

export const MANAGED_SDD_TEMPLATE = `${SECTION_E_TEMPLATE}\n\n${SECTION_F_TEMPLATE}`

const REQUIRED_OPENCODE_SDD_ASSETS = [
  ["skills", "_shared", "sdd-phase-common.md"],
  ["skills", "sdd-propose", "SKILL.md"],
  ["skills", "sdd-spec", "SKILL.md"],
  ["skills", "sdd-design", "SKILL.md"],
  ["skills", "sdd-tasks", "SKILL.md"],
  ["skills", "sdd-apply", "SKILL.md"],
  ["skills", "sdd-review", "SKILL.md"],
  ["skills", "sdd-verify", "SKILL.md"],
  ["skills", "sdd-archive", "SKILL.md"],
] as const

const OPTIONAL_OPENCODE_SDD_ASSETS = [
  ["skills", "sdd-init", "SKILL.md"],
  ["skills", "sdd-explore", "SKILL.md"],
  ["skills", "sdd-onboard", "SKILL.md"],
  ["skills", "sdd-claude-review", "SKILL.md"],
] as const

export interface OpenCodeSddReadiness {
  ready: boolean
  required: string[]
  missingRequired: string[]
  optionalMissing: string[]
}

function getSddPhaseCommonPath(): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")
}

function getOpenCodeSddAssetPath(parts: readonly string[]): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode", ...parts)
}

function formatHomePath(path: string): string {
  const home = getHomeDirAuto()
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function missingList(paths: string[]): string {
  return paths.map(path => formatHomePath(path)).join(", ")
}

function isSddPatched(): boolean {
  const sddPhaseCommonPath = getSddPhaseCommonPath()
  if (!existsSync(sddPhaseCommonPath)) return false
  const content = readFileSync(sddPhaseCommonPath, "utf8")
  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  return extracted?.managed.trim() === MANAGED_SDD_TEMPLATE
}

export function detectOpenCodeSddReadiness(): OpenCodeSddReadiness {
  const required = REQUIRED_OPENCODE_SDD_ASSETS.map(parts => getOpenCodeSddAssetPath(parts))
  const optional = OPTIONAL_OPENCODE_SDD_ASSETS.map(parts => getOpenCodeSddAssetPath(parts))
  const missingRequired = required.filter(path => !existsSync(path))
  const optionalMissing = optional.filter(path => !existsSync(path))

  return {
    ready: missingRequired.length === 0,
    required,
    missingRequired,
    optionalMissing,
  }
}

export function extractBetweenMarkers(
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

/**
 * Detect whether sdd-phase-common.md exists at the expected path.
 */
export function detectSddPhaseCommon(): boolean {
  return existsSync(getSddPhaseCommonPath())
}

/**
 * Patch sdd-phase-common.md with Section E/F content wrapped in markers.
 * Returns true if the file was modified, false otherwise.
 */
export function patchSddPhaseCommon(): boolean {
  const sddPhaseCommonPath = getSddPhaseCommonPath()

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

/**
 * Remove the managed marker block from sdd-phase-common.md, preserving surrounding content.
 * Returns true if content was removed, false if no markers found.
 */
export function unpatchSddPhaseCommon(): boolean {
  const sddPhaseCommonPath = getSddPhaseCommonPath()

  if (!existsSync(sddPhaseCommonPath)) return false

  const content = readFileSync(sddPhaseCommonPath, "utf8")
  if (!content.includes(START_MARKER)) return false

  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false

  const newContent = extracted.before + extracted.after
  const tmpPath = sddPhaseCommonPath + ".tmp"
  writeFileSync(tmpPath, newContent, "utf8")
  renameSync(tmpPath, sddPhaseCommonPath)
  return true
}

/**
 * Doctor check for SDD integration patching.
 * Returns empty checks when the component is not installed, per spec.
 */
export function checkSddIntegrationDoctor(ctx: DoctorContext): DoctorCheck[] {
  const isInstalled = (ctx.cyberpunkConfig as any)?.components?.["sdd-integration"]?.installed === true // eslint-disable-line @typescript-eslint/no-explicit-any
  const checks: DoctorCheck[] = []
  const readiness = detectOpenCodeSddReadiness()

  if (!readiness.ready) {
    checks.push({
      id: "sdd-integration:readiness",
      label: "OpenCode SDD assets",
      status: isInstalled ? "fail" : "warn",
      message: `SDD Integration unavailable — missing required OpenCode SDD assets: ${missingList(readiness.missingRequired)}`,
      fixable: false,
      detail: {
        nextStep: "Install the missing OpenCode SDD skill files, then rerun cyberpunk install --component sdd-integration or doctor --fix.",
      },
    })
    return checks
  }

  checks.push({
    id: "sdd-integration:readiness",
    label: "OpenCode SDD assets",
    status: "pass",
    message: readiness.optionalMissing.length > 0
      ? `Required OpenCode SDD assets present; optional missing: ${missingList(readiness.optionalMissing)}`
      : "Required OpenCode SDD assets present",
    fixable: false,
  })

  if (!isInstalled) return checks

  const sddPhaseCommonPath = getSddPhaseCommonPath()

  if (!existsSync(sddPhaseCommonPath)) {
    checks.push({
      id: "sdd-integration:patching",
      label: "Patching sdd-phase-common.md",
      status: "warn",
      message: "sdd-phase-common.md no encontrado — patching no aplicable",
      fixable: false,
    })
  } else {
    const content = readFileSync(sddPhaseCommonPath, "utf8")
    if (!content.includes(START_MARKER)) {
      checks.push({
        id: "sdd-integration:patching",
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
          id: "sdd-integration:patching",
          label: "Patching sdd-phase-common.md",
          status: "pass",
          message: "Section E/F correctamente aplicada",
          fixable: false,
        })
      } else {
        checks.push({
          id: "sdd-integration:patching",
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

/**
 * Component factory for sdd-integration.
 */
export function getSddIntegrationComponent(): ComponentModule {
  return {
    id: "sdd-integration",
    label: COMPONENT_LABELS["sdd-integration"],

    async install(): Promise<InstallResult> {
      const readiness = detectOpenCodeSddReadiness()

      if (!readiness.ready) {
        return {
          component: "sdd-integration",
          action: "install",
          status: "skipped",
          message: `SDD Integration no disponible — faltan assets OpenCode SDD requeridos: ${missingList(readiness.missingRequired)}`,
        }
      }

      const patched = patchSddPhaseCommon()

      // Update config
      const config = loadConfig()
      config.components["sdd-integration"] = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
      }
      saveConfig(config)

      return {
        component: "sdd-integration",
        action: "install",
        status: patched ? "success" : "skipped",
        message: patched
          ? "SDD Integration instalada, Section E/F inyectada"
          : "SDD Integration ya instalada y actualizada",
      }
    },

    async uninstall(): Promise<InstallResult> {
      const removed = unpatchSddPhaseCommon()

      // Update config
      const config = loadConfig()
      config.components["sdd-integration"] = { installed: false }
      saveConfig(config)

      return {
        component: "sdd-integration",
        action: "uninstall",
        status: "success",
        message: removed
          ? "SDD Integration desinstalada, marcadores removidos"
          : "SDD Integration desinstalada (sin marcadores para remover)",
      }
    },

    async status(): Promise<ComponentStatus> {
      const readiness = detectOpenCodeSddReadiness()
      if (!readiness.ready) {
        return {
          id: "sdd-integration",
          label: COMPONENT_LABELS["sdd-integration"],
          status: "error",
          error: `SDD Integration unavailable — missing required OpenCode SDD assets: ${missingList(readiness.missingRequired)}`,
        }
      }

      const patched = isSddPatched()
      return {
        id: "sdd-integration",
        label: COMPONENT_LABELS["sdd-integration"],
        status: patched ? "installed" : "available",
        error: patched ? undefined : "OpenCode SDD assets ready; Section E/F patch pending",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks = checkSddIntegrationDoctor(ctx)
      return { component: "sdd-integration", checks }
    },
  }
}
