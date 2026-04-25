// src/detection/recommend.ts — Generate recommendations from capabilities + agent state

import type {
  AgentTarget,
  ComponentCapability,
  PlatformInfo,
  Recommendation,
} from "../domain/environment"
import type { AgentDetectResult } from "./types"

/**
 * Generate installation recommendations for a set of component capabilities
 * given the current agent detection state and platform.
 *
 * Decision matrix:
 * - status "unsupported"         -> skip
 * - status "unknown"             -> warn
 * - platform not in platforms[]  -> skip
 * - no target agent installed    -> defer
 * - agent installed + supported  -> install (high priority)
 */
export function generateRecommendations(
  capabilities: ComponentCapability[],
  agents: Partial<Record<AgentTarget, AgentDetectResult>>,
  platform: PlatformInfo
): Recommendation[] {
  const recommendations: Recommendation[] = []

  for (const cap of capabilities) {
    const rec = recommendForCapability(cap, agents, platform)
    if (rec) {
      recommendations.push(rec)
    }
  }

  return recommendations
}

/**
 * Produce a single recommendation for one component capability.
 */
function recommendForCapability(
  cap: ComponentCapability,
  agents: Partial<Record<AgentTarget, AgentDetectResult>>,
  platform: PlatformInfo
): Recommendation | null {
  // Unsupported components are always skipped
  if (cap.status === "unsupported") {
    return {
      component: cap.component,
      target: cap.targets[0],
      action: "skip",
      reason: `Component '${cap.component}' is unsupported in this configuration`,
      priority: "low",
    }
  }

  // Unknown status — warn the user without recommending action
  if (cap.status === "unknown") {
    return {
      component: cap.component,
      target: cap.targets[0],
      action: "warn",
      reason: `Compatibility for '${cap.component}' is unverified`,
      priority: "medium",
    }
  }

  // Platform not in the supported list
  if (!cap.platforms.includes(platform.kind)) {
    return {
      component: cap.component,
      target: cap.targets[0],
      action: "skip",
      reason: `Not available on ${platform.kind} platform`,
      priority: "low",
    }
  }

  // Find the first target agent that is installed
  const installedTarget = findInstalledTarget(cap.targets, agents)

  if (!installedTarget) {
    // No matching agent installed — defer with reason
    const targetList = cap.targets.join(" or ")
    return {
      component: cap.component,
      target: cap.targets[0],
      action: "defer",
      reason: `Requires ${targetList} which is not installed`,
      priority: "medium",
    }
  }

  // Agent installed and platform supported — recommend install
  return {
    component: cap.component,
    target: installedTarget,
    action: "install",
    reason: `Ready for ${installedTarget}`,
    priority: "high",
  }
}

/**
 * Find the first target from the list that has an installed agent.
 */
function findInstalledTarget(
  targets: AgentTarget[],
  agents: Partial<Record<AgentTarget, AgentDetectResult>>
): AgentTarget | undefined {
  for (const target of targets) {
    const state = agents[target]
    if (state?.installed) {
      return target
    }
  }
  return undefined
}
