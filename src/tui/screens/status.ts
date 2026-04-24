// src/tui/screens/status.ts — Status screen: render collectStatus() results, back to home

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { cyan, green, red, bold, gray, separator } from "../theme"

export const statusScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []

    lines.push(`  ${bold(cyan("ESTADO DE COMPONENTES"))}`)
    lines.push(separator())
    lines.push("")

    for (const s of state.statuses) {
      const icon = s.status === "installed" ? green("✓")
        : s.status === "error" ? red("✗")
        : cyan("○")
      const statusText = s.status === "installed"
        ? green("instalado")
        : s.status === "error"
          ? red(`error: ${s.error ?? "unknown"}`)
          : gray("disponible")
      lines.push(`  ${icon} ${s.label}  ${statusText}`)
    }

    lines.push("")
    lines.push(separator())
    lines.push("")
    lines.push(gray("  Esc volver al inicio"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    switch (key.type) {
      case "enter":
      case "back":
        return {
          state: { ...state, cursor: 0 },
          intent: { type: "back" },
        }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
