// src/commands/status.ts — collect Component[] from all modules, return status

import type { ComponentStatus } from "../components/types"
import { getPluginComponent } from "../components/plugin"
import { getThemeComponent } from "../components/theme"
import { getSoundsComponent } from "../components/sounds"
import { getContextModeComponent } from "../components/context-mode"
import type { ComponentModule } from "../components/types"
import type { ComponentId } from "../config/schema"

const ALL_COMPONENTS: (() => ComponentModule)[] = [
  getPluginComponent,
  getThemeComponent,
  getSoundsComponent,
  getContextModeComponent,
]

export async function collectStatus(
  filterIds?: ComponentId[]
): Promise<ComponentStatus[]> {
  const modules = ALL_COMPONENTS.map(fn => fn())

  const filtered = filterIds && filterIds.length > 0
    ? modules.filter(m => filterIds.includes(m.id))
    : modules

  const statuses: ComponentStatus[] = []
  for (const mod of filtered) {
    try {
      const status = await mod.status()
      statuses.push(status)
    } catch (err) {
      statuses.push({
        id: mod.id,
        label: mod.label,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return statuses
}
