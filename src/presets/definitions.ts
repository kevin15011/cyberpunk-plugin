// src/presets/definitions.ts — preset registry

import type { ComponentId } from "../config/schema"
import { COMPONENT_IDS, COMPONENT_LABELS } from "../config/schema"

export type PresetId = "minimal" | "full" | "wsl" | "mac"

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

const WSL_WARNINGS: string[] = [
  "Preset orientado a WSL; solo muestra avisos y no hace bootstrap del entorno.",
  "tmux solo modifica el bloque gestionado en ~/.tmux.conf",
]

const MAC_WARNINGS: string[] = [
  "Preset orientado a macOS; solo muestra avisos y no hace bootstrap del entorno.",
  "context-mode necesita npm instalado",
  "rtk necesita curl instalado",
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
  [
    "wsl",
    {
      id: "wsl",
      label: "WSL",
      description: "Plugin + Tema + Sonidos + Tmux para entornos WSL",
      components: ["plugin", "theme", "sounds", "tmux"],
      warnings: WSL_WARNINGS,
    },
  ],
  [
    "mac",
    {
      id: "mac",
      label: "macOS",
      description: "Plugin + Tema + Sonidos + Context-Mode + RTK para macOS",
      components: ["plugin", "theme", "sounds", "context-mode", "rtk"],
      warnings: MAC_WARNINGS,
    },
  ],
])
