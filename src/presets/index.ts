// src/presets/index.ts — barrel re-export for preset system

export { resolvePreset, PRESET_NAMES } from "./resolve"
export { PRESET_DEFINITIONS } from "./definitions"
export type { PresetId, PresetDefinition, ResolvedPreset } from "./definitions"
