// src/presets/resolve.ts — validates preset names and returns ResolvedPreset

import { PRESET_DEFINITIONS, PRESET_ALIASES, type PresetId, type ResolvedPreset } from "./definitions"
import { detectEnvironment, type DetectedEnvironment } from "../platform/detect"
import { normalizeComponentId } from "../components/types"

export const PRESET_NAMES: { value: PresetId; label: string; hint: string }[] = Array.from(
  PRESET_DEFINITIONS.values()
).map(def => ({
  value: def.id,
  label: def.label,
  hint: def.description,
}))

export function resolvePreset(name: string): ResolvedPreset {
  const lower = name.toLowerCase()

  // Check if this is a legacy alias
  const alias = PRESET_ALIASES[lower]
  const resolvedName = alias ? alias.target : lower

  const def = PRESET_DEFINITIONS.get(resolvedName as PresetId)
  if (!def) {
    throw new Error(`Preset desconocido: '${name}'. Presets disponibles: ${Array.from(PRESET_DEFINITIONS.keys()).join(", ")}`)
  }

  const warnings = [...def.warnings]

  // Add alias deprecation warning if applicable
  if (alias) {
    warnings.push(alias.warning)
  }

  // Normalize all component ids through the alias map
  const components = def.id === "custom"
    ? [] // Custom preset has no predefined components
    : def.components.map(id => normalizeComponentId(id))

  return {
    id: def.id,
    label: def.label,
    components,
    warnings,
  }
}

function getMismatchWarning(presetId: PresetId, detected: DetectedEnvironment): string | null {
  if (presetId === "developer-toolkit" && detected === "wsl") {
    return null // developer-toolkit is universal, no mismatch warning
  }

  return null
}
