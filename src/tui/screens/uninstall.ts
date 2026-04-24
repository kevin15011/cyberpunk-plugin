// src/tui/screens/uninstall.ts — Uninstall screen: installed components with toggle, confirmation

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { cyan, green, red, yellow, bold, gray, separator } from "../theme"

export const uninstallScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const installed = state.statuses.filter(s => s.status === "installed")

    lines.push(`  ${bold(cyan("DESINSTALAR COMPONENTES"))}`)
    lines.push(separator())
    lines.push("")

    if (installed.length === 0) {
      lines.push(gray("  No hay componentes instalados"))
      lines.push("")
      lines.push(gray("  Esc volver al inicio"))
      return lines
    }

    lines.push(gray("  Seleccioná componentes para desinstalar (space para toggle):"))
    lines.push("")

    for (let i = 0; i < installed.length; i++) {
      const s = installed[i]
      const selected = state.selectedComponents.includes(s.id)
      const check = selected ? green("◉") : gray("○")
      const cursor = state.cursor === i ? cyan("❯") : " "
      lines.push(`  ${cursor} ${check} ${s.label}`)
    }

    lines.push("")
    if (state.selectedComponents.length === 0) {
      lines.push(gray("  Seleccioná al menos un componente"))
    } else {
      lines.push(gray(`  ${state.selectedComponents.length} seleccionado(s) · Enter confirmar`))
    }
    lines.push(gray("  Space toggle · Esc volver"))

    if (state.message) {
      lines.push("")
      lines.push(yellow(`  ${state.message}`))
    }

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const installed = state.statuses.filter(s => s.status === "installed")

    switch (key.type) {
      case "up":
        return {
          state: { ...state, cursor: Math.max(0, state.cursor - 1) },
          intent: { type: "none" },
        }
      case "down":
        return {
          state: { ...state, cursor: Math.min(installed.length - 1, state.cursor + 1) },
          intent: { type: "none" },
        }
      case "space": {
        if (installed.length === 0) return { state, intent: { type: "none" } }
        const comp = installed[state.cursor]
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
      case "enter": {
        if (state.selectedComponents.length === 0) {
          return {
            state: { ...state, message: "Seleccioná al menos un componente" },
            intent: { type: "none" },
          }
        }
        return {
          state: { ...state, cursor: 0 },
          intent: { type: "confirm" },
        }
      }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
