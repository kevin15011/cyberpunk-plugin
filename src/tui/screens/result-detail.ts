// src/tui/screens/result-detail.ts — Single component result detail, back returns to results

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { route } from "../router"
import { cyan, green, red, yellow, bold, gray, separator } from "../theme"
import { COMPONENT_LABELS } from "../../config/schema"

export const resultDetailScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const results = state.lastResults ?? []
    const idx = state.route.params?.resultIndex ?? 0
    const r = results[idx]

    lines.push(`  ${bold(cyan("DETALLE DE RESULTADO"))}`)
    lines.push(separator())
    lines.push("")

    if (!r) {
      lines.push(gray("  Sin resultado para este índice"))
    } else {
      const label = COMPONENT_LABELS[r.component] || r.component
      const action = r.action === "install" ? "Instalación" : "Desinstalación"

      lines.push(`  ${bold("Componente:")}${label}`)
      lines.push(`  ${bold("Acción:")}${action}`)

      const statusText = r.status === "success" ? green("✓ Exitoso")
        : r.status === "error" ? red("✗ Error")
        : yellow("○ Sin cambios")
      lines.push(`  ${bold("Estado:")}${statusText}`)

      if (r.message) {
        lines.push(`  ${bold("Mensaje:")}${r.message}`)
      }
      if (r.path) {
        lines.push(`  ${bold("Path:")}${gray(r.path)}`)
      }
    }

    lines.push("")
    lines.push(separator())
    lines.push("")
    lines.push(gray("  Esc volver a resultados"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    switch (key.type) {
      case "enter":
      case "back":
        return {
          state: { ...state, cursor: state.route.params?.resultIndex ?? 0 },
          intent: { type: "back" }, // pop back to results instead of pushing new route
        }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
