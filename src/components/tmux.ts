// src/components/tmux.ts — marker-managed tmux config install/uninstall/status/doctor

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { join, dirname } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult, TmuxBootstrapResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { isCommandOnPath } from "../platform/shell"

function getTmuxConfPath(): string {
  const home = getHomeDirAuto()
  return join(home, ".tmux.conf")
}

const MANAGED_START = "# cyberpunk-managed:start"
const MANAGED_END = "# cyberpunk-managed:end"

// Bundled tmux.conf content (read at build time, inlined for compiled binary)
export const BUNDLED_TMUX_CONF = `# =============================================
# Configuracion General Pro
# =============================================
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

set -g escape-time 10
set -g history-limit 50000
set -g mouse on
set -g allow-rename off
set -g renumber-windows on

set -g base-index 1
setw -g pane-base-index 1

setw -g mode-keys vi
set -g status-keys vi

# =============================================
# Plugins
# =============================================
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'
set -g @plugin 'tmux-plugins/tmux-cpu'
set -g @plugin 'tmux-plugins/tmux-yank'

set -g @plugin 'arl/gitmux'

set -g @resurrect-processes 'ssh psql mysql sqlite3 node npm python python3 nvim opencode'
set -g @continuum-restore 'on'
set -g @continuum-save-interval '15'

# =============================================
# Atajos (Keybindings) estilo pro
# =============================================
unbind C-b
set -g prefix C-a
bind C-a send-prefix

bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"

bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

bind -r H resize-pane -L 5
bind -r J resize-pane -D 5
bind -r K resize-pane -U 5
bind -r L resize-pane -R 5

bind r source-file ~/.tmux.conf \\; display ">> CONFIG RELOADED <<"

# =============================================
# COLORES CYBERPUNK // MAXIMUM NEON OVERDRIVE
# =============================================

set -g message-style 'fg=#05050f bg=#ff00ff bold'
set -g message-command-style 'fg=#05050f bg=#00ffff bold'

setw -g mode-style 'fg=#05050f bg=#00ff41 bold'

set -g pane-border-style 'fg=#1a0a2e bg=default'
set -g pane-active-border-style 'fg=#ff00ff bg=#0a0a1e'
set -g pane-border-lines heavy

setw -g clock-mode-colour '#00ffff'
setw -g clock-mode-style 24

set -g popup-style 'fg=#e0e0ff bg=#0a0a1e'
set -g popup-border-style 'fg=#ff00ff'

# Status bar
set -g status-style 'fg=#b0b0d0 bg=#05050f'
set -g status-position bottom
set -g status-justify centre

# Ventanas
setw -g window-status-style 'fg=#3a3a6a bg=#05050f'
setw -g window-status-current-style 'fg=#00ffff bg=#0f0f2a bold'
setw -g window-status-activity-style 'fg=#ff00ff bg=#05050f'
setw -g window-status-bell-style 'fg=#ff0055 bg=#0f0f2a blink bold'

setw -g window-status-separator ''
set -g window-style 'fg=#5a5a7a'
set -g window-active-style 'fg=#e0e0ff'

# Formato ventanas — HUD glitch style
setw -g window-status-current-format '#[fg=#ff0055]╔#[fg=#0a0a1e,bg=#ff00ff] #[fg=#fffc00,bold] #I #[fg=#0a0a1e,bg=#b400ff] #[fg=#fffc00,bold]#W #[fg=#ff00ff,bg=#0f0f2a]#[fg=#ff0055]╚#[default]'
setw -g window-status-format '#[fg=#3a3a6a] ├ #I · #W ├ #[default]'

# =============================================
# Barra de estado — Cyberpunk HUD MEJORADO
# =============================================
set -g status-left-length 80
set -g status-left '#[fg=#05050f,bg=#ff00ff,bold] #[fg=#fffc00,bg=#ff00ff,bold]⌥ #S #[fg=#ff00ff,bg=#b400ff]#[fg=#fffc00,bg=#b400ff] #[fg=#b400ff,bg=#05050f]#[fg=#ff00ff]──#[fg=#1a0a2e]│#[fg=#00ff41] #{gitmux}#[default]'

set -g status-right-length 180
set -g status-right '#[fg=#1a0a2e]│#[fg=#ff00ff]──#[fg=#fffc00,bg=#b400ff] #[fg=#fffc00,bold]CPU #[fg=#fffc00,bg=#ff00ff,bold] #[fg=#05050f,bg=#00ff41,bold]↑#{cpu_percentage} #[fg=#00ff41,bg=#05050f]#[fg=#ff00ff]─#[fg=#05050f,bg=#00ffff] #[fg=#05050f,bold]RAM #[fg=#fffc00,bg=#b400ff,bold] #[fg=#05050f,bg=#00ffff,bold]⬡#{ram_percentage} #[fg=#00ffff,bg=#05050f]#[fg=#ff00ff]─#[fg=#fffc00,bg=#ff0055] #[fg=#fffc00,bold]%d-%m #[fg=#ff0055,bg=#0a0a1e]#[fg=#05050f,bg=#00ff41,bold] #[fg=#05050f,bold]%H:%M #[fg=#00ff41,bg=#05050f]#[fg=#00ff41]#[default]'

# =============================================
# Visual bell - flash neon
# =============================================
set -g visual-bell on
set -g bell-action any

# =============================================
# Inicializar TPM (siempre al final!)
# =============================================
run '~/.tmux/plugins/tpm/tpm'`

// --- Marker-managed block helpers ---

export function readManagedBlock(content: string): { before: string; block: string; after: string } | null {
  const startIdx = content.indexOf(MANAGED_START)
  const endIdx = content.indexOf(MANAGED_END)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null
  return {
    before: content.slice(0, startIdx),
    block: content.slice(startIdx, endIdx + MANAGED_END.length),
    after: content.slice(endIdx + MANAGED_END.length),
  }
}

export function insertManagedBlock(existingContent: string, body: string): string {
  const current = readManagedBlock(existingContent)
  const managedBlock = `${MANAGED_START}\n${body}\n${MANAGED_END}`
  if (current) {
    // Replace existing managed block
    return current.before + managedBlock + current.after
  }
  // Append managed block
  const separator = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n\n" : "\n"
  return existingContent + separator + managedBlock + "\n"
}

export function removeManagedBlock(content: string): string {
  const current = readManagedBlock(content)
  if (!current) return content
  // Clean up extra blank lines left behind
  let result = current.before + current.after
  result = result.replace(/\n{3,}/g, "\n\n")
  return result
}

// --- Path helpers ---

function isTmuxOnPath(): boolean {
  return isCommandOnPath("tmux")
}

export function isGitAvailable(): boolean {
  return isCommandOnPath("git")
}

export function getTpmDir(home = getHomeDirAuto()): string {
  return join(home, ".tmux", "plugins", "tpm")
}

function isTpmInstalled(home = getHomeDirAuto()): boolean {
  const tpmPath = join(getTpmDir(home), "tpm")
  return existsSync(tpmPath)
}

function areTmuxPluginsReady(home = getHomeDirAuto()): boolean {
  const pluginsDir = join(home, ".tmux", "plugins")
  const requiredPlugins = [
    "tmux-sensible",
    "tmux-resurrect",
    "tmux-continuum",
    "tmux-cpu",
    "tmux-yank",
    "gitmux",
  ]

  return requiredPlugins.every(plugin => existsSync(join(pluginsDir, plugin)))
}

export function cloneTpm(home: string): boolean {
  try {
    mkdirSync(dirname(getTpmDir(home)), { recursive: true })
    execSync(`git clone https://github.com/tmux-plugins/tpm ${JSON.stringify(getTpmDir(home))} >/dev/null 2>&1`, {
      stdio: "pipe",
      env: { ...process.env, HOME: home },
    })
    return true
  } catch {
    return false
  }
}

export function runTpmScript(
  home: string,
  script: "install_plugins" | "update_plugins"
): "ok" | "script-missing" | "failed" {
  const candidates = [
    join(getTpmDir(home), "bin", script),
    join(getTpmDir(home), "scripts", `${script}.sh`),
  ]
  const scriptPath = candidates.find(path => existsSync(path))

  if (!scriptPath) return "script-missing"

  try {
    execSync(`${JSON.stringify(scriptPath)} all >/dev/null 2>&1`, {
      stdio: "pipe",
      env: { ...process.env, HOME: home },
    })
    return "ok"
  } catch {
    return "failed"
  }
}

export function bootstrapTpm(home: string): TmuxBootstrapResult {
  const warnings: string[] = []

  if (!isTpmInstalled(home)) {
    if (!isGitAvailable()) {
      warnings.push("git no está disponible; TPM no pudo instalarse automáticamente")
      return { tpmState: "missing-git", pluginsState: "install-failed", warnings }
    }

    if (!cloneTpm(home)) {
      warnings.push("TPM no pudo clonarse automáticamente")
      return { tpmState: "clone-failed", pluginsState: "install-failed", warnings }
    }

    const installResult = runTpmScript(home, "install_plugins")
    if (installResult === "ok") {
      return { tpmState: "cloned", pluginsState: "installed", warnings }
    }

    if (installResult === "script-missing") {
      warnings.push("TPM fue clonado pero no se encontró el script de instalación de plugins")
      return { tpmState: "cloned", pluginsState: "script-missing", warnings }
    }

    warnings.push("La instalación de plugins tmux falló después de clonar TPM")
    return { tpmState: "cloned", pluginsState: "install-failed", warnings }
  }

  const updateResult = runTpmScript(home, "update_plugins")
  if (updateResult === "ok") {
    return { tpmState: "present", pluginsState: "updated", warnings }
  }

  if (updateResult === "failed") {
    warnings.push("La actualización de plugins tmux falló")
    return { tpmState: "present", pluginsState: "install-failed", warnings }
  }

  const installResult = runTpmScript(home, "install_plugins")
  if (installResult === "ok") {
    return { tpmState: "present", pluginsState: "ready", warnings }
  }

  if (installResult === "script-missing") {
    warnings.push("TPM está presente pero no se encontró el script de instalación/actualización")
    return { tpmState: "present", pluginsState: "script-missing", warnings }
  }

  warnings.push("La instalación de plugins tmux falló")
  return { tpmState: "present", pluginsState: "install-failed", warnings }
}

function buildBootstrapMessage(baseMessage: string | undefined, result: TmuxBootstrapResult): string | undefined {
  if (result.warnings.length === 0) return baseMessage
  return [baseMessage, ...result.warnings].filter(Boolean).join(" — ")
}

function isGitmuxOnPath(): boolean {
  return isCommandOnPath("gitmux")
}

// --- Component factory ---

export function getTmuxComponent(): ComponentModule {
  return {
    id: "tmux",
    label: COMPONENT_LABELS.tmux,

    async install(): Promise<InstallResult> {
      const tmuxConfPath = getTmuxConfPath()
      // Read existing ~/.tmux.conf or start fresh
      let existingContent = ""
      if (existsSync(tmuxConfPath)) {
        existingContent = readFileSync(tmuxConfPath, "utf8")

        // Check if already installed with same content
        const currentBlock = readManagedBlock(existingContent)
        if (currentBlock) {
          const managedBlock = `${MANAGED_START}\n${BUNDLED_TMUX_CONF}\n${MANAGED_END}`
          if (currentBlock.block === managedBlock) {
            // Already installed with identical content
            const config = loadConfig()
            config.components.tmux = {
              installed: true,
              version: "bundled",
              installedAt: new Date().toISOString(),
              path: tmuxConfPath,
            }
            saveConfig(config)

            const bootstrapResult = bootstrapTpm(getHomeDirAuto())

            return {
              component: "tmux",
              action: "install",
              status: "skipped",
              message: buildBootstrapMessage("Tmux config already installed and up to date", bootstrapResult),
              path: tmuxConfPath,
            }
          }
        }

        // Backup before modification
        writeFileSync(tmuxConfPath + ".bak", existingContent, "utf8")
      }

      // Insert or replace the managed block
      const newContent = insertManagedBlock(existingContent, BUNDLED_TMUX_CONF)

      // Atomic write
      const tmpPath = tmuxConfPath + ".tmp"
      writeFileSync(tmpPath, newContent, "utf8")
      renameSync(tmpPath, tmuxConfPath)

      // Update config state
      const config = loadConfig()
      config.components.tmux = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: tmuxConfPath,
      }
      saveConfig(config)

      const bootstrapResult = bootstrapTpm(getHomeDirAuto())

      return {
        component: "tmux",
        action: "install",
        status: "success",
        message: buildBootstrapMessage(undefined, bootstrapResult),
        path: tmuxConfPath,
      }
    },

    async uninstall(): Promise<InstallResult> {
      const tmuxConfPath = getTmuxConfPath()

      if (!existsSync(tmuxConfPath)) {
        return {
          component: "tmux",
          action: "uninstall",
          status: "skipped",
          message: "No se encontró ~/.tmux.conf",
        }
      }

      const existingContent = readFileSync(tmuxConfPath, "utf8")

      // Check if managed block exists
      if (!readManagedBlock(existingContent)) {
        return {
          component: "tmux",
          action: "uninstall",
          status: "skipped",
          message: "No se encontró bloque cyberpunk en ~/.tmux.conf",
        }
      }

      // Backup before modification
      writeFileSync(tmuxConfPath + ".bak", existingContent, "utf8")

      // Remove only the managed block
      const newContent = removeManagedBlock(existingContent)

      // Atomic write
      const tmpPath = tmuxConfPath + ".tmp"
      writeFileSync(tmpPath, newContent, "utf8")
      renameSync(tmpPath, tmuxConfPath)

      // Update config state
      const config = loadConfig()
      config.components.tmux = { installed: false }
      saveConfig(config)

      return {
        component: "tmux",
        action: "uninstall",
        status: "success",
        path: tmuxConfPath,
      }
    },

    async status(): Promise<ComponentStatus> {
      const tmuxConfPath = getTmuxConfPath()
      const hasBinary = isTmuxOnPath()
      const configExists = existsSync(tmuxConfPath)

      // Check for managed block
      let hasManagedBlock = false
      if (configExists) {
        const content = readFileSync(tmuxConfPath, "utf8")
        hasManagedBlock = readManagedBlock(content) !== null
      }

      if (hasManagedBlock) {
        if (!hasBinary) {
          // Markers exist but tmux binary missing — unusable
          return {
            id: "tmux",
            label: COMPONENT_LABELS.tmux,
            status: "error",
            error: "tmux binary no encontrado — config instalada pero no usable",
          }
        }
        return {
          id: "tmux",
          label: COMPONENT_LABELS.tmux,
          status: "installed",
        }
      }

      return {
        id: "tmux",
        label: COMPONENT_LABELS.tmux,
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []
      const tmuxConfPath = getTmuxConfPath()

      // Check 1: tmux binary on PATH
      const hasBinary = isTmuxOnPath()
      checks.push({
        id: "tmux:binary",
        label: "tmux binary",
        status: hasBinary ? "pass" : "warn",
        message: hasBinary ? "tmux disponible en PATH" : "tmux no encontrado en PATH",
        fixable: false,
      })

      // Check 2: managed config block presence
      let hasManagedBlock = false
      if (existsSync(tmuxConfPath)) {
        const content = readFileSync(tmuxConfPath, "utf8")
        hasManagedBlock = readManagedBlock(content) !== null
      }

      if (hasManagedBlock) {
        const details = ctx.verbose ? ` (${tmuxConfPath})` : ""
        checks.push({
          id: "tmux:config",
          label: "Config tmux cyberpunk",
          status: "pass",
          message: `Bloque cyberpunk presente en ~/.tmux.conf${details}`,
          fixable: false,
        })
      } else {
        checks.push({
          id: "tmux:config",
          label: "Config tmux cyberpunk",
          status: "fail",
          message: "Bloque cyberpunk no encontrado en ~/.tmux.conf",
          fixable: true,
        })
      }

      // Check 3: TPM directory
      const hasTpm = isTpmInstalled()
      checks.push({
        id: "tmux:tpm",
        label: "TPM (Tmux Plugin Manager)",
        status: hasTpm ? "pass" : "warn",
        message: hasTpm
          ? "TPM instalado"
          : ctx.prerequisites.git
            ? "TPM no encontrado — doctor --fix puede clonarlo automáticamente"
            : "TPM no encontrado — git no está disponible para instalarlo automáticamente",
        fixable: !hasTpm && ctx.prerequisites.git,
      })

      const pluginsReady = areTmuxPluginsReady()
      checks.push({
        id: "tmux:plugins",
        label: "Plugins tmux",
        status: pluginsReady ? "pass" : "warn",
        message: pluginsReady
          ? "Plugins tmux instalados"
          : "Plugins tmux no listos — doctor --fix intentará instalarlos sin tocar tu config no gestionada",
        fixable: !pluginsReady && (hasTpm || ctx.prerequisites.git),
      })

      // Check 5: gitmux on PATH
      const hasGitmux = isGitmuxOnPath()
      checks.push({
        id: "tmux:gitmux",
        label: "gitmux",
        status: hasGitmux ? "pass" : "warn",
        message: hasGitmux
          ? "gitmux disponible en PATH"
          : "gitmux no encontrado — status bar no mostrará info de git",
        fixable: false,
      })

      return { component: "tmux", checks }
    },
  }
}
