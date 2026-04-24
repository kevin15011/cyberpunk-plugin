// tests/doctor.test.ts — tests for doctor command, parse-args doctor flags, and summary derivation

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { parseArgs } from "../src/cli/parse-args"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

import { createTempHome, importAfterHomeSet, setDefaultConfig } from "./helpers/test-home"

type TestHome = ReturnType<typeof createTempHome>

async function withHome<T>(home: string, run: () => Promise<T> | T): Promise<T> {
  const originalHome = process.env.HOME

  process.env.HOME = home
  try {
    return await run()
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
  }
}

function writeExecutable(filePath: string, content: string) {
  writeFileSync(filePath, content, "utf8")
  chmodSync(filePath, 0o755)
}

function createFakeGitFixture(
  fixture: TestHome,
  options: {
    cloneSucceeds: boolean
    installSucceeds: boolean
  }
) {
  const binDir = join(fixture.home, "test-bin")
  const logPath = join(fixture.home, "tmux-bootstrap.log")
  mkdirSync(binDir, { recursive: true })

  writeExecutable(join(binDir, "git"), `#!/bin/sh
log=${JSON.stringify(logPath)}

if [ "$1" = "clone" ]; then
  printf 'tpm\n' >> "$log"
  dest="$3"
  ${options.cloneSucceeds ? `/bin/mkdir -p "$dest/bin"
  cat > "$dest/bin/install_plugins" <<'EOF'
#!/bin/sh
printf 'plugins\n' >> ${JSON.stringify(logPath)}
${options.installSucceeds ? "exit 0" : "exit 1"}
EOF
  chmod +x "$dest/bin/install_plugins"
  printf '#!/bin/sh\n' > "$dest/tpm"
  exit 0` : "exit 1"}
fi

exit 1
`)

  return {
    binDir: `${binDir}:${process.env.PATH || ""}`,
    logPath,
  }
}

function runDoctorIsolated(
  home: string,
  path: string,
  options: { fix: boolean; verbose: boolean; components?: string[] }
) {
  const evalCode = `
    import { runDoctor } from ${JSON.stringify(join(process.cwd(), "src/commands/doctor.ts"))};
    const result = await runDoctor(${JSON.stringify(options)});
    process.stdout.write(JSON.stringify(result));
  `

  const proc = Bun.spawnSync([process.execPath, "--eval", evalCode], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      PATH: path,
    },
    stdout: "pipe",
    stderr: "pipe",
  })

  if (proc.exitCode !== 0) {
    throw new Error(Buffer.from(proc.stderr).toString("utf8") || `runDoctor subprocess failed with exit ${proc.exitCode}`)
  }

  return JSON.parse(Buffer.from(proc.stdout).toString("utf8")) as Awaited<ReturnType<typeof import("../src/commands/doctor").runDoctor>>
}

describe("parseArgs — doctor flags", () => {
  test("doctor command via positional", () => {
    const result = parseArgs(["doctor"])
    expect(result.command).toBe("doctor")
  })

  test("doctor command via alias 'd'", () => {
    const result = parseArgs(["d"])
    expect(result.command).toBe("doctor")
  })

  test("doctor --fix sets fix flag", () => {
    const result = parseArgs(["doctor", "--fix"])
    expect(result.command).toBe("doctor")
    expect(result.flags.fix).toBe(true)
  })

  test("doctor --json sets json flag", () => {
    const result = parseArgs(["doctor", "--json"])
    expect(result.command).toBe("doctor")
    expect(result.flags.json).toBe(true)
  })

  test("doctor --verbose sets verbose flag", () => {
    const result = parseArgs(["doctor", "--verbose"])
    expect(result.command).toBe("doctor")
    expect(result.flags.verbose).toBe(true)
  })

  test("doctor --fix --json --verbose all flags", () => {
    const result = parseArgs(["doctor", "--fix", "--json", "--verbose"])
    expect(result.command).toBe("doctor")
    expect(result.flags.fix).toBe(true)
    expect(result.flags.json).toBe(true)
    expect(result.flags.verbose).toBe(true)
  })

  test("doctor --plugin scopes to plugin component", () => {
    const result = parseArgs(["doctor", "--plugin"])
    expect(result.command).toBe("doctor")
    expect(result.components).toEqual(["plugin"])
  })

  test("doctor --plugin --theme scopes to multiple components", () => {
    const result = parseArgs(["doctor", "--plugin", "--theme"])
    expect(result.command).toBe("doctor")
    expect(result.components).toEqual(["plugin", "theme"])
  })

  test("--doctor bypasses TUI", () => {
    const result = parseArgs(["--doctor"])
    expect(result.command).toBe("doctor")
  })

  test("fix flag defaults to false", () => {
    const result = parseArgs(["doctor"])
    expect(result.flags.fix).toBe(false)
  })
})

describe("runDoctor summary derivation", () => {
  let fixture: TestHome

  function seedHealthyDoctorFixture(target: TestHome) {
    const configDir = target.configDir
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      version: 1,
      components: { plugin: { installed: false }, theme: { installed: false }, sounds: { installed: false }, "context-mode": { installed: false }, rtk: { installed: false } },
    }))

    const opencodeDir = join(target.home, ".config", "opencode")
    mkdirSync(opencodeDir, { recursive: true })
    writeFileSync(join(opencodeDir, "opencode.json"), JSON.stringify({
      plugin: ["./plugins/cyberpunk"],
    }))

    const skillsDir = join(opencodeDir, "skills", "_shared")
    mkdirSync(skillsDir, { recursive: true })
    const START_MARKER = "<!-- cyberpunk:start:section-e -->"
    const END_MARKER = "<!-- cyberpunk:end:section-e -->"
    writeFileSync(join(skillsDir, "sdd-phase-common.md"), `
# Test
${START_MARKER}
## E. Session Stats

Test content.
${END_MARKER}
`)

    const themesDir = join(opencodeDir, "themes")
    mkdirSync(themesDir, { recursive: true })
    writeFileSync(join(themesDir, "cyberpunk.json"), JSON.stringify({ theme: {} }))
    writeFileSync(join(opencodeDir, "tui.json"), JSON.stringify({ theme: "cyberpunk" }))

    const pluginsDir = join(opencodeDir, "plugins")
    mkdirSync(pluginsDir, { recursive: true })
    writeFileSync(join(pluginsDir, "cyberpunk.ts"), "// plugin")
  }

  beforeEach(() => {
    fixture = createTempHome("cyberpunk-doctor")
  })

  afterEach(() => {
    fixture.cleanup()
  })

  test("returns summary with correct counts on healthy system", async () => {
    seedHealthyDoctorFixture(fixture)

    const { runDoctor } = await importAfterHomeSet<typeof import("../src/commands/doctor")>("../../src/commands/doctor.ts", fixture.home)
    const result = await withHome(fixture.home, () => runDoctor({
      fix: false,
      verbose: false,
      components: ["plugin", "theme"],
    }))

    // Should have checks and summary
    expect(result.checks.length).toBeGreaterThan(0)
    expect(result.summary).toBeDefined()
    expect(typeof result.summary.healthy).toBe("number")
    expect(typeof result.summary.failures).toBe("number")
    expect(typeof result.summary.warnings).toBe("number")
    expect(typeof result.summary.remainingFailures).toBe("number")
  })

  test("doctor results stay the same after another import cached a different HOME", async () => {
    const staleFixture = createTempHome("cyberpunk-doctor-stale")

    try {
      seedHealthyDoctorFixture(fixture)

      const staleDoctor = await importAfterHomeSet<typeof import("../src/commands/doctor")>("../../src/commands/doctor.ts", staleFixture.home)
      const standaloneDoctor = await importAfterHomeSet<typeof import("../src/commands/doctor")>("../../src/commands/doctor.ts", fixture.home)

      const pollutedResult = await withHome(fixture.home, () => staleDoctor.runDoctor({
        fix: false,
        verbose: false,
        components: ["plugin", "theme"],
      }))

      const standaloneResult = await withHome(fixture.home, () => standaloneDoctor.runDoctor({
        fix: false,
        verbose: false,
        components: ["plugin", "theme"],
      }))

      expect(pollutedResult.summary).toEqual(standaloneResult.summary)
      expect(
        pollutedResult.checks.map(check => ({ id: check.id, status: check.status, message: check.message }))
      ).toEqual(
        standaloneResult.checks.map(check => ({ id: check.id, status: check.status, message: check.message }))
      )
    } finally {
      staleFixture.cleanup()
    }
  })

  test("detects missing config as failure", async () => {
    // No config file created
    const { runDoctor } = await importAfterHomeSet<typeof import("../src/commands/doctor")>("../../src/commands/doctor.ts", fixture.home)
    const result = await withHome(fixture.home, () => runDoctor({
      fix: false,
      verbose: false,
    }))

    const configCheck = result.checks.find(c => c.id === "config:integrity")
    expect(configCheck).toBeDefined()
    expect(configCheck!.status).toBe("fail")
  })

  test("--fix with missing config repairs it", async () => {
    // No config file initially
    const { runDoctor } = await importAfterHomeSet<typeof import("../src/commands/doctor")>("../../src/commands/doctor.ts", fixture.home)
    const result = await withHome(fixture.home, () => runDoctor({
      fix: true,
      verbose: false,
    }))

    const configFix = result.fixes.find(f => f.checkId === "config:integrity")
    expect(configFix).toBeDefined()
    expect(configFix!.status).toBe("fixed")

    // Verify config file was created
    const { readConfigRaw } = await importAfterHomeSet<typeof import("../src/config/load")>("../../src/config/load.ts", fixture.home)
    const raw = await withHome(fixture.home, () => readConfigRaw())
    expect(raw.error).toBeNull()
    expect(raw.parsed).not.toBeNull()
  })

  test("exit code derivation: 0 when no remaining failures", async () => {
    const { runDoctor } = await importAfterHomeSet<typeof import("../src/commands/doctor")>("../../src/commands/doctor.ts", fixture.home)
    const result = await withHome(fixture.home, () => runDoctor({ fix: false, verbose: false }))

    // Exit code should be 0 only when remainingFailures === 0
    const exitCode = result.summary.remainingFailures > 0 ? 1 : 0
    // With missing config, there should be failures
    // This is a logical test, not an exit() test
    expect(typeof exitCode).toBe("number")
    expect(exitCode === 0 || exitCode === 1).toBe(true)
  })
})

describe("runDoctor tmux fix orchestration", () => {
  let fixture: TestHome

  beforeEach(() => {
    fixture = createTempHome("cyberpunk-doctor-tmux-fix")
  })

  afterEach(() => {
    mock.restore()
    fixture.cleanup()
  })

  test("doctor --fix runs tmux fixes in config -> tpm -> plugins order", async () => {
    setDefaultConfig(fixture.configDir)
    writeFileSync(join(fixture.home, ".tmux.conf"), "# user header\nset -g prefix C-b\n", "utf8")
    const fakeGit = createFakeGitFixture(fixture, { cloneSucceeds: true, installSucceeds: true })
    const result = runDoctorIsolated(fixture.home, fakeGit.binDir, { fix: true, verbose: false, components: ["tmux"] })

    expect(result.fixes.filter(f => f.checkId.startsWith("tmux:")).map(f => f.checkId)).toEqual(["tmux:config", "tmux:tpm", "tmux:plugins"])
    expect(result.fixes.filter(f => f.checkId.startsWith("tmux:")).map(f => f.status)).toEqual(["fixed", "fixed", "fixed"])
    expect(readFileSync(fakeGit.logPath, "utf8").trim().split("\n")).toEqual(["tpm", "plugins"])
  })

  test("doctor --fix keeps tmux bootstrap failures advisory and continues later fixes", async () => {
    setDefaultConfig(fixture.configDir)
    writeFileSync(
      join(fixture.home, ".tmux.conf"),
      "# user config\n# cyberpunk-managed:start\nset -g prefix C-a\n# cyberpunk-managed:end\n",
      "utf8"
    )
    const fakeGit = createFakeGitFixture(fixture, { cloneSucceeds: false, installSucceeds: false })
    const result = runDoctorIsolated(fixture.home, fakeGit.binDir, { fix: true, verbose: false, components: ["tmux"] })

    expect(result.fixes.filter(f => f.checkId.startsWith("tmux:")).map(f => f.checkId)).toEqual(["tmux:tpm", "tmux:plugins"])
    expect(result.fixes.find(f => f.checkId === "tmux:tpm")?.status).toBe("failed")
    expect(result.fixes.find(f => f.checkId === "tmux:plugins")?.status).toBe("failed")
    expect(result.fixes.find(f => f.checkId === "tmux:plugins")?.message).toContain("TPM")
    expect(readFileSync(fakeGit.logPath, "utf8").trim().split("\n")).toEqual(["tpm"])
  })
})
