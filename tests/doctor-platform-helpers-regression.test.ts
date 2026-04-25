// tests/doctor-platform-helpers-regression.test.ts
// RED: Regression tests for critical verify findings:
//   1. doctor.ts must NOT use raw HOME fallback (process.env.HOME || process.env.USERPROFILE || "~")
//   2. doctor.ts must NOT use direct execSync("which ...") for command lookups
//   3. Repo root must NOT contain a literal ~/ directory artifact

import { describe, test, expect } from "bun:test"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const REPO_ROOT = join(import.meta.dir, "..")
const DOCTOR_SOURCE = join(REPO_ROOT, "src", "commands", "doctor.ts")

describe("doctor.ts platform helper regression guard", () => {
  const source = readFileSync(DOCTOR_SOURCE, "utf8")

  test("doctor source has no raw HOME fallback pattern (HOME || USERPROFILE || literal tilde)", () => {
    // The raw pattern that was causing literal ~/ artifacts and Windows breakage
    const rawHomePattern = /process\.env\.HOME\s*\|\|\s*process\.env\.USERPROFILE\s*\|\|\s*["']~["']/g
    const matches = source.match(rawHomePattern)
    expect(matches).toBeNull()
  })

  test("doctor source has no direct execSync which calls", () => {
    // Must use isCommandOnPath() from platform/shell instead
    const directWhichPattern = /execSync\(\s*["']which\s/g
    const matches = source.match(directWhichPattern)
    expect(matches).toBeNull()
  })

  test("doctor source imports getHomeDirAuto from platform/paths", () => {
    expect(source).toContain("getHomeDirAuto")
    expect(source).toMatch(/import.*getHomeDirAuto.*from.*["']\.\.\/platform\/paths["']/)
  })

  test("doctor source imports isCommandOnPath from platform/shell", () => {
    expect(source).toContain("isCommandOnPath")
    expect(source).toMatch(/import.*isCommandOnPath.*from.*["']\.\.\/platform\/shell["']/)
  })
})

describe("repo root literal-home artifact guard", () => {
  test("repo root does not contain a literal tilde ~/ directory", () => {
    const literalTildeDir = join(REPO_ROOT, "~")
    expect(existsSync(literalTildeDir)).toBe(false)
  })
})
