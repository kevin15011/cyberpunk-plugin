// src/tui/screens/doctor.ts — Doctor screen: summary view, fix CTA, two-step confirmation

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import { cyan, green, red, yellow, bold, gray, separator } from "../theme"

export const doctorScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const doctor = state.doctor

    lines.push(`  ${bold(cyan("DOCTOR"))}`)
    lines.push(separator())
    lines.push("")

    if (!doctor || doctor.loading) {
      lines.push(gray("  Cargando diagnóstico..."))
      lines.push("")
      lines.push(gray("  Esc volver"))
      return lines
    }

    const report = doctor.report
    if (!report) {
      lines.push(gray("  Sin datos de doctor"))
      lines.push("")
      lines.push(gray("  Esc volver"))
      return lines
    }

    // Group checks by component
    const grouped = new Map<string, typeof report.checks>()
    for (const check of report.checks) {
      const group = check.detail?.group ?? check.id.split(":")[0] ?? "general"
      if (!grouped.has(group)) grouped.set(group, [])
      grouped.get(group)!.push(check)
    }

    for (const [group, checks] of grouped) {
      lines.push(`  ${bold(group)}`)
      for (const check of checks) {
        const icon = check.status === "pass" ? green("✓")
          : check.status === "fail" ? red("✗")
          : yellow("⚠")
        const label = check.label || check.id
        lines.push(`    ${icon} ${label}: ${check.message}`)
      }
      lines.push("")
    }

    // Summary
    const s = report.summary
    lines.push(`  ${green(`${s.healthy} ok`)}  ${yellow(`${s.warnings} warn`)}  ${red(`${s.failures} fail`)}`)
    lines.push("")

    // Fix CTA if there are fixable failures
    const hasFixable = report.checks.some(c => c.status === "fail" && c.fixable)

    if (hasFixable) {
      if (doctor.confirmFix) {
        lines.push(yellow(`  ❯ Aplicar reparaciones? Enter=confirmar / Esc=cancelar`))
      } else {
        const cursor = state.cursor === 0 ? cyan("❯") : " "
        lines.push(`  ${cursor} Reparar problemas detectados`)
      }
    }

    lines.push("")
    lines.push(separator())
    lines.push("")
    lines.push(gray("  Esc volver"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const doctor = state.doctor

    switch (key.type) {
      case "enter": {
        if (!doctor || !doctor.report) return { state, intent: { type: "none" } }

        const hasFixable = doctor.report.checks.some(c => c.status === "fail" && c.fixable)

        if (hasFixable && !doctor.confirmFix) {
          // First Enter: enter confirm state (no fix yet)
          return {
            state: {
              ...state,
              doctor: { ...doctor, confirmFix: true },
            },
            intent: { type: "none" },
          }
        }

        if (hasFixable && doctor.confirmFix) {
          // Second Enter: fire the fix intent
          return {
            state: {
              ...state,
              doctor: { ...doctor, confirmFix: false },
            },
            intent: { type: "run-doctor-fix" },
          }
        }

        return { state, intent: { type: "none" } }
      }
      case "back": {
        // Clear confirm state on back
        if (doctor?.confirmFix) {
          return {
            state: {
              ...state,
              doctor: { ...doctor, confirmFix: false },
            },
            intent: { type: "back" },
          }
        }
        return { state, intent: { type: "back" } }
      }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state, intent: { type: "none" } }
    }
  },
}
