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
import type { UpgradeStatus, UpgradeResult } from "../commands/upgrade"

/** Collect fresh status for all components */
export async function collectFreshStatus(): Promise<ComponentStatus[]> {
  return collectStatus()
}

/** Start an install task with optional hooks */
export async function startInstallTask(
  componentIds: ComponentId[],
  hooks?: TaskHooks
): Promise<InstallResult[]> {
  return runInstall(componentIds, "install", hooks)
}

/** Start an uninstall task with optional hooks */
export async function startUninstallTask(
  componentIds: ComponentId[],
  hooks?: TaskHooks
): Promise<InstallResult[]> {
  return runInstall(componentIds, "uninstall", hooks)
}

/** Start a preset-based install */
export async function startPresetInstall(
  presetName: string,
  hooks?: TaskHooks
): Promise<InstallResult[]> {
  const resolved = resolvePreset(presetName)
  return runInstall(resolved.components, "install", hooks)
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
export async function loadUpgradeStatus(): Promise<UpgradeStatus> {
  return checkUpgrade()
}

/** Start an upgrade task */
export async function startUpgradeTask(): Promise<UpgradeResult> {
  return runUpgrade()
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
