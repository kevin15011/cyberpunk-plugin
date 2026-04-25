import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "fs"

const scriptPath = new URL("../install.ps1", import.meta.url).pathname

describe("install.ps1 Windows installer", () => {
  test("script file exists", () => {
    expect(existsSync(scriptPath)).toBe(true)
  })

  describe("required content checks", () => {
    const content = existsSync(scriptPath) ? readFileSync(scriptPath, "utf8") : ""

    test("contains GitHub release URL for binary download", () => {
      // The script uses $Repo variable; verify the repo identifier and URL template
      expect(content).toMatch(/kevin15011\/cyberpunk-plugin/)
      expect(content).toMatch(/github\.com.*releases.*download/i)
    })

    test("contains PATH guidance for Windows users", () => {
      expect(content).toMatch(/PATH/)
    })

    test("references Windows install directory", () => {
      // PowerShell uses Join-Path with ".local" and "bin" args
      expect(content).toMatch(/\.local/)
      expect(content).toMatch(/\bbin\b/)
    })

    test("contains execution policy check before proceeding", () => {
      expect(content).toMatch(/Get-ExecutionPolicy|ExecutionPolicy/i)
    })

    test("contains safe failure remediation on download error", () => {
      expect(content).toMatch(/ERROR.*download|download.*fail/i)
      expect(content).toMatch(/Remediation|Alternative/)
    })

    test("error paths exit with non-zero code", () => {
      const errorExits = content.match(/exit 1/g) || []
      expect(errorExits.length).toBeGreaterThan(0)
    })

    test("does not claim success when steps fail", () => {
      const lines = content.split("\n")
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/>> ERROR/i)) {
          const block = lines.slice(i, Math.min(i + 12, lines.length)).join("\n")
          expect(block).toMatch(/Remediation|Alternative/)
          expect(block).not.toMatch(/\binstall complete\b|\bsuccessfully installed\b/i)
        }
      }
    })
  })
})
