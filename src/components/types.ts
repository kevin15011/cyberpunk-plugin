// src/components/types.ts — ComponentId, InstallResult, ComponentStatus, ComponentModule, Doctor interfaces

import type { CyberpunkConfig } from "../config/schema"

export type ComponentId = "plugin" | "theme" | "sounds" | "context-mode" | "rtk" | "tmux"

export interface InstallResult {
  component: ComponentId
  action: "install" | "uninstall"
  status: "success" | "skipped" | "error"
  message?: string
  path?: string
}

export interface TmuxBootstrapResult {
  tpmState: "present" | "cloned" | "missing-git" | "clone-failed"
  pluginsState: "ready" | "installed" | "updated" | "script-missing" | "install-failed"
  warnings: string[]
}

export interface ComponentStatus {
  id: ComponentId
  label: string
  status: "installed" | "available" | "error"
  error?: string
}

// --- Doctor interfaces ---

export interface DoctorCheck {
  id: string                          // e.g. "plugin:patching", "platform:ffmpeg"
  label: string
  status: "pass" | "fail" | "warn"
  message: string
  fixable: boolean
  fixed?: boolean                     // true after successful --fix
}

export interface DoctorFixResult {
  checkId: string
  status: "fixed" | "unchanged" | "failed" | "skipped"
  message: string
}

export interface DoctorContext {
  cyberpunkConfig: CyberpunkConfig | null
  verbose: boolean
  /** Prerequisites already checked once by the platform doctor */
  prerequisites: {
    ffmpeg: boolean
    npm: boolean
    bun: boolean
    curl: boolean
    git: boolean
  }
}

export interface DoctorResult {
  component: ComponentId | "platform" | "config"
  checks: DoctorCheck[]
}

export interface DoctorRunResult {
  checks: DoctorCheck[]
  /** Grouped results per component — includes empty entries for modules without doctor() */
  results: DoctorResult[]
  fixes: DoctorFixResult[]
  summary: {
    healthy: number
    warnings: number
    failures: number
    fixed: number
    remainingFailures: number
  }
}

export interface ComponentModule {
  id: ComponentId
  label: string
  install(): Promise<InstallResult>
  uninstall(): Promise<InstallResult>
  status(): Promise<ComponentStatus>
  doctor?(ctx: DoctorContext): Promise<DoctorResult>
}
