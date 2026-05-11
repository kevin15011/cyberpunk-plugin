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
import { configureSddReviewModel, getConfiguredSddReviewModel, listAvailableOpenCodeModels, type SddReviewAgentName } from "../opencode-config"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"

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
  return createUpdateManager(true).checkAll()
}

/** Start an upgrade task */
export async function startUpgradeTask(): Promise<UpgradeResult> {
  return runUpgrade()
}

export async function startToolUpdateTask(tools: UpdateTool[]): Promise<ToolUpdateResult[]> {
  return createUpdateManager(true).apply(tools)
}

export async function loadOpenCodeModelProviders() {
  return listAvailableOpenCodeModels()
}

export async function loadConfiguredSddReviewModels() {
  return {
    review: getConfiguredSddReviewModel(undefined, "sdd-review"),
    adversary: getConfiguredSddReviewModel(undefined, "sdd-review-adversary"),
  }
}

export async function configureOpenCodeSddReviewModel(modelRef: string, agentName: SddReviewAgentName = "sdd-review"): Promise<void> {
  const result = configureSddReviewModel(modelRef, agentName)
  if (result.warning) throw new Error(result.warning)
  const config = loadConfig()
  const review = { ...(config.sdd?.review ?? {}) }
  if (agentName === "sdd-review-adversary") review.adversaryModel = modelRef
  else review.model = modelRef
  config.sdd = {
    ...(config.sdd ?? {}),
    review,
    judgmentDay: { mode: config.sdd?.judgmentDay?.mode ?? "ask" },
  }
  saveConfig(config)
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
