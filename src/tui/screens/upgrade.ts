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
      lines.push(gray("  Esc volver · H inicio"))
      return lines
    }

    const status = upgrade.status
    if (!status) {
      lines.push(gray("  Sin información de versión"))
      lines.push("")
      lines.push(gray("  Esc volver · H inicio"))
      return lines
    }

    const statuses = status
    const available = statuses.filter(s => s.available)

    for (const tool of statuses) {
      const marker = tool.available ? yellow("[UPDATE]") : tool.error ? red("[WARN]") : green("[OK]")
      const version = tool.error ? `check failed: ${tool.error}` : `${tool.current ?? "unknown"} → ${tool.latest ?? "latest"}`
      lines.push(`  ${marker} ${tool.tool}: ${version}`)
    }

    if (available.length === 0) {
      lines.push("")
      lines.push(green("  [OK] Everything is up to date"))
    } else {
      lines.push("")
      lines.push(yellow(`  [UPDATE] Update available (${available.length})`))

      // Upgrade CTA
      lines.push("")
      const cursor = state.cursor === 0 ? cyan(">") : " "
      lines.push(`  ${cursor} Apply update`)
    }

    lines.push("")
    lines.push(separator())
    lines.push("")
    lines.push(gray("  Esc volver · H inicio"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const upgrade = state.upgrade

    switch (key.type) {
      case "enter": {
        const statuses = upgrade?.status ?? []
        if (statuses.length === 0 || statuses.every(s => !s.available)) {
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
