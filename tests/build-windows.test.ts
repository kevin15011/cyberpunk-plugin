import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { resolveOutfile, parseBuildArgs } from "../src/build/config"

describe("build platform configuration", () => {
  describe("resolveOutfile", () => {
    test("default (undefined) produces ./cyberpunk — Linux/macOS unchanged", () => {
      expect(resolveOutfile()).toBe("./cyberpunk")
    })

    test("linux produces ./cyberpunk — unchanged", () => {
      expect(resolveOutfile("linux")).toBe("./cyberpunk")
    })

    test("darwin produces ./cyberpunk — unchanged", () => {
      expect(resolveOutfile("darwin")).toBe("./cyberpunk")
    })

    test("windows produces ./cyberpunk.exe", () => {
      expect(resolveOutfile("windows")).toBe("./cyberpunk.exe")
    })
  })

  describe("parseBuildArgs", () => {
    test("no args returns empty targetPlatform", () => {
      expect(parseBuildArgs([])).toEqual({})
    })

    test("--target-platform windows returns windows", () => {
      expect(parseBuildArgs(["--target-platform", "windows"])).toEqual({ targetPlatform: "windows" })
    })

    test("--target-platform linux returns linux", () => {
      expect(parseBuildArgs(["--target-platform", "linux"])).toEqual({ targetPlatform: "linux" })
    })

    test("--target-platform darwin returns darwin", () => {
      expect(parseBuildArgs(["--target-platform", "darwin"])).toEqual({ targetPlatform: "darwin" })
    })

    test("invalid platform throws with descriptive message", () => {
      expect(() => parseBuildArgs(["--target-platform", "freebsd"])).toThrow(/--target-platform requires one of/)
    })

    test("missing value throws with descriptive message", () => {
      expect(() => parseBuildArgs(["--target-platform"])).toThrow(/--target-platform requires one of/)
    })

    test("ignores unrelated flags", () => {
      expect(parseBuildArgs(["--verbose", "--other"])).toEqual({})
    })
  })

  describe("build.ts integration", () => {
    const buildTs = readFileSync(new URL("../build.ts", import.meta.url), "utf8")

    test("build.ts imports resolveOutfile and parseBuildArgs", () => {
      expect(buildTs).toContain("resolveOutfile")
      expect(buildTs).toContain("parseBuildArgs")
    })

    test("build.ts wires targetPlatform to resolveOutfile", () => {
      expect(buildTs).toContain("targetPlatform")
      expect(buildTs).toMatch(/resolveOutfile\(targetPlatform\)/)
    })
  })
})
