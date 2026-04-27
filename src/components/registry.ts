// src/components/registry.ts — Static capability map for all components
//
// Provides getCapabilities(), getCapabilitiesForTarget(), and
// getCapabilitiesForPlatform() to filter component capabilities by
// agent target or platform without coupling to component internals.

import type { ComponentCapability, AgentTarget, PlatformInfo } from "../domain/environment"
import type { ComponentId } from "./types"

/**
 * Static capability map for all 6 cyberpunk components.
 *
 * Current state: all components target "opencode" only. Claude and Codex
 * capabilities remain "unknown"/empty until their extension surfaces are verified.
 * This is intentional per design — adapters are low-risk parity wrappers.
 */
const CAPABILITY_MAP: ComponentCapability[] = [
  {
    component: "plugin",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin", "windows"],
    requires: [],
    status: "supported",
  },
  {
    component: "theme",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin", "windows"],
    requires: [],
    status: "supported",
  },
  {
    component: "sounds",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin", "windows"],
    requires: ["ffmpeg"],
    status: "supported",
  },
  {
    component: "context-mode",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: ["npm"],
    status: "supported",
  },
  {
    component: "rtk",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: ["curl"],
    status: "supported",
  },
  {
    component: "tmux",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: ["git"],
    status: "supported",
  },
  {
    component: "tui-plugins",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: [],
    status: "supported",
  },
  {
    component: "codebase-memory",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: ["curl"],
    status: "supported",
  },
  {
    component: "otel",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: [],
    status: "supported",
  },
  {
    component: "otel-collector",
    targets: ["opencode"],
    platforms: ["linux", "wsl", "darwin"],
    requires: ["curl"],
    status: "supported",
  },
]

/**
 * Return all component capabilities.
 */
export function getCapabilities(): ComponentCapability[] {
  return CAPABILITY_MAP
}

/**
 * Return capabilities that support the given agent target.
 */
export function getCapabilitiesForTarget(target: AgentTarget): ComponentCapability[] {
  return CAPABILITY_MAP.filter(cap => cap.targets.includes(target))
}

/**
 * Return capabilities that support the given platform.
 */
export function getCapabilitiesForPlatform(platform: PlatformInfo["kind"]): ComponentCapability[] {
  return CAPABILITY_MAP.filter(cap => cap.platforms.includes(platform))
}

/**
 * Look up a single component's capability by its ID.
 * Returns undefined if the component is not in the map.
 */
export function getCapabilityForComponent(id: ComponentId): ComponentCapability | undefined {
  return CAPABILITY_MAP.find(cap => cap.component === id)
}
