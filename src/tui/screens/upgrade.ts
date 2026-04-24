// src/tui/screens/upgrade.ts — Upgrade screen: version status, upgrade CTA

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { cyan, green, red, yellow, bold, gray, separator } from "../theme"

export const upgradeScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const upgrade = state.upgrade

    lines.push(`  ${bold(cyan("UPGRADE"))}`)
    lines.push(separator())
    lines.push("")

    if (!upgrade || upgrade.loading) {
      lines.push(gray("  Verificando versión..."))
      lines.push("")
      lines.push(gray("  Esc volver"))
      return lines
    }

    const status = upgrade.status
    if (!status) {
      lines.push(gray("  Sin información de versión"))
      lines.push("")
      lines.push(gray("  Esc volver"))
      return lines
    }

    // Version info
    lines.push(`  Versión actual: ${bold(status.currentVersion)}`)
    lines.push(`  Última versión: ${bold(status.latestVersion)}`)

    if (status.upToDate) {
      lines.push("")
      lines.push(green("  ✓ Todo actualizado"))
    } else {
      lines.push("")
      lines.push(yellow("  ⚠ Actualización disponible"))

      if (status.changedFiles.length > 0) {
        lines.push(gray(`  Archivos modificados: ${status.changedFiles.length}`))
      }

      // Upgrade CTA
      lines.push("")
      const cursor = state.cursor === 0 ? cyan("❯") : " "
      lines.push(`  ${cursor} Aplicar actualización`)
    }

    lines.push("")
    lines.push(separator())
    lines.push("")
    lines.push(gray("  Esc volver"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const upgrade = state.upgrade

    switch (key.type) {
      case "enter": {
        if (!upgrade?.status || upgrade.status.upToDate) {
          return { state, intent: { type: "none" } }
        }
        return { state, intent: { type: "run-upgrade" } }
      }
      case "back":
        return { state, intent: { type: "back" } }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
