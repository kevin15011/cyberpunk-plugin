// src/config/schema.ts — CyberpunkConfig interface with defaults (v2)

import type { AgentTarget, UserProfile } from "../domain/environment"

export type ComponentId = "plugin" | "theme" | "sounds" | "context-mode" | "rtk" | "tmux" | "tui-plugins" | "codebase-memory" | "otel" | "otel-collector"
export type InstallMode = "repo" | "binary"

export interface ComponentState {
  installed: boolean
  version?: string
  installedAt?: string
  path?: string
}

/**
 * Per-agent detection state persisted in config.
 * Mirrors AgentDetectResult from detection/types.ts but stored as config data.
 */
export interface AgentStateEntry {
  installed: boolean
  version?: string
  configPath?: string
}

export interface CyberpunkConfig {
  version: number
  components: Record<ComponentId, ComponentState>
  lastUpgradeCheck?: string
  repoUrl?: string
  installMode?: InstallMode
  pluginRegistered?: boolean
  /** v2: selected agent target — defaults to "opencode" */
  target?: AgentTarget
  /** v2: user experience profile */
  profile?: UserProfile
  /** v2: per-agent detection state cache */
  agentState?: Record<string, AgentStateEntry>
}

export const COMPONENT_IDS: ComponentId[] = ["plugin", "theme", "sounds", "context-mode", "rtk", "tmux", "tui-plugins", "codebase-memory", "otel", "otel-collector"]

export const COMPONENT_LABELS: Record<ComponentId, string> = {
  plugin: "Plugin de OpenCode",
  theme: "Tema cyberpunk",
  sounds: "Sonidos",
  "context-mode": "Context-Mode",
  rtk: "RTK (Token Proxy)",
  tmux: "Tmux config",
  "tui-plugins": "TUI Plugins (SDD Engram + Statusline)",
  "codebase-memory": "Codebase Memory MCP",
  otel: "OpenTelemetry Plugin",
  "otel-collector": "OTEL Collector",
}

export const DEFAULT_REPO_URL = "https://github.com/kevin15011/cyberpunk-plugin"

const DEFAULT_COMPONENTS: Record<ComponentId, ComponentState> = {
  plugin: { installed: false },
  theme: { installed: false },
  sounds: { installed: false },
  "context-mode": { installed: false },
  rtk: { installed: false },
  tmux: { installed: false },
  "tui-plugins": { installed: false },
  "codebase-memory": { installed: false },
  otel: { installed: false },
  "otel-collector": { installed: false },
}

export function createDefaultConfig(): CyberpunkConfig {
  return {
    version: 2,
    components: { ...DEFAULT_COMPONENTS },
    repoUrl: DEFAULT_REPO_URL,
    target: "opencode",
    profile: undefined,
    agentState: {},
  }
}
