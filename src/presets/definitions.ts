// src/presets/definitions.ts — slice-1 preset registry: minimal and full

import type { ComponentId } from "../config/schema"
import { COMPONENT_IDS, COMPONENT_LABELS } from "../config/schema"

export type PresetId = "minimal" | "full"

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

const FULL_WARNINGS: string[] = [
  "sounds necesita ffmpeg instalado",
  "context-mode necesita npm instalado",
  "rtk necesita curl instalado",
  "tmux solo modifica el bloque gestionado en ~/.tmux.conf",
]

export const PRESET_DEFINITIONS: Map<PresetId, PresetDefinition> = new Map([
  [
    "minimal",
    {
      id: "minimal",
      label: "Mínimo",
      description: "Plugin de OpenCode + Tema cyberpunk",
      components: ["plugin", "theme"],
      warnings: [],
    },
  ],
  [
    "full",
    {
      id: "full",
      label: "Completo",
      description: `Todos los componentes: ${COMPONENT_IDS.map(id => COMPONENT_LABELS[id]).join(", ")}`,
      components: [...COMPONENT_IDS],
      warnings: FULL_WARNINGS,
    },
  ],
])
