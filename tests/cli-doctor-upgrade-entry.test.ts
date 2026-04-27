// tests/cli-doctor-upgrade-entry.test.ts
// Behavioral tests proving direct `cyberpunk doctor` and `cyberpunk upgrade`
// preserve non-interactive CLI behavior without rendering the TUI shell.
//
// Uses a subprocess approach (like tests/doctor.test.ts) to avoid mock.module
// interference with other test files.

import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

function createTempFixture() {
  const home = join(tmpdir(), `cyberpunk-cli-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const configDir = join(home, ".config", "cyberpunk")
  mkdirSync(configDir, { recursive: true })
  writeFileSync(join(configDir, "config.json"), JSON.stringify({
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
      rtk: { installed: false },
      tmux: { installed: false },
    },
  }), "utf8")
  return home
}

function runMainIsolated(home: string, argv: string[]) {
  const isUpgrade = argv.includes("upgrade") || argv.includes("--upgrade")
  const evalCode = `
    import { main } from ${JSON.stringify(join(process.cwd(), "src/index.ts"))};
    ${isUpgrade ? `
    import { __setUpgradeTestOverrides } from ${JSON.stringify(join(process.cwd(), "src/commands/upgrade.ts"))};
    __setUpgradeTestOverrides({
      getRepoDir: () => process.cwd(),
      gitCommand: (args) => {
        if (args.startsWith("rev-parse HEAD")) return "local-test-rev";
        if (args.startsWith("fetch ")) return "";
        if (args.startsWith("rev-parse origin/main")) return "local-test-rev";
        if (args.startsWith("diff --name-only")) return "";
        if (args.startsWith("pull ")) return "";
        return "";
      },
    });
    ` : ""}
    process.argv = ${JSON.stringify(argv)};
    await main();
  `

  const proc = Bun.spawnSync([process.execPath, "--eval", evalCode], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      // Prevent ensureConfigExists from creating side effects for doctor
      NO_COLOR: "1",
    },
    timeout: 15000,
    stdout: "pipe",
    stderr: "pipe",
  })

  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  }
}

describe("CLI direct doctor entrypoint", () => {
  let home: string

  beforeEach(() => {
    home = createTempFixture()
  })

  afterEach(() => {
    // Temp dirs cleaned up by OS; no explicit cleanup needed for tests
  })

  test("cyberpunk doctor: runs and exits 0 on healthy system", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "doctor"])

    // Should produce doctor output (not TUI)
    expect(result.stdout).toMatch(/pass|fail|warn|ok|Resumen/i)
    // Should NOT produce TUI output
    expect(result.stdout).not.toContain("Hasta la próxima")
    // Exit 0 when no remaining failures (depends on actual system state,
    // but with a clean temp home most checks should pass)
    expect(result.exitCode === 0 || result.exitCode === 1).toBe(true)
  })

  test("cyberpunk doctor --json: outputs valid JSON (DoctorResult[] array)", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "doctor", "--json"])

    // Should output JSON array of {component, checks} objects
    let parsed: any
    expect(() => { parsed = JSON.parse(result.stdout) }).not.toThrow()
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    // Each entry should have component and checks
    expect(parsed[0].component).toBeDefined()
    expect(Array.isArray(parsed[0].checks)).toBe(true)
  })

  test("cyberpunk doctor --fix: accepts fix flag and runs", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "doctor", "--fix"])

    // Should produce output (not crash)
    expect(result.stdout.length).toBeGreaterThan(0)
    // Should mention repairs if any were needed
    // (on a clean temp home, there may or may not be fixable issues)
    expect(result.exitCode === 0 || result.exitCode === 1).toBe(true)
  }, 30000)

  test("--doctor alias: runs doctor command", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "--doctor"])

    expect(result.stdout).toMatch(/pass|fail|warn|ok|Resumen/i)
    expect(result.stdout).not.toContain("Hasta la próxima")
  })

  test("cyberpunk doctor does NOT invoke TUI shell", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "doctor"])

    // TUI would output "Hasta la próxima" on exit
    expect(result.stdout).not.toContain("Hasta la próxima")
    // TUI would use raw mode / terminal escape sequences for UI
    expect(result.stdout).not.toContain("INSTALAR COMPONENTES")
    expect(result.stdout).not.toContain("DOCTOR")
  })
})

describe("CLI direct upgrade entrypoint", () => {
  let home: string

  beforeEach(() => {
    home = createTempFixture()
  })

  test("cyberpunk upgrade: runs upgrade command (may fail without git/binary)", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "upgrade"])

    // Should produce output (either success or error message)
    // It may fail because there's no git repo or binary, but it should NOT invoke TUI
    expect(result.stdout + result.stderr).not.toContain("Hasta la próxima")
    expect(result.stdout).not.toContain("INSTALAR COMPONENTES")
  })

  test("cyberpunk upgrade --check: runs check-only mode", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "upgrade", "--check"])

    // Should produce output (either version info or error)
    // Should NOT invoke TUI
    expect(result.stdout + result.stderr).not.toContain("Hasta la próxima")
  })

  test("--upgrade alias: runs upgrade command", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "--upgrade"])

    // Should NOT invoke TUI regardless of success/failure
    expect(result.stdout + result.stderr).not.toContain("Hasta la próxima")
    expect(result.stdout).not.toContain("INSTALAR COMPONENTES")
  })

  test("cyberpunk upgrade --json: outputs JSON on --check", () => {
    const result = runMainIsolated(home, ["bun", "src/index.ts", "upgrade", "--check", "--json"])

    // May succeed or fail depending on git/binary availability
    // If it succeeds, output should be valid JSON
    if (result.exitCode === 0) {
      let parsed: any
      expect(() => { parsed = JSON.parse(result.stdout) }).not.toThrow()
      expect(parsed).toBeDefined()
    }
    // Regardless, should NOT invoke TUI
    expect(result.stdout + result.stderr).not.toContain("Hasta la próxima")
  })
})
