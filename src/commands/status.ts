// src/commands/status.ts — collect Component[] from all modules, return status

import type { ComponentStatus } from "../components/types"
import { getPluginComponent } from "../components/plugin"
import { getSddIntegrationComponent } from "../components/sdd-integration"
import { getThemeComponent } from "../components/theme"
import { getSoundsComponent } from "../components/sounds"
import { getContextModeComponent } from "../components/context-mode"
import { getRtkComponent } from "../components/rtk"
import { getTmuxComponent } from "../components/tmux"
import { getTuiPluginsComponent } from "../components/tui-plugins"
import { getCodebaseMemoryComponent } from "../components/codebase-memory"
import type { ComponentModule } from "../components/types"
import type { ComponentId } from "../config/schema"
import type { AgentTarget } from "../domain/environment"
import { isComponentSupportedForTarget } from "../components/registry"
export { buildEnvironmentStatus } from "./status-routing"

const ALL_COMPONENTS: (() => ComponentModule)[] = [
  getPluginComponent,
  getSddIntegrationComponent,
  getThemeComponent,
  getSoundsComponent,
  getContextModeComponent,
  getRtkComponent,
  getTmuxComponent,
  getTuiPluginsComponent,
  getCodebaseMemoryComponent,
]

export async function collectStatus(
  filterIds?: ComponentId[],
  options?: { target?: AgentTarget }
): Promise<ComponentStatus[]> {
  const modules = ALL_COMPONENTS.map(fn => fn())

  const target = options?.target ?? "opencode"
  const targetSupported = modules.filter(m => isComponentSupportedForTarget(m.id, target))
  const filtered = filterIds && filterIds.length > 0
    ? targetSupported.filter(m => filterIds.includes(m.id))
    : targetSupported

  const statuses: ComponentStatus[] = []
  for (const mod of filtered) {
    try {
      const status = await mod.status({ target })
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
