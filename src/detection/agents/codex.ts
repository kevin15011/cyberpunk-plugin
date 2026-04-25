// src/detection/agents/codex.ts — Codex agent detector (stub: always unknown)

import type { PlatformInfo } from "../../domain/environment"
import type { AgentDetectResult, AgentDetector } from "../types"

const CODEX_RATIONALE = "Codex presence and extension support cannot be verified safely; detection deferred until integration surface is confirmed"

/**
 * Create a Codex agent detector.
 *
 * This is a conservative stub that always returns `status: "unknown"`
 * because Codex target identity and config surface remain ambiguous.
 * No probing is performed — no real binaries are invoked, no paths checked.
 *
 * Per spec: "cannot be verified safely" — no support claim is made
 * without explicit rationale.
 */
export function createCodexDetector(): AgentDetector {
  return {
    target: "codex",

    detect(_platform: PlatformInfo): AgentDetectResult {
      return {
        installed: false,
        status: "unknown",
        rationale: CODEX_RATIONALE,
      }
    },
  }
}
