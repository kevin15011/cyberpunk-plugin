// src/tui/terminal.ts — Raw terminal mode, key normalization, screen helpers

import type { KeyEvent } from "./types"

let originalRawMode = false

/** Enable raw mode on stdin for key-by-key input */
export function enableRawMode(): void {
  if (!process.stdin.isTTY) return
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()
  originalRawMode = true
}

/** Disable raw mode and restore normal terminal */
export function disableRawMode(): void {
  if (!originalRawMode) return
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(false)
  }
  process.stdin.pause()
  originalRawMode = false
}

/** Normalize a Buffer or string from stdin into a KeyEvent */
export function readKey(data: Buffer | string): KeyEvent {
  const s = typeof data === "string" ? data : data.toString("utf-8")

  if (s === "\r" || s === "\n") return { type: "enter" }
  if (s === "\x7f" || s === "\b") return { type: "back" }
  if (s === " ") return { type: "space" }
  if (s === "\t") return { type: "tab" }
  if (s === "\x03") return { type: "ctrl-c" }
  if (s === "\x1b") return { type: "back" } // bare escape → back action

  // Arrow keys and escape sequences
  if (s === "\x1b[A" || s === "\x1bOA") return { type: "up" }
  if (s === "\x1b[B" || s === "\x1bOB") return { type: "down" }
  if (s === "\x1b[D" || s === "\x1bOD") return { type: "left" as any }
  if (s === "\x1b[C" || s === "\x1bOC") return { type: "right" as any }

  // Regular character
  if (s.length === 1) return { type: "char", ch: s }

  return { type: "unknown" }
}

/** Clear the terminal screen */
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H")
}

/** Write lines to stdout, joining with newlines */
export function writeLines(lines: string[]): void {
  process.stdout.write(lines.join("\n") + "\n")
}

/** Hide terminal cursor */
export function hideCursor(): void {
  process.stdout.write("\x1b[?25l")
}

/** Show terminal cursor */
export function showCursor(): void {
  process.stdout.write("\x1b[?25h")
}
