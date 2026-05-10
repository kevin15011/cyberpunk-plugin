// src/tui/screens/home.ts — Home menu screen: install, uninstall, status, quit

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { route } from "../router"
import { BANNER, cyan, yellow, bold, gray } from "../theme"

const MENU_ITEMS = [
  { id: "install" as const, label: "Instalar componentes", hint: "Seleccionar qué instalar" },
  { id: "uninstall" as const, label: "Desinstalar componentes", hint: "Seleccionar qué remover" },
  { id: "status" as const, label: "Ver estado", hint: "Mostrar estado actual" },
  { id: "doctor" as const, label: "Doctor", hint: "Diagnosticar problemas" },
  { id: "upgrade" as const, label: "Upgrade", hint: "Verificar actualizaciones" },
  { id: "quit" as const, label: "Salir", hint: "" },
] as const

type MenuAction = typeof MENU_ITEMS[number]["id"]

export const homeScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    lines.push(BANNER)
    lines.push("")

    const pendingUpdates = state.upgrade?.status?.filter(status => status.available).length ?? 0

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i]
      const cursor = state.cursor === i ? cyan(">") : " "
      const hasUpgradeBadge = item.id === "upgrade" && pendingUpdates > 0
      const baseLabel = hasUpgradeBadge ? `${item.label} ${yellow("✦")}` : item.label
      const label = state.cursor === i ? bold(baseLabel) : baseLabel
      const hintText = hasUpgradeBadge
        ? `${pendingUpdates} actualización${pendingUpdates === 1 ? "" : "es"} pendiente${pendingUpdates === 1 ? "" : "s"}`
        : item.hint
      const hint = hintText ? gray(`  ${hintText}`) : ""
      lines.push(`  ${cursor} ${label}${hint}`)
    }

    lines.push("")
    lines.push(gray("  ↑/↓ navegar · Enter seleccionar · Esc salir"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    switch (key.type) {
      case "up":
        return {
          state: { ...state, cursor: Math.max(0, state.cursor - 1) },
          intent: { type: "none" },
        }
      case "down":
        return {
          state: { ...state, cursor: Math.min(MENU_ITEMS.length - 1, state.cursor + 1) },
          intent: { type: "none" },
        }
      case "enter": {
        const action = MENU_ITEMS[state.cursor]?.id
        if (!action) return { state, intent: { type: "none" } }

        if (action === "quit") {
          return { state: { ...state, quit: true }, intent: { type: "quit" } }
        }

        return {
          state: { ...state, cursor: 0, selectedComponents: [] },
          intent: { type: "navigate", route: route(action) },
        }
      }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
