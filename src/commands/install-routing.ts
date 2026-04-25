// src/commands/install-routing.ts — component compatibility filtering for install routing

import type { ComponentId } from "../components/types"
import type { AgentTarget, PlatformInfo } from "../domain/environment"
import { getCapabilitiesForTarget, getCapabilitiesForPlatform } from "../components/registry"

/**
 * Filter component IDs to those compatible with the given agent target and platform.
 */
export function filterComponentsForTarget(
  target: AgentTarget,
  platform: PlatformInfo
): ComponentId[] {
  const byTarget = getCapabilitiesForTarget(target)
  const byPlatform = getCapabilitiesForPlatform(platform.kind)
  const compatible = byTarget.filter(cap =>
    cap.platforms.includes(platform.kind) &&
    cap.status !== "unsupported" &&
    cap.status !== "unknown"
  )
  const platformSet = new Set(byPlatform.map(c => c.component))
  return compatible
    .filter(cap => platformSet.has(cap.component))
    .map(cap => cap.component)
}
