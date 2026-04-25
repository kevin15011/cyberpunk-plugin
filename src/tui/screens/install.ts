// src/tui/screens/install.ts — Install screen: component list with toggle, preset picker, confirmation

import type { KeyEvent, ScreenModule, ScreenResult, TUIState, InstallPhase } from "../types"
import { route } from "../router"
import { cyan, green, red, yellow, bold, gray, separator, pink } from "../theme"
import { PRESET_NAMES } from "../../presets"
import type { ComponentId } from "../../components/types"

/** Determine the current install phase from explicit state tracking */
function getPhase(state: TUIState): InstallPhase {
  if (state.route.id !== "install") return "preset"
  if (state._installPhase === "manual") return "manual"
  if (state._installPhase === "confirm") return "confirm"
  // Default: if a preset was chosen, go to confirm; otherwise show preset picker
  if (state.selectedPreset) return "confirm"
  if (state.selectedComponents.length > 0) return "confirm"
  return "preset"
}

function getPresetOptions() {
  return [
    ...PRESET_NAMES.map(p => ({ value: p.value, label: p.label, hint: p.hint })),
    { value: "manual", label: "Selección manual", hint: "Elegir componentes individualmente" },
  ]
}

export const installScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const phase = getPhase(state)
    const headerText = bold(cyan("INSTALAR COMPONENTES"))
    lines.push(`  ${headerText}`)
    lines.push(separator())
    lines.push("")

    if (phase === "preset") {
      lines.push(gray("  Elegí un preset o selección manual:"))
      lines.push("")
      const options = getPresetOptions()
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]
        const cursor = state.cursor === i ? cyan(">") : " "
        const label = state.cursor === i ? bold(opt.label) : opt.label
        const hint = opt.hint ? gray(`  ${opt.hint}`) : ""
        lines.push(`  ${cursor} ${label}${hint}`)
      }
      lines.push("")
      lines.push(gray("  ↑/↓ navegar · Enter seleccionar · Esc volver"))
    } else if (phase === "manual") {
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
      lines.push(gray("  Space toggle · Esc volver"))
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
      lines.push(gray("  Enter confirmar · Esc volver"))
    }

    if (state.message) {
      lines.push("")
      lines.push(yellow(`  ${state.message}`))
    }

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const phase = getPhase(state)

    switch (key.type) {
      case "up":
        if (phase === "preset") {
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
        if (phase === "preset") {
          const options = getPresetOptions()
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
        if (phase === "preset") {
          const options = getPresetOptions()
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
            state: { ...state, cursor: 0, _installPhase: "confirm" },
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
            // Came from preset selection — go back to preset
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
        }
        // In preset phase, Esc navigates back to home
        return {
          state: { ...state, message: undefined },
          intent: { type: "back" },
        }

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
