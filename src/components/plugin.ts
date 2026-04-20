// src/components/plugin.ts — copy plugin to ~/.config/opencode/plugins/cyberpunk.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const OPENCODE_PLUGINS_DIR = join(HOME, ".config", "opencode", "plugins")
const TARGET_PATH = join(OPENCODE_PLUGINS_DIR, "cyberpunk.ts")

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
  const SDD_PHASE_COMMON_PATH = join(HOME, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")

  // Guard: file doesn't exist — skip silently
  if (!existsSync(SDD_PHASE_COMMON_PATH)) return false

  const content = readFileSync(SDD_PHASE_COMMON_PATH, "utf8")

  // State 1: No markers → heading detection or append
  if (!content.includes(START_MARKER)) {
    const headingIndex = content.indexOf("\n## E.")
    const markedSection = `\n${START_MARKER}\n${SECTION_E_TEMPLATE}\n${END_MARKER}\n`
    const newContent = headingIndex !== -1
      ? content.slice(0, headingIndex) + markedSection
      : content.trimEnd() + "\n\n" + markedSection
    writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
    return true
  }

  // State 2: Markers present, content matches → no-op
  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false
  if (extracted.managed.trim() === SECTION_E_TEMPLATE) return false

  // State 3: Markers present, content mismatched → replace
  const newContent =
    extracted.before +
    START_MARKER + "\n" + SECTION_E_TEMPLATE + "\n" +
    END_MARKER +
    extracted.after
  writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
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
    const markedSection = "\\n" + START_MARKER + "\\n" + SECTION_E_TEMPLATE + "\\n" + END_MARKER + "\\n"
    const newContent = headingIndex !== -1
      ? content.slice(0, headingIndex) + markedSection
      : content.trimEnd() + "\\n\\n" + markedSection
    writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
    return true
  }

  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false
  if (extracted.managed.trim() === SECTION_E_TEMPLATE) return false

  const newContent =
    extracted.before +
    START_MARKER + "\\n" + SECTION_E_TEMPLATE + "\\n" +
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
    await $\`ffplay -nodisp -autoexit -v quiet \${path}\`.nothrow()
  }
}

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        try { await playSound($, "idle.wav") } catch {}
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
export { extractBetweenMarkers, patchSddPhaseCommon, SECTION_E_TEMPLATE, START_MARKER, END_MARKER }

export function getPluginComponent(): ComponentModule {
  return {
    id: "plugin",
    label: COMPONENT_LABELS.plugin,

    async install(): Promise<InstallResult> {
      // Check if already installed and identical
      let existingPluginMatch = false
      if (existsSync(TARGET_PATH)) {
        const existing = readFileSync(TARGET_PATH, "utf8")
        if (existing === PLUGIN_SOURCE) {
          existingPluginMatch = true
        } else {
          // Back up existing if different
          writeFileSync(TARGET_PATH + ".bak", existing, "utf8")
        }
      }

      if (!existingPluginMatch) {
        // Create plugins dir if needed
        mkdirSync(OPENCODE_PLUGINS_DIR, { recursive: true })
        writeFileSync(TARGET_PATH, PLUGIN_SOURCE, "utf8")

        // Update config
        const config = loadConfig()
        config.components.plugin = {
          installed: true,
          version: "bundled",
          installedAt: new Date().toISOString(),
          path: TARGET_PATH,
        }
        saveConfig(config)
      }

      // Patch sdd-phase-common.md with Section E (idempotent)
      const patched = patchSddPhaseCommon()

      return {
        component: "plugin",
        action: "install",
        status: existingPluginMatch ? "skipped" : "success",
        message: patched
          ? "Plugin instalado, Section E (ctx_stats) inyectada"
          : existingPluginMatch ? "Plugin ya instalado y actualizado" : undefined,
        path: TARGET_PATH,
      }
    },

    async uninstall(): Promise<InstallResult> {
      if (!existsSync(TARGET_PATH)) {
        return {
          component: "plugin",
          action: "uninstall",
          status: "skipped",
          message: "Plugin no instalado",
        }
      }

      unlinkSync(TARGET_PATH)

      // Update config
      const config = loadConfig()
      config.components.plugin = { installed: false }
      saveConfig(config)

      return {
        component: "plugin",
        action: "uninstall",
        status: "success",
        path: TARGET_PATH,
      }
    },

    async status(): Promise<ComponentStatus> {
      if (!existsSync(TARGET_PATH)) {
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
  }
}
