// src/detection/registry.ts — detectAgents iterates registered AgentDetectors

import type { AgentTarget } from "../domain/environment"
import type { AgentDetectResult, AgentDetector } from "./types"

/**
 * Run all registered detectors against the given platform and produce
 * a map of agent target to detection result.
 *
 * Only targets covered by the provided detectors appear in the result.
 * If a target has no detector, it is simply absent from the record.
 */
export function detectAgents(
  detectors: AgentDetector[],
  platform: import("../domain/environment").PlatformInfo
): Partial<Record<AgentTarget, AgentDetectResult>> {
  const result: Partial<Record<AgentTarget, AgentDetectResult>> = {}

  for (const detector of detectors) {
    result[detector.target] = detector.detect(platform)
  }

  return result
}
