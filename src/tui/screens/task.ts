// src/tui/screens/task.ts — Task progress screen: progress log, active step, spinner

import type { KeyEvent, ScreenModule, ScreenResult, TaskKind, TUIState } from "../types"
import { cyan, green, red, yellow, bold, gray, separator, pink } from "../theme"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const SPINNER_COLORS = [cyan, pink, cyan, pink, cyan, pink, cyan, pink, cyan, pink]

/** Map TaskKind to display label */
function taskKindLabel(kind: TaskKind | undefined): string {
  switch (kind) {
    case "install": return "INSTALANDO"
    case "uninstall": return "DESINSTALANDO"
    case "doctor-fix": return "DOCTOR FIX"
    case "upgrade": return "UPGRADE"
    default: return "PROCESANDO"
  }
}

export const taskScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const task = state.task
    const label = taskKindLabel(task?.kind)

    lines.push(`  ${bold(cyan(label))}`)
    if (task?.title) {
      lines.push(gray(`  ${task.title}`))
    }
    lines.push(separator())
    lines.push("")

    if (!task) {
      lines.push(gray("  Sin tarea activa"))
      lines.push("")
      lines.push(gray("  Esc volver"))
      return lines
    }

    // Active step
    if (task.step && !task.done) {
      const frame = SPINNER_FRAMES[state.cursor % SPINNER_FRAMES.length]
      const colorFn = SPINNER_COLORS[state.cursor % SPINNER_COLORS.length]
      lines.push(`  ${colorFn(frame)} Procesando: ${bold(task.step)}`)
    }

    if (task.done) {
      lines.push(green("  [OK] Task completed"))
    }

    lines.push("")

    // Log entries
    if (task.log.length > 0) {
      const maxLines = 10
      const visibleLog = task.log.slice(-maxLines)
      for (const entry of visibleLog) {
        lines.push(gray(`  ${entry}`))
      }
    }

    lines.push("")
    lines.push(separator())

    if (task.done) {
      lines.push(gray("  Enter ver resultados · Esc volver"))
    } else {
      lines.push(gray("  Esperando completitud..."))
    }

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    const task = state.task

    // Advance spinner frame on any key or just cycle
    const nextCursor = state.cursor + 1

    switch (key.type) {
      case "enter": {
        if (task?.done) {
          return {
            state: { ...state, cursor: 0 },
            intent: { type: "navigate", route: { id: "results" } },
          }
        }
        return { state: { ...state, cursor: nextCursor }, intent: { type: "none" } }
      }
      case "back": {
        if (task?.done) {
          return {
            state: { ...state, cursor: 0 },
            intent: { type: "back" },
          }
        }
        return { state: { ...state, cursor: nextCursor }, intent: { type: "none" } }
      }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
      default:
        return { state: { ...state, cursor: nextCursor }, intent: { type: "none" } }
    }
  },
}
