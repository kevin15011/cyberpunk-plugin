// src/tui/screens/results.ts — Results screen: render InstallResult[] summary rows, open result-detail

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { route } from "../router"
import { cyan, green, red, yellow, bold, gray, separator } from "../theme"
import { COMPONENT_LABELS } from "../../config/schema"

export const resultsScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const results = state.lastResults ?? []

    lines.push(`  ${bold(cyan("RESULTADOS"))}`)
    lines.push(separator())
    lines.push("")

    if (results.length === 0) {
      lines.push(gray("  Sin resultados"))
    } else {
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        const label = COMPONENT_LABELS[r.component] || r.component
        const cursor = state.cursor === i ? cyan("❯") : " "
        const action = r.action === "install" ? "Instalado" : "Desinstalado"

        const statusIcon = r.status === "success" ? green("✓")
          : r.status === "error" ? red("✗")
          : yellow("○")

        const statusText = r.status === "success" ? green(`${action} correctamente`)
          : r.status === "error" ? red(`error: ${r.message ?? "unknown"}`)
          : yellow("sin cambios")

        lines.push(`  ${cursor} ${statusIcon} ${label}  ${statusText}`)
      }
    }

    lines.push("")
    lines.push(separator())
    lines.push("")
    lines.push(gray("  ↑/↓ navegar · Enter ver detalle · Esc volver al inicio"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const results = state.lastResults ?? []

    switch (key.type) {
      case "up":
        return {
          state: { ...state, cursor: Math.max(0, state.cursor - 1) },
          intent: { type: "none" },
        }
      case "down":
        return {
          state: { ...state, cursor: Math.min(results.length - 1, state.cursor + 1) },
          intent: { type: "none" },
        }
      case "enter": {
        if (results.length === 0) return { state, intent: { type: "none" } }
        return {
          state: { ...state, cursor: 0 },
          intent: {
            type: "navigate",
            route: route("result-detail", { resultIndex: state.cursor }),
          },
        }
      }
      case "back":
        // Navigate back to home/shell
        return {
          state: { ...state, cursor: 0, message: undefined },
          intent: { type: "back" },
        }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
