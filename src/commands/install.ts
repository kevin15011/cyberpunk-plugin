// src/commands/install.ts — orchestrates component install/uninstall, returns InstallResult[]

import type { ComponentId, InstallResult } from "../components/types"
import { getPluginComponent } from "../components/plugin"
import { getThemeComponent } from "../components/theme"
import { getSoundsComponent } from "../components/sounds"
import { getContextModeComponent } from "../components/context-mode"
import { getRtkComponent } from "../components/rtk"
import { getTmuxComponent } from "../components/tmux"
import { getTuiPluginsComponent } from "../components/tui-plugins"
import { getCodebaseMemoryComponent } from "../components/codebase-memory"
import { getOtelComponent } from "../components/otel"
import { getOtelCollectorComponent } from "../components/otel-collector"
import type { ComponentModule } from "../components/types"
import { COMPONENT_IDS } from "../config/schema"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import type { TaskHooks } from "../tui/types"
import type { AgentTarget, PlatformInfo } from "../domain/environment"
import { filterComponentsForTarget } from "./install-routing"

const COMPONENT_FACTORIES: Record<ComponentId, () => ComponentModule> = {
  plugin: getPluginComponent,
  theme: getThemeComponent,
  sounds: getSoundsComponent,
  "context-mode": getContextModeComponent,
  rtk: getRtkComponent,
  tmux: getTmuxComponent,
  "tui-plugins": getTuiPluginsComponent,
  "codebase-memory": getCodebaseMemoryComponent,
  otel: getOtelComponent,
  "otel-collector": getOtelCollectorComponent,
}

export interface InstallOptions {
  /** Agent target — defaults to "opencode" */
  target?: AgentTarget
  /** Platform info — when provided, filters components by compatibility */
  platform?: PlatformInfo
  /** Dry-run: plan only, do not execute installs */
  check?: boolean
  /** TUI hooks */
  hooks?: TaskHooks
}

export async function runInstall(
  componentIds: ComponentId[],
  action: "install" | "uninstall" = "install",
  options?: InstallOptions
): Promise<InstallResult[]> {
  const target = options?.target ?? "opencode"

  // Default to all components if none specified
  let ids = componentIds.length > 0 ? [...componentIds] : [...COMPONENT_IDS]

  // When a platform is provided, filter to compatible components
  if (options?.platform && target !== "opencode") {
    const compatible = filterComponentsForTarget(target, options.platform)
    const compatibleSet = new Set(compatible)
    ids = ids.filter(id => compatibleSet.has(id))
  }

  // Dry-run: return planned results without executing
  if (options?.check) {
    return ids.map(id => ({
      component: id,
      action,
      status: "skipped" as const,
      message: `Dry run: ${action} planned for ${id} (target: ${target})`,
    }))
  }

  const results: InstallResult[] = []

  for (const id of ids) {
    const factory = COMPONENT_FACTORIES[id]
    if (!factory) {
      results.push({
        component: id,
        action,
        status: "error",
        message: `Unknown component: ${id}`,
      })
      continue
    }

    const module = factory()
    options?.hooks?.onComponentStart?.(id)
    try {
      const result = action === "install"
        ? await module.install()
        : await module.uninstall()
      results.push(result)
      options?.hooks?.onComponentFinish?.(result)
    } catch (err) {
      const errorResult: InstallResult = {
        component: id,
        action,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      }
      results.push(errorResult)
      options?.hooks?.onComponentFinish?.(errorResult)
    }
  }

  // Stamp installMode: "repo" after successful install from a git checkout
  if (action === "install" && !options?.check) {
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
