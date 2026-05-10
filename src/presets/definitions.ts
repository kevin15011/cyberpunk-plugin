// src/presets/definitions.ts — preset registry

import type { ComponentId } from "../config/schema"
import { COMPONENT_IDS, COMPONENT_LABELS } from "../config/schema"

export type PresetId = "minimal" | "token-saver-general" | "token-saver-dev" | "developer-toolkit" | "cyberpunk-full" | "custom"
export type LegacyPresetId = "full" | "wsl" | "mac"

export interface PresetDefinition {
  id: PresetId
  label: string
  description: string
  components: ComponentId[]
  warnings: string[]
}

export interface ResolvedPreset {
  id: PresetId
  label: string
  components: ComponentId[]
  warnings: string[]
}

const CYBERPUNK_FULL_WARNINGS: string[] = [
  "sounds necesita ffmpeg instalado",
  "context-mode necesita npm instalado",
  "rtk necesita curl instalado",
  "tmux solo modifica el bloque gestionado en ~/.tmux.conf",
  "codebase-memory necesita curl instalado",
]

const DEVELOPER_TOOLKIT_WARNINGS: string[] = [
  "context-mode necesita npm instalado",
  "rtk necesita curl instalado",
  "codebase-memory necesita curl instalado",
]

const TOKEN_SAVER_DEV_WARNINGS: string[] = [
  "rtk necesita curl instalado",
  "sdd-integration parchea ~/.config/opencode/skills/_shared/sdd-phase-common.md",
]

/**
 * Aliases for old preset names mapping to new presets.
 * When a legacy name is used, it resolves to the new preset with a deprecation warning.
 */
export const PRESET_ALIASES: Record<string, { target: PresetId; warning: string }> = {
  "full": {
    target: "cyberpunk-full",
    warning: "El preset 'full' está deprecado — usá 'cyberpunk-full' en su lugar",
  },
  "wsl": {
    target: "developer-toolkit",
    warning: "El preset 'wsl' está deprecado — usá 'developer-toolkit' en su lugar",
  },
  "mac": {
    target: "developer-toolkit",
    warning: "El preset 'mac' está deprecado — usá 'developer-toolkit' en su lugar",
  },
}

export const PRESET_DEFINITIONS: Map<PresetId, PresetDefinition> = new Map([
  [
    "minimal",
    {
      id: "minimal",
      label: "Mínimo",
      description: "Plugin cyberpunk básico para OpenCode",
      components: ["plugin"],
      warnings: [],
    },
  ],
  [
    "token-saver-general",
    {
      id: "token-saver-general",
      label: "Token Saver General",
      description: "Plugin cyberpunk para uso general sin componentes estéticos",
      components: ["plugin"],
      warnings: [],
    },
  ],
  [
    "token-saver-dev",
    {
      id: "token-saver-dev",
      label: "Token Saver Dev",
      description: "Plugin cyberpunk + RTK + SDD Integration para desarrollo",
      components: ["plugin", "rtk", "sdd-integration"],
      warnings: TOKEN_SAVER_DEV_WARNINGS,
    },
  ],
  [
    "developer-toolkit",
    {
      id: "developer-toolkit",
      label: "Developer Toolkit",
      description: "Plugin cyberpunk + Context-Mode + RTK + Codebase-Memory + SDD Integration",
      components: ["plugin", "context-mode", "rtk", "codebase-memory", "sdd-integration"],
      warnings: DEVELOPER_TOOLKIT_WARNINGS,
    },
  ],
  [
    "cyberpunk-full",
    {
      id: "cyberpunk-full",
      label: "Cyberpunk Full Experience",
      description: `Todos los componentes: ${COMPONENT_IDS.map(id => COMPONENT_LABELS[id]).join(", ")}`,
      components: [...COMPONENT_IDS],
      warnings: CYBERPUNK_FULL_WARNINGS,
    },
  ],
  [
    "custom",
    {
      id: "custom",
      label: "Custom",
      description: "Seleccioná componentes individualmente vía TUI",
      components: [],
      warnings: [],
    },
  ],
])
