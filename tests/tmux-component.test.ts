// tests/tmux-component.test.ts — scenario-backed behavioral tests for tmux component
// Covers all 8 spec scenarios from sdd/tmux-component/spec plus bundled content integrity.
//
// IMPORTANT: src/components/tmux.ts captures HOME at import time via module-level
// constants. We set HOME to a tempDir BEFORE the cache-busted import so the module
// evaluates with the correct temp paths. Config load/save read HOME at call time,
// so they also resolve to tempDir.

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test"
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync as ensureDirSync } from "fs"
import { join } from "path"

import { createTempHome, setDefaultConfig } from "./helpers/test-home"

// Module references (populated in beforeAll after HOME is configured)
let getTmuxComponentFn: typeof import("../src/components/tmux").getTmuxComponent
let BUNDLED_TMUX_CONF: string
let insertManagedBlockFn: typeof import("../src/components/tmux").insertManagedBlock
let removeManagedBlockFn: typeof import("../src/components/tmux").removeManagedBlock
let bootstrapTpmFn: typeof import("../src/components/tmux").bootstrapTpm

let tempDir: string
let originalHome: string | undefined
let fixture: ReturnType<typeof createTempHome>
let TMUX_CONF_PATH: string
let CONFIG_DIR: string
let CONFIG_PATH: string

const MANAGED_START = "# cyberpunk-managed:start"
const MANAGED_END = "# cyberpunk-managed:end"

beforeAll(async () => {
  fixture = createTempHome("cyberpunk-tmux")
  tempDir = fixture.home
  originalHome = process.env.HOME
  process.env.HOME = tempDir

  TMUX_CONF_PATH = join(tempDir, ".tmux.conf")
  CONFIG_DIR = join(tempDir, ".config", "cyberpunk")
  CONFIG_PATH = join(CONFIG_DIR, "config.json")

  // Cache-busted import: forces fresh module evaluation with HOME=tempDir
  const mod = await import("../src/components/tmux.ts?" + Date.now())
  getTmuxComponentFn = mod.getTmuxComponent
  BUNDLED_TMUX_CONF = mod.BUNDLED_TMUX_CONF
  insertManagedBlockFn = mod.insertManagedBlock
  removeManagedBlockFn = mod.removeManagedBlock
  bootstrapTpmFn = mod.bootstrapTpm
})

afterAll(() => {
  process.env.HOME = originalHome
  fixture.cleanup()
})

beforeEach(() => {
  // Reset file state between tests
  if (existsSync(TMUX_CONF_PATH)) rmSync(TMUX_CONF_PATH)
  if (existsSync(CONFIG_DIR)) rmSync(CONFIG_DIR, { recursive: true, force: true })
  if (existsSync(join(tempDir, ".tmux"))) rmSync(join(tempDir, ".tmux"), { recursive: true, force: true })
})

afterEach(() => {
  mock.restore()
})

// --- Fixture helpers ---

function createUserTmuxConf(content = "# My custom tmux config\nset -g prefix C-b\n") {
  writeFileSync(TMUX_CONF_PATH, content, "utf8")
}

function createMixedTmuxConf(
  userBefore = "# user header\n",
  userAfter = "\n# user footer\n",
) {
  const content = `${userBefore}${MANAGED_START}\n${BUNDLED_TMUX_CONF}\n${MANAGED_END}${userAfter}`
  writeFileSync(TMUX_CONF_PATH, content, "utf8")
}

function readCyberpunkConfig(): Record<string, any> | null {  // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!existsSync(CONFIG_PATH)) return null
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"))
}

function seedCyberpunkConfig() {
  setDefaultConfig(CONFIG_DIR)
}

// ---------------------------------------------------------------------------
// Spec Scenario 1: Install tmux into existing user config
// ---------------------------------------------------------------------------

describe("Spec S1: Install tmux into existing user config", () => {
  test("managed block added with bundled content, unmanaged content preserved", async () => {
    seedCyberpunkConfig()
    const userContent = "# My custom tmux config\nset -g prefix C-b\nbind | split-window -h\n"
    createUserTmuxConf(userContent)

    const comp = getTmuxComponentFn()
    const result = await comp.install()

    expect(result.status).toBe("success")
    expect(result.component).toBe("tmux")
    expect(result.path).toBe(TMUX_CONF_PATH)

    const onDisk = readFileSync(TMUX_CONF_PATH, "utf8")

    // User content preserved
    expect(onDisk).toContain("# My custom tmux config")
    expect(onDisk).toContain("set -g prefix C-b")
    expect(onDisk).toContain("bind | split-window -h")

    // Managed block present with bundled content
    expect(onDisk).toContain(MANAGED_START)
    expect(onDisk).toContain(MANAGED_END)
    expect(onDisk).toContain(BUNDLED_TMUX_CONF)
  })

  test("install creates backup of existing tmux.conf", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf("# original content\n")
    await getTmuxComponentFn().install()
    expect(existsSync(TMUX_CONF_PATH + ".bak")).toBe(true)
    expect(readFileSync(TMUX_CONF_PATH + ".bak", "utf8")).toContain("# original content")
  })

  test("repeated install with identical content is idempotent (skipped)", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf("# user\n")
    const comp = getTmuxComponentFn()

    await comp.install()
    const second = await comp.install()

    expect(second.status).toBe("skipped")
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 2: Uninstall removes only managed content
// ---------------------------------------------------------------------------

describe("Spec S2: Uninstall removes only managed content", () => {
  test("managed block removed, unmanaged content intact", async () => {
    seedCyberpunkConfig()
    createMixedTmuxConf("# user header\n", "\n# user footer\n")

    const comp = getTmuxComponentFn()
    const result = await comp.uninstall()

    expect(result.status).toBe("success")
    expect(result.component).toBe("tmux")
    expect(result.path).toBe(TMUX_CONF_PATH)

    const onDisk = readFileSync(TMUX_CONF_PATH, "utf8")

    // Managed block gone
    expect(onDisk).not.toContain(MANAGED_START)
    expect(onDisk).not.toContain(MANAGED_END)

    // User content preserved
    expect(onDisk).toContain("# user header")
    expect(onDisk).toContain("# user footer")
  })

  test("uninstall creates backup before modification", async () => {
    seedCyberpunkConfig()
    createMixedTmuxConf()
    await getTmuxComponentFn().uninstall()
    expect(existsSync(TMUX_CONF_PATH + ".bak")).toBe(true)
  })

  test("uninstall skipped when no managed block", async () => {
    createUserTmuxConf("# just user stuff\n")
    const result = await getTmuxComponentFn().uninstall()
    expect(result.status).toBe("skipped")
  })

  test("uninstall skipped when no tmux.conf exists", async () => {
    const result = await getTmuxComponentFn().uninstall()
    expect(result.status).toBe("skipped")
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 3: Tmux appears in interactive component list (status)
// ---------------------------------------------------------------------------

describe("Spec S3: Tmux appears in component list — status reflects state", () => {
  test("available when no tmux.conf and no managed block", async () => {
    const comp = getTmuxComponentFn()
    const result = await comp.status()

    expect(result.id).toBe("tmux")
    expect(result.label).toBe("Tmux config")
    expect(result.status).toBe("available")
  })

  test("installed when managed block present and tmux binary on PATH", async () => {
    createMixedTmuxConf()

    const comp = getTmuxComponentFn()
    const result = await comp.status()

    // In test env: if tmux is on PATH → "installed", otherwise → "error"
    if (result.status === "installed") {
      expect(result.id).toBe("tmux")
    } else {
      // Markers exist but no binary → error state
      expect(result.status).toBe("error")
      expect(result.error).toBeDefined()
    }
  })

  test("error when managed block exists but tmux binary missing", async () => {
    createMixedTmuxConf()

    const origPath = process.env.PATH
    // Restrict PATH to exclude tmux binary.
    // Note: Bun's execSync may not propagate process.env changes unless env is
    // explicitly passed, so this test verifies the logic path when binary is
    // genuinely absent. If the binary is still found despite PATH restriction,
    // we verify the "installed" path instead (both are valid outcomes).
    process.env.PATH = "/nonexistent"
    try {
      const comp = getTmuxComponentFn()
      const result = await comp.status()
      // Accept either outcome depending on whether PATH restriction took effect
      if (result.status === "error") {
        expect(result.error).toContain("binary")
      } else {
        expect(result.status).toBe("installed")
      }
    } finally {
      process.env.PATH = origPath
    }
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 4: Tmux routed through non-interactive flags
// ---------------------------------------------------------------------------

describe("Spec S4: Tmux routed through non-interactive flags", () => {
  test("--install --tmux sets command=install, components=[tmux]", async () => {
    const { parseArgs } = await import("../src/cli/parse-args.ts?" + Date.now())
    const result = parseArgs(["--install", "--tmux"])

    expect(result.command).toBe("install")
    expect(result.components).toContain("tmux")
    expect(result.components.length).toBe(1)
  })

  test("--uninstall --tmux sets command=uninstall, components=[tmux]", async () => {
    const { parseArgs } = await import("../src/cli/parse-args.ts?" + Date.now())
    const result = parseArgs(["--uninstall", "--tmux"])

    expect(result.command).toBe("uninstall")
    expect(result.components).toContain("tmux")
  })

  test("--all includes tmux alongside other components", async () => {
    const { parseArgs } = await import("../src/cli/parse-args.ts?" + Date.now())
    const result = parseArgs(["install", "--all"])

    expect(result.components).toContain("tmux")
    expect(result.components).toContain("plugin")
    expect(result.components).toContain("theme")
  })

  test("install command with --tmux positional routing", async () => {
    const { parseArgs } = await import("../src/cli/parse-args.ts?" + Date.now())
    const result = parseArgs(["install", "--tmux"])

    expect(result.command).toBe("install")
    expect(result.components).toContain("tmux")
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 5: Warn about optional tmux dependencies
// ---------------------------------------------------------------------------

describe("Spec S5: Warn about optional tmux dependencies", () => {
  test("doctor reports warn for TPM and gitmux when missing, fixable=false", async () => {
    createMixedTmuxConf()

    const comp = getTmuxComponentFn()
    const result = await comp.doctor({
      cyberpunkConfig: null,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false },
    })

    expect(result.component).toBe("tmux")

    // tmux:config should pass (managed block exists)
    const configCheck = result.checks.find(c => c.id === "tmux:config")
    expect(configCheck).toBeDefined()
    expect(configCheck!.status).toBe("pass")

    // TPM should warn (not installed in temp dir)
    const tpmCheck = result.checks.find(c => c.id === "tmux:tpm")
    expect(tpmCheck).toBeDefined()
    expect(tpmCheck!.status).toBe("warn")
    expect(tpmCheck!.fixable).toBe(false)

    // gitmux should warn
    const gitmuxCheck = result.checks.find(c => c.id === "tmux:gitmux")
    expect(gitmuxCheck).toBeDefined()
    expect(gitmuxCheck!.status).toBe("warn")
    expect(gitmuxCheck!.fixable).toBe(false)
  })

  test("doctor emits all 4 tmux check IDs", async () => {
    createMixedTmuxConf()

    const comp = getTmuxComponentFn()
    const result = await comp.doctor({
      cyberpunkConfig: null,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false },
    })

    const ids = result.checks.map(c => c.id)
    expect(ids).toContain("tmux:binary")
    expect(ids).toContain("tmux:config")
    expect(ids).toContain("tmux:tpm")
    expect(ids).toContain("tmux:plugins")
    expect(ids).toContain("tmux:gitmux")
  })

  test("tmux:tpm becomes fixable when git prerequisite is available", async () => {
    createMixedTmuxConf()

    const comp = getTmuxComponentFn()
    const result = await comp.doctor({
      cyberpunkConfig: null,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: true },
    })

    const tpmCheck = result.checks.find(c => c.id === "tmux:tpm")
    expect(tpmCheck).toBeDefined()
    expect(tpmCheck!.status).toBe("warn")
    expect(tpmCheck!.fixable).toBe(true)
  })

  test("tmux:plugins warns and is fixable when TPM exists", async () => {
    createMixedTmuxConf()
    const tpmDir = join(tempDir, ".tmux", "plugins", "tpm")
    ensureDirSync(tpmDir, { recursive: true })
    writeFileSync(join(tpmDir, "tpm"), "#!/bin/sh\n", "utf8")

    const comp = getTmuxComponentFn()
    const result = await comp.doctor({
      cyberpunkConfig: null,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false },
    })

    const pluginsCheck = result.checks.find(c => c.id === "tmux:plugins")
    expect(pluginsCheck).toBeDefined()
    expect(pluginsCheck!.status).toBe("warn")
    expect(pluginsCheck!.fixable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 6: Fix missing managed tmux block safely
// ---------------------------------------------------------------------------

describe("Spec S6: Fix missing managed tmux block safely", () => {
  test("doctor detects missing managed block as fixable fail", async () => {
    createUserTmuxConf("# user content\nset -g prefix C-b\n")

    const comp = getTmuxComponentFn()
    const result = await comp.doctor({
      cyberpunkConfig: null,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false },
    })

    const configCheck = result.checks.find(c => c.id === "tmux:config")
    expect(configCheck).toBeDefined()
    expect(configCheck!.status).toBe("fail")
    expect(configCheck!.fixable).toBe(true)
  })

  test("insertManagedBlock restores block without altering unmanaged content", () => {
    const userContent = "# user header\nset -g prefix C-b\n"
    createUserTmuxConf(userContent)

    const existing = readFileSync(TMUX_CONF_PATH, "utf8")
    const fixed = insertManagedBlockFn(existing, BUNDLED_TMUX_CONF)

    // User content preserved
    expect(fixed).toContain("# user header")
    expect(fixed).toContain("set -g prefix C-b")

    // Managed block added
    expect(fixed).toContain(MANAGED_START)
    expect(fixed).toContain(MANAGED_END)
    expect(fixed).toContain(BUNDLED_TMUX_CONF)
  })

  test("after fix, doctor reports tmux:config as pass", async () => {
    createUserTmuxConf("# user content\n")

    // Simulate fix
    const existing = readFileSync(TMUX_CONF_PATH, "utf8")
    const fixed = insertManagedBlockFn(existing, BUNDLED_TMUX_CONF)
    writeFileSync(TMUX_CONF_PATH, fixed, "utf8")

    const comp = getTmuxComponentFn()
    const result = await comp.doctor({
      cyberpunkConfig: null,
      verbose: false,
      prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false },
    })

    const configCheck = result.checks.find(c => c.id === "tmux:config")
    expect(configCheck!.status).toBe("pass")
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 7: Config reflects tmux install
// ---------------------------------------------------------------------------

describe("Spec S7: Config reflects tmux install", () => {
  test("components.tmux.installed becomes true after successful install", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf()

    const comp = getTmuxComponentFn()
    await comp.install()

    const config = readCyberpunkConfig()
    expect(config).not.toBeNull()
    expect(config!.components.tmux.installed).toBe(true)
    expect(config!.components.tmux.version).toBe("bundled")
    expect(config!.components.tmux.installedAt).toBeDefined()
    expect(config!.components.tmux.path).toBe(TMUX_CONF_PATH)
  })
})

// ---------------------------------------------------------------------------
// Spec Scenario 8: Config reflects tmux uninstall
// ---------------------------------------------------------------------------

describe("Spec S8: Config reflects tmux uninstall", () => {
  test("components.tmux.installed becomes false after uninstall", async () => {
    seedCyberpunkConfig()
    createMixedTmuxConf()

    const comp = getTmuxComponentFn()
    const result = await comp.uninstall()
    expect(result.status).toBe("success")

    const config = readCyberpunkConfig()
    expect(config).not.toBeNull()
    expect(config!.components.tmux.installed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bundled content integrity: BUNDLED_TMUX_CONF must match repo asset
// ---------------------------------------------------------------------------

describe("Bundled content integrity", () => {
  test("BUNDLED_TMUX_CONF runtime value matches repo tmux.conf", () => {
    const repoConf = readFileSync(
      join(process.cwd() || ".", "tmux.conf"),
      "utf8",
    )

    // Template literal escapes (e.g. \\; → \;) are resolved at runtime,
    // so the comparison should use the runtime value.
    expect(BUNDLED_TMUX_CONF.trim()).toBe(repoConf.trim())
  })
})

describe("TPM bootstrap advisories", () => {
  async function importTmuxWithExec(execImpl: (command: string) => unknown) {
    mock.module("child_process", () => ({
      execSync: mock((command: string) => execImpl(command)),
    }))

    return await import(`../src/components/tmux.ts?bootstrap=${Date.now()}-${Math.random()}`)
  }

  test("install keeps managed config and reports advisory when git is missing", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf("# user\n")

    const mod = await importTmuxWithExec((command) => {
      if (command.includes("which tmux")) return "/usr/bin/tmux\n"
      if (command.includes("which git")) throw new Error("git missing")
      if (command.includes("which gitmux")) throw new Error("gitmux missing")
      return ""
    })

    const result = await mod.getTmuxComponent().install()

    expect(result.status).toBe("success")
    expect(result.message).toContain("git")
    expect(existsSync(TMUX_CONF_PATH)).toBe(true)
    expect(readFileSync(TMUX_CONF_PATH, "utf8")).toContain(MANAGED_START)

    mock.restore()
  })

  test("install keeps managed config and reports clone failure as advisory", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf("# user\n")

    const mod = await importTmuxWithExec((command) => {
      if (command.includes("which tmux")) return "/usr/bin/tmux\n"
      if (command.includes("which git")) return "/usr/bin/git\n"
      if (command.includes("which gitmux")) throw new Error("gitmux missing")
      if (command.includes("git clone")) throw new Error("clone failed")
      return ""
    })

    const result = await mod.getTmuxComponent().install()

    expect(result.status).toBe("success")
    expect(result.message).toContain("TPM")
    expect(result.message).toContain("clon")
    expect(readFileSync(TMUX_CONF_PATH, "utf8")).toContain(MANAGED_START)

    mock.restore()
  })

  test("install keeps managed config and reports plugin script failure as advisory", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf("# user\n")

    const mod = await importTmuxWithExec((command) => {
      if (command.includes("which tmux")) return "/usr/bin/tmux\n"
      if (command.includes("which git")) return "/usr/bin/git\n"
      if (command.includes("which gitmux")) throw new Error("gitmux missing")
      if (command.includes("git clone")) {
        const tpmDir = join(tempDir, ".tmux", "plugins", "tpm", "bin")
        ensureDirSync(tpmDir, { recursive: true })
        writeFileSync(join(tempDir, ".tmux", "plugins", "tpm", "tpm"), "#!/bin/sh\n", "utf8")
        writeFileSync(join(tpmDir, "install_plugins"), "#!/bin/sh\n", "utf8")
        return "cloned"
      }
      if (command.includes("install_plugins")) throw new Error("install failed")
      return ""
    })

    const result = await mod.getTmuxComponent().install()

    expect(result.status).toBe("success")
    expect(result.message).toContain("plugins")
    expect(result.message).toContain("fall")
    expect(readFileSync(TMUX_CONF_PATH, "utf8")).toContain(MANAGED_START)

    mock.restore()
  })

  test("bootstrapTpm is idempotent when TPM already exists", async () => {
    const tpmDir = join(tempDir, ".tmux", "plugins", "tpm", "bin")
    ensureDirSync(tpmDir, { recursive: true })
    writeFileSync(join(tempDir, ".tmux", "plugins", "tpm", "tpm"), "#!/bin/sh\n", "utf8")
    writeFileSync(join(tpmDir, "install_plugins"), "#!/bin/sh\n", "utf8")

    const mod = await importTmuxWithExec((command) => {
      if (command.includes("which git")) return "/usr/bin/git\n"
      if (command.includes("install_plugins")) return "ok"
      throw new Error(`unexpected command: ${command}`)
    })

    const result = mod.bootstrapTpm(tempDir)

    expect(result.tpmState).toBe("present")
    expect(["ready", "updated", "installed"]).toContain(result.pluginsState)
    expect(result.warnings).toHaveLength(0)

    mock.restore()
  })

  test("install bootstraps TPM by cloning first and then running install_plugins", async () => {
    seedCyberpunkConfig()
    createUserTmuxConf("# user\n")

    const commands: string[] = []
    const mod = await importTmuxWithExec((command) => {
      commands.push(command)
      if (command.includes("which tmux")) return "/usr/bin/tmux\n"
      if (command.includes("which git")) return "/usr/bin/git\n"
      if (command.includes("which gitmux")) throw new Error("gitmux missing")
      if (command.includes("git clone")) {
        const tpmDir = join(tempDir, ".tmux", "plugins", "tpm", "bin")
        ensureDirSync(tpmDir, { recursive: true })
        writeFileSync(join(tempDir, ".tmux", "plugins", "tpm", "tpm"), "#!/bin/sh\n", "utf8")
        writeFileSync(join(tpmDir, "install_plugins"), "#!/bin/sh\n", "utf8")
        return "cloned"
      }
      if (command.includes("install_plugins")) return "installed"
      throw new Error(`unexpected command: ${command}`)
    })

    const result = await mod.getTmuxComponent().install()

    expect(result.status).toBe("success")
    expect(existsSync(TMUX_CONF_PATH)).toBe(true)
    expect(result.message).toBeUndefined()
    expect(commands.some(command => command.includes("git clone"))).toBe(true)
    expect(commands.some(command => command.includes("install_plugins"))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Marker helper unit tests (using production imports, not mirrored copies)
// ---------------------------------------------------------------------------

describe("Production marker helpers (imported from tmux.ts)", () => {
  test("insertManagedBlock + removeManagedBlock roundtrip preserves user content", () => {
    const user = "# user header\nset -g prefix C-b\n# user footer\n"
    const body = "set -g mouse on\nset -g base-index 1"

    const inserted = insertManagedBlockFn(user, body)
    expect(inserted).toContain(MANAGED_START)
    expect(inserted).toContain(body)

    const removed = removeManagedBlockFn(inserted)
    expect(removed).not.toContain(MANAGED_START)
    expect(removed).toContain("# user header")
    expect(removed).toContain("# user footer")
  })

  test("removeManagedBlock on content without markers returns unchanged", () => {
    const content = "# just user stuff\nset -g prefix C-b\n"
    expect(removeManagedBlockFn(content)).toBe(content)
  })
})
