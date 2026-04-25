// src/domain/environment.ts — shared discriminated unions and result contracts

import type { ComponentId } from "../components/types"

// --- Literal union types ---

export type AgentTarget = "opencode" | "claude" | "codex"
export type UserProfile = "non-technical" | "developer" | "admin"

// --- Interfaces ---

export interface PlatformInfo {
  kind: "linux" | "wsl" | "darwin" | "windows"
  arch: NodeJS.Architecture
  configRoot: string
}

export interface ShellInfo {
  kind: "bash" | "zsh" | "powershell" | "cmd" | "unknown"
  executable?: string
}

export interface ComponentCapability {
  component: ComponentId
  targets: AgentTarget[]
  platforms: PlatformInfo["kind"][]
  requires: string[]
  status: "supported" | "degraded" | "unsupported" | "unknown"
}

export interface DetectionResult {
  platform: PlatformInfo
  shell: ShellInfo
  agents: Record<AgentTarget, { installed: boolean; version?: string; configPath?: string }>
  capabilities: ComponentCapability[]
}

export interface Recommendation {
  component: ComponentId
  target: AgentTarget
  action: "install" | "skip" | "warn" | "defer"
  reason: string
  priority: "high" | "medium" | "low"
}

// --- Constant arrays for runtime exhaustiveness checks ---

export const AGENT_TARGETS: AgentTarget[] = ["opencode", "claude", "codex"]

export const PLATFORM_KINDS: PlatformInfo["kind"][] = ["windows", "wsl", "darwin", "linux"]

export const SHELL_KINDS: ShellInfo["kind"][] = ["powershell", "cmd", "bash", "zsh", "unknown"]

export const CAPABILITY_STATUSES: ComponentCapability["status"][] = ["supported", "degraded", "unsupported", "unknown"]

export const RECOMMENDATION_ACTIONS: Recommendation["action"][] = ["install", "skip", "warn", "defer"]

export const RECOMMENDATION_PRIORITIES: Recommendation["priority"][] = ["high", "medium", "low"]

export const USER_PROFILES: UserProfile[] = ["non-technical", "developer", "admin"]
