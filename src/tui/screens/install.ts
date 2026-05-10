// src/tui/screens/install.ts — Install screen: OS → Tool → Preset/Manual → Confirm flow

import type { KeyEvent, ScreenModule, ScreenResult, TUIState, InstallPhase } from "../types"
import { cyan, green, red, yellow, bold, gray, separator, pink } from "../theme"
import { getPresetNames } from "../../presets"
import type { ComponentId } from "../../components/types"
import { detectEnvironment, getPlatformLabel, type DetectedEnvironment } from "../../platform/detect"
import type { AgentTarget } from "../../domain/environment"
import { AGENT_TARGETS } from "../../domain/environment"

/** OS options shown in os-select phase */
const OS_OPTIONS: { value: DetectedEnvironment; label: string }[] = [
  { value: "darwin", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "wsl", label: "WSL (Windows Subsystem for Linux)" },
]

/** Tool options shown in tool-select phase */
const TOOL_OPTIONS: { value: AgentTarget; label: string; implemented: boolean; hint: string }[] = [
  { value: "opencode", label: "OpenCode", implemented: true, hint: "Soporte completo" },
  { value: "claude", label: "Claude Code", implemented: false, hint: "Próximamente / No implementado" },
  { value: "codex", label: "Codex", implemented: true, hint: "Ahorro de tokens: RTK, context-mode y codebase-memory" },
]

/** Auto-detected OS — used as default in os-select */
const AUTO_DETECTED_OS = detectEnvironment()

/** Determine the current install phase from explicit state tracking */
function getPhase(state: TUIState): InstallPhase {
  if (state.route.id !== "install") return "os-select"

  // Check explicit phase tracking
  if (state._installPhase === "confirm") return "confirm"
  if (state._installPhase === "manual") return "manual"
  if (state._installPhase === "preset") return "preset"
  if (state._installPhase === "tool-select") return "tool-select"
  if (state._installPhase === "os-select") return "os-select"

  // Default flow: OS not selected → os-select; tool not selected → tool-select;
  // preset chosen or components selected → confirm; otherwise → preset
  if (!state.selectedOS) return "os-select"
  if (!state.selectedTool) return "tool-select"
  if (state.selectedPreset) return "confirm"
  if (state.selectedComponents.length > 0) return "confirm"
  return "preset"
}

function getPresetOptions(target: AgentTarget = "opencode") {
  return [
    ...getPresetNames(target).map(p => ({ value: p.value, label: p.label, hint: p.hint })),
    { value: "manual", label: "Selección manual", hint: "Elegir componentes individualmente" },
  ]
}

function renderTargetStatus(lines: string[], state: TUIState): void {
  const toolLabel = state.selectedTool === "codex" ? "Codex" : "OpenCode"
  lines.push(gray(`  Estado rápido para ${toolLabel}:`))
  if (state.statuses.length === 0) {
    lines.push(gray("  No hay componentes compatibles para este target"))
    return
  }
  for (const s of state.statuses) {
    const icon = s.status === "installed" ? green("[INSTALLED]")
      : s.status === "error" ? red("[ERROR]")
        : cyan("[AVAILABLE]")
    const statusText = s.status === "installed" ? green("instalado")
      : s.status === "error" ? red("error")
        : gray("disponible")
    lines.push(`  ${icon} ${s.label}  ${statusText}`)
  }
}

export const installScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const phase = getPhase(state)
    const headerText = bold(cyan("INSTALAR COMPONENTES"))
    lines.push(`  ${headerText}`)
    lines.push(separator())
    lines.push("")

    if (phase === "os-select") {
      lines.push(gray("  Paso 1/3: Seleccioná tu sistema operativo:"))
      lines.push("")
      const autoLabel = getPlatformLabel(AUTO_DETECTED_OS)
      for (let i = 0; i < OS_OPTIONS.length; i++) {
        const opt = OS_OPTIONS[i]
        const cursor = state.cursor === i ? cyan(">") : " "
        const label = state.cursor === i ? bold(opt.label) : opt.label
        const autoHint = opt.value === AUTO_DETECTED_OS ? green(` (detectado: ${autoLabel})`) : ""
        lines.push(`  ${cursor} ${label}${autoHint}`)
      }
      lines.push("")
      lines.push(gray("  ↑/↓ navegar · Enter seleccionar · Esc volver · H inicio"))
    } else if (phase === "tool-select") {
      const osLabel = state.selectedOS ? getPlatformLabel(state.selectedOS) : "?"
      lines.push(gray(`  OS: ${green(osLabel)}`))
      lines.push("")
      lines.push(gray("  Paso 2/3: Seleccioná el entorno/agente:"))
      lines.push("")
      for (let i = 0; i < TOOL_OPTIONS.length; i++) {
        const opt = TOOL_OPTIONS[i]
        const cursor = state.cursor === i ? cyan(">") : " "
        if (opt.implemented) {
          const label = state.cursor === i ? bold(opt.label) : opt.label
          lines.push(`  ${cursor} ${label}  ${gray(opt.hint)}`)
        } else {
          lines.push(`  ${cursor} ${gray(opt.label)}  ${yellow(opt.hint)}`)
        }
      }
      lines.push("")
      if (state.message) {
        lines.push(yellow(`  ⓘ ${state.message}`))
        lines.push("")
      }
      lines.push(gray("  ↑/↓ navegar · Enter seleccionar · Esc volver · H inicio"))
    } else if (phase === "preset") {
      const osLabel = state.selectedOS ? getPlatformLabel(state.selectedOS) : "?"
      const toolLabel = state.selectedTool ?? "?"
      lines.push(gray(`  OS: ${green(osLabel)} · Tool: ${green(toolLabel)}`))
      lines.push("")
      renderTargetStatus(lines, state)
      lines.push("")
      lines.push(gray("  Paso 3/3: Elegí un preset o selección manual:"))
      lines.push("")
      const options = getPresetOptions(state.selectedTool)
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]
        const cursor = state.cursor === i ? cyan(">") : " "
        const label = state.cursor === i ? bold(opt.label) : opt.label
        const hint = opt.hint ? gray(`  ${opt.hint}`) : ""
        lines.push(`  ${cursor} ${label}${hint}`)
      }
      lines.push("")
      lines.push(gray("  ↑/↓ navegar · Enter seleccionar · Esc volver · H inicio"))
    } else if (phase === "manual") {
      const osLabel = state.selectedOS ? getPlatformLabel(state.selectedOS) : "?"
      const toolLabel = state.selectedTool ?? "?"
      lines.push(gray(`  OS: ${green(osLabel)} · Tool: ${green(toolLabel)}`))
      lines.push("")
      renderTargetStatus(lines, state)
      lines.push("")
      lines.push(gray("  Seleccioná componentes (space para toggle):"))
      lines.push("")
      for (let i = 0; i < state.statuses.length; i++) {
        const s = state.statuses[i]
        const selected = state.selectedComponents.includes(s.id)
        const check = selected ? green("[selected]") : gray("[ ]")
        const cursor = state.cursor === i ? cyan(">") : " "
        const statusHint = s.status === "installed"
          ? green("instalado (reparar)")
          : s.status === "error"
            ? red(`error`)
            : gray("disponible")
        lines.push(`  ${cursor} ${check} ${s.label}  ${statusHint}`)
      }
      lines.push("")
      if (state.selectedComponents.length === 0) {
        lines.push(gray("  Seleccioná al menos un componente"))
      } else {
        lines.push(gray(`  ${state.selectedComponents.length} seleccionado(s) · Enter confirmar`))
      }
      lines.push(gray("  Space toggle · Esc volver · H inicio"))
    } else {
      // Confirm phase
      const components = state.selectedComponents
      lines.push(bold("  Confirmar instalación:"))
      lines.push("")
      for (const id of components) {
        const status = state.statuses.find(s => s.id === id)
        const label = status?.label ?? id
        lines.push(`  ${green("[selected]")} ${label}`)
      }
      lines.push("")
      if (components.length === 0) {
        lines.push(yellow("  Warning: No components selected"))
      }
      lines.push(gray("  Enter confirmar · Esc volver · H inicio"))
    }

    if (state.message && phase !== "tool-select") {
      lines.push("")
      lines.push(yellow(`  ${state.message}`))
    }

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const phase = getPhase(state)

    switch (key.type) {
      case "up":
        if (phase === "os-select") {
          return {
            state: { ...state, cursor: Math.max(0, state.cursor - 1) },
            intent: { type: "none" },
          }
        } else if (phase === "tool-select") {
          return {
            state: { ...state, cursor: Math.max(0, state.cursor - 1) },
            intent: { type: "none" },
          }
        } else if (phase === "preset") {
          return {
            state: { ...state, cursor: Math.max(0, state.cursor - 1) },
            intent: { type: "none" },
          }
        } else if (phase === "manual") {
          return {
            state: { ...state, cursor: Math.max(0, state.cursor - 1) },
            intent: { type: "none" },
          }
        }
        return { state, intent: { type: "none" } }

      case "down":
        if (phase === "os-select") {
          return {
            state: { ...state, cursor: Math.min(OS_OPTIONS.length - 1, state.cursor + 1) },
            intent: { type: "none" },
          }
        } else if (phase === "tool-select") {
          return {
            state: { ...state, cursor: Math.min(TOOL_OPTIONS.length - 1, state.cursor + 1) },
            intent: { type: "none" },
          }
        } else if (phase === "preset") {
          const options = getPresetOptions(state.selectedTool)
          return {
            state: { ...state, cursor: Math.min(options.length - 1, state.cursor + 1) },
            intent: { type: "none" },
          }
        } else if (phase === "manual") {
          return {
            state: { ...state, cursor: Math.min(state.statuses.length - 1, state.cursor + 1) },
            intent: { type: "none" },
          }
        }
        return { state, intent: { type: "none" } }

      case "enter":
        if (phase === "os-select") {
          const chosen = OS_OPTIONS[state.cursor]
          if (!chosen) return { state, intent: { type: "none" } }
          // OS selected — move to tool-select, set cursor to OpenCode (index 0)
          return {
            state: {
              ...state,
              selectedOS: chosen.value,
              cursor: 0,
              _installPhase: "tool-select",
              message: undefined,
            },
            intent: { type: "none" },
          }
        } else if (phase === "tool-select") {
          const chosen = TOOL_OPTIONS[state.cursor]
          if (!chosen) return { state, intent: { type: "none" } }

          // If tool is not implemented, show info message and stay on phase
          if (!chosen.implemented) {
            return {
              state: {
                ...state,
                message: `${chosen.label} aún no está implementado. Seleccioná OpenCode o Codex para continuar.`,
              },
              intent: { type: "none" },
            }
          }

          // Tool selected — move to preset phase
          return {
            state: {
              ...state,
              selectedTool: chosen.value,
              cursor: 0,
              _installPhase: "preset",
              message: undefined,
            },
            intent: { type: "none" },
          }
        } else if (phase === "preset") {
          const options = getPresetOptions(state.selectedTool)
          const chosen = options[state.cursor]
          if (!chosen) return { state, intent: { type: "none" } }

          if (chosen.value === "manual") {
            // Switch to manual component selection phase
            return {
              state: {
                ...state,
                cursor: 0,
                selectedComponents: [],
                selectedPreset: undefined,
                _installPhase: "manual",
                message: undefined,
              },
              intent: { type: "none" },
            }
          }

          // Preset chosen — set confirm phase and emit intent
          return {
            state: {
              ...state,
              selectedPreset: chosen.value,
              selectedComponents: [],
              cursor: 0,
              _installPhase: "confirm",
              message: undefined,
            },
            intent: { type: "select-preset", preset: chosen.value },
          }
        } else if (phase === "manual") {
          if (state.selectedComponents.length === 0) {
            return {
              state: { ...state, message: "Seleccioná al menos un componente" },
              intent: { type: "none" },
            }
          }
          // Move to confirm phase
          return {
            state: { ...state, cursor: 0, _installPhase: "confirm", message: undefined },
            intent: { type: "none" },
          }
        } else {
          // Confirm phase — start install task
          if (state.selectedComponents.length === 0 && !state.selectedPreset) {
            return {
              state: { ...state, message: "No components selected" },
              intent: { type: "none" },
            }
          }
          return {
            state: { ...state, cursor: 0 },
            intent: { type: "confirm" },
          }
        }

      case "space":
        if (phase === "manual") {
          const comp = state.statuses[state.cursor]
          if (!comp) return { state, intent: { type: "none" } }
          const selected = state.selectedComponents.includes(comp.id)
          const newSelected = selected
            ? state.selectedComponents.filter(id => id !== comp.id)
            : [...state.selectedComponents, comp.id]
          return {
            state: { ...state, selectedComponents: newSelected, message: undefined },
            intent: { type: "none" },
          }
        }
        return { state, intent: { type: "none" } }

      case "back":
        if (phase === "confirm") {
          // If we came from manual, go back to manual; otherwise back to preset
          if (state.selectedPreset) {
            return {
              state: {
                ...state,
                cursor: 0,
                selectedPreset: undefined,
                selectedComponents: [],
                _installPhase: "preset",
                message: undefined,
              },
              intent: { type: "none" },
            }
          }
          // Came from manual — go back to manual
          return {
            state: {
              ...state,
              cursor: 0,
              _installPhase: "manual",
              message: undefined,
            },
            intent: { type: "none" },
          }
        } else if (phase === "manual") {
          // Go back to preset picker
          return {
            state: {
              ...state,
              cursor: 0,
              selectedComponents: [],
              _installPhase: "preset",
              message: undefined,
            },
            intent: { type: "none" },
          }
        } else if (phase === "preset") {
          // Go back to tool-select
          return {
            state: {
              ...state,
              cursor: 0,
              selectedTool: undefined,
              selectedPreset: undefined,
              _installPhase: "tool-select",
              message: undefined,
            },
            intent: { type: "none" },
          }
        } else if (phase === "tool-select") {
          // Go back to os-select
          return {
            state: {
              ...state,
              cursor: 0,
              selectedOS: undefined,
              message: undefined,
              _installPhase: "os-select",
            },
            intent: { type: "none" },
          }
        } else if (phase === "os-select") {
          // In os-select phase, Esc navigates back to home
          return {
            state: { ...state, message: undefined },
            intent: { type: "back" },
          }
        }
        return { state, intent: { type: "none" } }

      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }

      default:
        return { state, intent: { type: "none" } }
    }
  },
}

/** Helper to check if install screen is in manual selection phase */
export function isManualPhase(state: TUIState): boolean {
  return getPhase(state) === "manual"
}
