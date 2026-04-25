// src/commands/status-routing.ts — pure environment status shaping for status command

import type { AgentTarget, PlatformInfo } from "../domain/environment"
import type { AgentDetectResult } from "../detection/types"

export interface EnvironmentStatus {
  platform: PlatformInfo
  agents: Partial<Record<AgentTarget, AgentDetectResult>>
}

export function buildEnvironmentStatus(
  platform: PlatformInfo,
  agents: Partial<Record<AgentTarget, AgentDetectResult>>
): EnvironmentStatus {
  return {
    platform: { ...platform },
    agents: { ...agents },
  }
}
