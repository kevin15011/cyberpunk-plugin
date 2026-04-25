// tests/parse-args-target.test.ts — tests for --target, --profile, --mode CLI flags

import { describe, test, expect } from "bun:test"
import { parseArgs } from "../src/cli/parse-args"

describe("parseArgs: --target flag", () => {
  test("--target opencode parsed", () => {
    const result = parseArgs(["install", "--target", "opencode"])
    expect(result.target).toBe("opencode")
    expect(result.parseErrors).toEqual([])
  })

  test("--target claude parsed", () => {
    const result = parseArgs(["install", "--target", "claude"])
    expect(result.target).toBe("claude")
    expect(result.parseErrors).toEqual([])
  })

  test("--target codex parsed", () => {
    const result = parseArgs(["install", "--target", "codex"])
    expect(result.target).toBe("codex")
    expect(result.parseErrors).toEqual([])
  })

  test("--target with unknown value produces parse error and keeps default", () => {
    const result = parseArgs(["install", "--target", "unknown"])
    expect(result.target).toBe("opencode")
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.parseErrors[0]).toMatch(/--target/)
  })

  test("--target without value produces parse error and keeps default", () => {
    const result = parseArgs(["install", "--target"])
    expect(result.target).toBe("opencode")
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("no --target defaults to opencode", () => {
    const result = parseArgs(["install", "--plugin"])
    expect(result.target).toBe("opencode")
  })

  test("no args at all defaults target to opencode", () => {
    const result = parseArgs([])
    expect(result.target).toBe("opencode")
  })
})

describe("parseArgs: --profile flag", () => {
  test("--profile non-technical parsed", () => {
    const result = parseArgs(["install", "--profile", "non-technical"])
    expect(result.profile).toBe("non-technical")
    expect(result.parseErrors).toEqual([])
  })

  test("--profile developer parsed", () => {
    const result = parseArgs(["install", "--profile", "developer"])
    expect(result.profile).toBe("developer")
    expect(result.parseErrors).toEqual([])
  })

  test("--profile admin parsed", () => {
    const result = parseArgs(["install", "--profile", "admin"])
    expect(result.profile).toBe("admin")
    expect(result.parseErrors).toEqual([])
  })

  test("--profile with unknown value produces parse error", () => {
    const result = parseArgs(["install", "--profile", "expert"])
    expect(result.profile).toBeUndefined()
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.parseErrors[0]).toMatch(/--profile/)
  })

  test("--profile without value produces parse error", () => {
    const result = parseArgs(["install", "--profile"])
    expect(result.profile).toBeUndefined()
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("no --profile leaves profile undefined", () => {
    const result = parseArgs(["install", "--plugin"])
    expect(result.profile).toBeUndefined()
  })
})

describe("parseArgs: --mode flag", () => {
  test("--mode guided parsed", () => {
    const result = parseArgs(["--mode", "guided"])
    expect(result.mode).toBe("guided")
    expect(result.parseErrors).toEqual([])
  })

  test("--mode advanced parsed", () => {
    const result = parseArgs(["--mode", "advanced"])
    expect(result.mode).toBe("advanced")
    expect(result.parseErrors).toEqual([])
  })

  test("--mode with unknown value produces parse error", () => {
    const result = parseArgs(["install", "--mode", "auto"])
    expect(result.mode).toBeUndefined()
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.parseErrors[0]).toMatch(/--mode/)
  })

  test("--mode without value produces parse error", () => {
    const result = parseArgs(["install", "--mode"])
    expect(result.mode).toBeUndefined()
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })

  test("no --mode leaves mode undefined", () => {
    const result = parseArgs(["install", "--plugin"])
    expect(result.mode).toBeUndefined()
  })
})

describe("parseArgs: combined new flags", () => {
  test("--target claude --profile admin together", () => {
    const result = parseArgs(["install", "--target", "claude", "--profile", "admin"])
    expect(result.target).toBe("claude")
    expect(result.profile).toBe("admin")
    expect(result.parseErrors).toEqual([])
  })

  test("--target opencode --mode advanced together", () => {
    const result = parseArgs(["install", "--target", "opencode", "--mode", "advanced"])
    expect(result.target).toBe("opencode")
    expect(result.mode).toBe("advanced")
    expect(result.parseErrors).toEqual([])
  })

  test("--target claude with --check for dry-run", () => {
    const result = parseArgs(["install", "--target", "claude", "--check"])
    expect(result.target).toBe("claude")
    expect(result.flags.check).toBe(true)
    expect(result.parseErrors).toEqual([])
  })

  test("all three new flags together", () => {
    const result = parseArgs(["install", "--target", "claude", "--profile", "developer", "--mode", "guided"])
    expect(result.target).toBe("claude")
    expect(result.profile).toBe("developer")
    expect(result.mode).toBe("guided")
    expect(result.parseErrors).toEqual([])
  })

  test("legacy flags still work with new flags", () => {
    const result = parseArgs(["install", "--target", "opencode", "--plugin", "--json", "--verbose"])
    expect(result.target).toBe("opencode")
    expect(result.components).toEqual(["plugin"])
    expect(result.flags.json).toBe(true)
    expect(result.flags.verbose).toBe(true)
    expect(result.parseErrors).toEqual([])
  })
})
