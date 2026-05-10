// src/tui/adapters.ts — Wrap command functions for TUI intents with TaskHooks

import type { TaskHooks, TUIState } from "./types"
import type { ComponentId, InstallResult } from "../components/types"
import { runInstall, runUninstall } from "../commands/install"
import { collectStatus } from "../commands/status"
import { resolvePreset } from "../presets"
import type { ComponentStatus } from "../components/types"
import { runDoctor } from "../commands/doctor"
import { checkUpgrade, runUpgrade } from "../commands/upgrade"
import type { DoctorRunResult } from "../components/types"
import type { UpgradeResult } from "../commands/upgrade"
import type { ToolUpdateResult, ToolUpdateStatus, UpdateTool } from "../updates/types"
import { createUpdateManager } from "../updates/manager"
import type { AgentTarget } from "../domain/environment"

/** Collect fresh status for all components */
export async function collectFreshStatus(target: AgentTarget = "opencode"): Promise<ComponentStatus[]> {
  return collectStatus(undefined, { target })
}

/** Start an install task with optional hooks */
export async function startInstallTask(
  componentIds: ComponentId[],
  hooks?: TaskHooks,
  target: AgentTarget = "opencode"
): Promise<InstallResult[]> {
  return runInstall(componentIds, "install", { hooks, target })
}

/** Start an uninstall task with optional hooks */
export async function startUninstallTask(
  componentIds: ComponentId[],
  hooks?: TaskHooks,
  target: AgentTarget = "opencode"
): Promise<InstallResult[]> {
  return runInstall(componentIds, "uninstall", { hooks, target })
}

/** Start a preset-based install */
export async function startPresetInstall(
  presetName: string,
  hooks?: TaskHooks,
  target: AgentTarget = "opencode"
): Promise<InstallResult[]> {
  const resolved = resolvePreset(presetName, { target })
  return runInstall(resolved.components, "install", { hooks, target })
}

/** Load doctor summary in read-only mode (no fixes) */
export async function loadDoctorSummary(): Promise<DoctorRunResult> {
  return runDoctor({ fix: false, verbose: false })
}

/** Start a doctor fix task (applies repairs) */
export async function startDoctorFixTask(): Promise<DoctorRunResult> {
  return runDoctor({ fix: true, verbose: false })
}

/** Load upgrade check status */
export async function loadUpgradeStatus(): Promise<ToolUpdateStatus[]> {
  return createUpdateManager(false).checkAll()
}

/** Start an upgrade task */
export async function startUpgradeTask(): Promise<UpgradeResult> {
  return runUpgrade()
}

export async function startToolUpdateTask(tools: UpdateTool[]): Promise<ToolUpdateResult[]> {
  return createUpdateManager(true).apply(tools)
}

/** Create TaskHooks that update a TUIState's task field */
export function createTaskHooks(
  onComponentStart: (id: ComponentId) => void,
  onComponentFinish: (result: InstallResult) => void
): TaskHooks {
  return {
    onComponentStart,
    onComponentFinish,
  }
}
