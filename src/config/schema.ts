// src/config/schema.ts — CyberpunkConfig interface with defaults

export type ComponentId = "plugin" | "theme" | "sounds" | "context-mode"
export type InstallMode = "repo" | "binary"

export interface ComponentState {
  installed: boolean
  version?: string
  installedAt?: string
  path?: string
}

export interface CyberpunkConfig {
  version: number
  components: Record<ComponentId, ComponentState>
  lastUpgradeCheck?: string
  repoUrl?: string
  installMode?: InstallMode
  pluginRegistered?: boolean
}

export const COMPONENT_IDS: ComponentId[] = ["plugin", "theme", "sounds", "context-mode"]

export const COMPONENT_LABELS: Record<ComponentId, string> = {
  plugin: "Plugin de OpenCode",
  theme: "Tema cyberpunk",
  sounds: "Sonidos",
  "context-mode": "Context-Mode",
}

export const DEFAULT_REPO_URL = "https://github.com/kevin15011/cyberpunk-plugin"

export function createDefaultConfig(): CyberpunkConfig {
  return {
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
    },
    repoUrl: DEFAULT_REPO_URL,
  }
}
