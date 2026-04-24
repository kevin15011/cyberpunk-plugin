// src/presets/resolve.ts — validates preset names and returns ResolvedPreset

import { PRESET_DEFINITIONS, type PresetId, type ResolvedPreset } from "./definitions"
import { detectEnvironment, type DetectedEnvironment } from "../platform/detect"

export const PRESET_NAMES: { value: PresetId; label: string; hint: string }[] = Array.from(
  PRESET_DEFINITIONS.values()
).map(def => ({
  value: def.id,
  label: def.label,
  hint: def.description,
}))

export function resolvePreset(name: string): ResolvedPreset {
  const lower = name.toLowerCase()

  const def = PRESET_DEFINITIONS.get(lower as PresetId)
  if (!def) {
    throw new Error(`Preset desconocido: '${name}'. Presets disponibles: ${Array.from(PRESET_DEFINITIONS.keys()).join(", ")}`)
  }

  const warnings = [...def.warnings]
  const mismatchWarning = getMismatchWarning(def.id, detectEnvironment())

  if (mismatchWarning) {
    warnings.push(mismatchWarning)
  }

  return {
    id: def.id,
    label: def.label,
    components: [...def.components],
    warnings,
  }
}

function getMismatchWarning(presetId: PresetId, detected: DetectedEnvironment): string | null {
  if (presetId === "wsl" && detected !== "wsl") {
    return `Este preset está pensado para WSL; entorno detectado: ${detected}.`
  }

  if (presetId === "mac" && detected !== "darwin") {
    return `Este preset está pensado para macOS; entorno detectado: ${detected}.`
  }

  return null
}
