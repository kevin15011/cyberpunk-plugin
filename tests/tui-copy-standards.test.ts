import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

const TUI_DIR = new URL("../src/tui", import.meta.url).pathname
const DISALLOWED_SYMBOLS = /[✓✗○◉❯⚠]/u

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectSourceFiles(path))
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path)
  }
  return files
}

describe("TUI copy standards", () => {
  test("uses professional ASCII labels instead of emoticon-like symbols", () => {
    const offenders = collectSourceFiles(TUI_DIR).flatMap(file => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/)
      return lines.flatMap((line, index) =>
        DISALLOWED_SYMBOLS.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : []
      )
    })

    expect(offenders).toEqual([])
  })
})
