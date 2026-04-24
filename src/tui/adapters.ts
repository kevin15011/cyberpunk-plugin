// src/tui/adapters.ts — Wrap command functions for TUI intents with TaskHooks

import type { TaskHooks, TUIState } from "./types"
import type { ComponentId, InstallResult } from "../components/types"
import { runInstall, runUninstall } from "../commands/install"
import { collectStatus } from "../commands/status"
import { resolvePreset } from "../presets"
import type { ComponentStatus } from "../components/types"

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
