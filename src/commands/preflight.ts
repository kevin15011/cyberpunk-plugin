// src/commands/preflight.ts — advisory preset preflight builder

import type { ComponentId, ComponentStatus } from "../components/types"
import { checkPlatformPrerequisites } from "../components/platform"
import { collectStatus } from "./status"
import type { ResolvedPreset } from "../presets/definitions"

export interface PreflightDependencyStatus {
  id: "ffmpeg" | "npm" | "bun" | "curl"
  label: string
  requiredBy: ComponentId[]
  available: boolean
  severity: "info" | "warn"
  message: string
}

export interface ComponentPreflightStatus {
  id: ComponentId
  installed: boolean
  readiness: "ready" | "degraded"
  dependencyIds: PreflightDependencyStatus["id"][]
  fileTouches: string[]
}

export interface PresetPreflightSummary {
  preset: ResolvedPreset
  components: ComponentPreflightStatus[]
  dependencies: PreflightDependencyStatus[]
  warnings: string[]
  notes: string[]
}

export const FILE_TOUCH_MAP: Record<ComponentId, string[]> = {
  plugin: ["~/.config/opencode/plugins/cyberpunk.ts"],
  theme: [
    "~/.config/opencode/themes/cyberpunk.json",
    "~/.config/opencode/themes/tui.json",
  ],
  sounds: ["~/.config/opencode/sounds/*.wav"],
  "context-mode": [
    "~/.config/opencode/opencode.json",
    "~/.config/opencode/ROUTING.md",
  ],
  rtk: [
    "~/.config/opencode/ROUTING.md",
    "~/.config/opencode/opencode.json",
  ],
  tmux: ["Managed block in ~/.tmux.conf"],
}

export const DEPENDENCY_MAP: Record<ComponentId, { id: PreflightDependencyStatus["id"]; label: string; severity: "info" | "warn" }[]> = {
  plugin: [],
  theme: [],
  sounds: [{ id: "ffmpeg", label: "ffmpeg", severity: "warn" }],
  "context-mode": [
    { id: "npm", label: "npm", severity: "info" },
    { id: "bun", label: "bun", severity: "info" },
  ],
  rtk: [{ id: "curl", label: "curl", severity: "warn" }],
  tmux: [],
}

export async function buildPresetPreflight(resolved: ResolvedPreset): Promise<PresetPreflightSummary> {
  const prerequisites = checkPlatformPrerequisites()
  const statuses = await collectStatus(resolved.components)
  const statusById = new Map<ComponentId, ComponentStatus>(statuses.map(status => [status.id, status]))

  const dependencies = new Map<PreflightDependencyStatus["id"], PreflightDependencyStatus>()

  const components = resolved.components.map((id): ComponentPreflightStatus => {
    const dependencyDefs = DEPENDENCY_MAP[id] ?? []
    const status = statusById.get(id)

    for (const dependency of dependencyDefs) {
      const existing = dependencies.get(dependency.id)
      if (existing) {
        if (!existing.requiredBy.includes(id)) {
          existing.requiredBy.push(id)
        }
        continue
      }

      dependencies.set(dependency.id, {
        id: dependency.id,
        label: dependency.label,
        requiredBy: [id],
        available: prerequisites[dependency.id],
        severity: dependency.severity,
        message: prerequisites[dependency.id] ? "Disponible" : "No disponible",
      })
    }

    const dependencyIds = dependencyDefs.map(dependency => dependency.id)
    const hasUnavailableDependency = dependencyIds.some(dependencyId => !prerequisites[dependencyId])
    const hasStatusError = status?.status === "error"

    return {
      id,
      installed: status?.status === "installed",
      readiness: hasUnavailableDependency || hasStatusError ? "degraded" : "ready",
      dependencyIds,
      fileTouches: [...(FILE_TOUCH_MAP[id] ?? [])],
    }
  })

  return {
    preset: resolved,
    components,
    dependencies: Array.from(dependencies.values()),
    warnings: [...resolved.warnings],
    notes: [],
  }
}
