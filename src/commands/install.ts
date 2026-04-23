// src/commands/install.ts — orchestrates component install/uninstall, returns InstallResult[]

import type { ComponentId, InstallResult } from "../components/types"
import { getPluginComponent } from "../components/plugin"
import { getThemeComponent } from "../components/theme"
import { getSoundsComponent } from "../components/sounds"
import { getContextModeComponent } from "../components/context-mode"
import { getRtkComponent } from "../components/rtk"
import { getTmuxComponent } from "../components/tmux"
import type { ComponentModule } from "../components/types"
import { COMPONENT_IDS } from "../config/schema"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"

const COMPONENT_FACTORIES: Record<ComponentId, () => ComponentModule> = {
  plugin: getPluginComponent,
  theme: getThemeComponent,
  sounds: getSoundsComponent,
  "context-mode": getContextModeComponent,
  rtk: getRtkComponent,
  tmux: getTmuxComponent,
}

export async function runInstall(
  componentIds: ComponentId[],
  action: "install" | "uninstall" = "install"
): Promise<InstallResult[]> {
  // Default to all components if none specified
  const ids = componentIds.length > 0 ? componentIds : [...COMPONENT_IDS]

  const results: InstallResult[] = []

  for (const id of ids) {
    const factory = COMPONENT_FACTORIES[id]
    if (!factory) {
      results.push({
        component: id,
        action,
        status: "error",
        message: `Componente desconocido: ${id}`,
      })
      continue
    }

    const module = factory()
    try {
      const result = action === "install"
        ? await module.install()
        : await module.uninstall()
      results.push(result)
    } catch (err) {
      results.push({
        component: id,
        action,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Stamp installMode: "repo" after successful install from a git checkout
  if (action === "install") {
    const hasSuccess = results.some(r => r.status === "success")
    if (hasSuccess) {
      const config = loadConfig()
      config.installMode = "repo"
      saveConfig(config)
    }
  }

  return results
}

export async function runUninstall(componentIds: ComponentId[]): Promise<InstallResult[]> {
  return runInstall(componentIds, "uninstall")
}
