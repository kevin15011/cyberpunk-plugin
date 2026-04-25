// src/tui/screens/results.ts — Results screen: render result summary rows based on TaskKind

import type { KeyEvent, ScreenModule, ScreenResult, TaskKind, TUIState } from "../types"
import { route } from "../router"
import { cyan, green, red, yellow, bold, gray, separator } from "../theme"
import { COMPONENT_LABELS } from "../../config/schema"

/** Map TaskKind to results header label */
function resultsHeader(kind: TaskKind | undefined): string {
  switch (kind) {
    case "doctor-fix": return "RESULTADOS DOCTOR"
    case "upgrade": return "RESULTADOS UPGRADE"
    default: return "RESULTADOS"
  }
}

export const resultsScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const results = state.lastResults ?? []
    const resultKind = state.resultView?.kind

    lines.push(`  ${bold(cyan(resultsHeader(resultKind)))}`)
    lines.push(separator())
    lines.push("")

    if (results.length === 0) {
      // For doctor-fix, show fix results from the report
      if (resultKind === "doctor-fix" && state.doctor?.report) {
        const report = state.doctor.report
        for (const fix of report.fixes) {
          const icon = fix.status === "fixed" ? green("[FIXED]")
            : fix.status === "failed" ? red("[FAILED]")
              : yellow("[SKIPPED]")
          lines.push(`  ${icon} ${fix.checkId}: ${fix.message}`)
        }
        const s = report.summary
        lines.push("")
        lines.push(`  ${green(`${s.healthy} ok`)}  ${yellow(`${s.warnings} warn`)}  ${red(`${s.failures} fail`)}  ${green(`${s.fixed} fixed`)}`)
      } else {
        lines.push(gray("  Sin resultados"))
      }
    } else {
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        const label = COMPONENT_LABELS[r.component as keyof typeof COMPONENT_LABELS] || r.component
        const cursor = state.cursor === i ? cyan(">") : " "

        // Determine action label based on result kind
        const actionLabel = resultKind === "upgrade" ? "Actualizado"
          : resultKind === "doctor-fix" ? "Reparado"
          : r.action === "install" ? "Instalado"
          : "Desinstalado"

        const statusIcon = r.status === "success" ? green("[OK]")
          : r.status === "error" ? red("[ERROR]")
            : yellow("[SKIPPED]")

        const statusText = r.status === "success" ? green(`${actionLabel} correctamente`)
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
          state: { ...state, cursor: Math.min(Math.max(results.length - 1, 0), state.cursor + 1) },
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
