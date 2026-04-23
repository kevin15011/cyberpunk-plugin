// src/presets/resolve.ts — validates preset names and returns ResolvedPreset

import { PRESET_DEFINITIONS, type PresetId, type ResolvedPreset } from "./definitions"

const DEFERRED_PRESETS = new Set(["wsl", "mac"])

export const PRESET_NAMES: { value: PresetId; label: string; hint: string }[] = Array.from(
  PRESET_DEFINITIONS.values()
).map(def => ({
  value: def.id,
  label: def.label,
  hint: def.description,
}))

export function resolvePreset(name: string): ResolvedPreset {
  const lower = name.toLowerCase()

  if (DEFERRED_PRESETS.has(lower)) {
    throw new Error(`El preset '${lower}' no está disponible en esta versión`)
  }

  const def = PRESET_DEFINITIONS.get(lower as PresetId)
  if (!def) {
    throw new Error(`Preset desconocido: '${name}'. Presets disponibles: ${Array.from(PRESET_DEFINITIONS.keys()).join(", ")}`)
  }

  return {
    id: def.id,
    label: def.label,
    components: [...def.components],
    warnings: [...def.warnings],
  }
}
