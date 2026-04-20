// src/components/types.ts — ComponentId, InstallResult, ComponentStatus, ComponentModule interfaces

export type ComponentId = "plugin" | "theme" | "sounds" | "context-mode"

export interface InstallResult {
  component: ComponentId
  action: "install" | "uninstall"
  status: "success" | "skipped" | "error"
  message?: string
  path?: string
}

export interface ComponentStatus {
  id: ComponentId
  label: string
  status: "installed" | "available" | "error"
  error?: string
}

export interface ComponentModule {
  id: ComponentId
  label: string
  install(): Promise<InstallResult>
  uninstall(): Promise<InstallResult>
  status(): Promise<ComponentStatus>
}
