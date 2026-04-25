// src/detection/types.ts — AgentDetector interface and result contract

import type { AgentTarget, PlatformInfo } from "../domain/environment"

/**
 * Semantic detection status distinguishing between not-found and uncertain states.
 * - "installed": agent binary found and version/config resolved
 * - "unsupported": agent binary absent, platform or surface not supported
 * - "unknown": detection could not complete safely (error, ambiguous state)
 */
export type AgentDetectStatus = "installed" | "unsupported" | "unknown"

/**
 * Result of probing a single agent's installation state.
 * Matches the inner type of DetectionResult.agents in domain/environment.ts.
 */
export interface AgentDetectResult {
  installed: boolean
  version?: string
  configPath?: string
  /** Semantic detection status — distinguishes between not-found and uncertain states */
  status?: AgentDetectStatus
  /** Explanation for the detection status when non-trivial */
  rationale?: string
}

/**
 * An agent detector knows how to probe for a specific agent target.
 * Implementations MUST be safe (never throw) — errors during probing
 * produce { installed: false } results rather than exceptions.
 */
export interface AgentDetector {
  readonly target: AgentTarget
  detect(platform: PlatformInfo): AgentDetectResult
}
