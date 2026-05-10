// tests/codex-token-tools.test.ts — Codex token-saving support boundaries

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-codex-tools-${Date.now()}`)
const ORIGINAL_HOME = process.env.HOME
const ORIGINAL_CODEX_HOME = process.env.CODEX_HOME
const ORIGINAL_PATH = process.env.PATH

function writeConfig() {
  const dir = join(TEMP_HOME, ".config", "cyberpunk")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "config.json"), JSON.stringify({ version: 2, components: {} }, null, 2), "utf8")
}

function fakeBin(name: string) {
  const dir = join(TEMP_HOME, ".local", "bin")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, "#!/bin/sh\nexit 0\n", "utf8")
  chmodSync(path, 0o755)
  process.env.PATH = `${dir}:${ORIGINAL_PATH ?? ""}`
}

function fakeBinWithBody(name: string, body: string) {
  const dir = join(TEMP_HOME, ".local", "bin")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, body, "utf8")
  chmodSync(path, 0o755)
  process.env.PATH = `${dir}:${ORIGINAL_PATH ?? ""}`
}

describe("Codex token-saving tools", () => {
  beforeEach(() => {
    rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
    process.env.CODEX_HOME = join(TEMP_HOME, "custom-codex")
    process.env.PATH = ORIGINAL_PATH
    writeConfig()
  })

  afterEach(() => {
    process.env.HOME = ORIGINAL_HOME
    if (ORIGINAL_CODEX_HOME === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = ORIGINAL_CODEX_HOME
    process.env.PATH = ORIGINAL_PATH
    mock.restore()
    rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("codex paths use CODEX_HOME and expected instruction/config files", async () => {
    const { getCodexPaths } = await import(`../src/platform/codex-paths.ts?${Date.now()}`)
    const paths = getCodexPaths()
    expect(paths.codexHome).toBe(join(TEMP_HOME, "custom-codex"))
    expect(paths.agentsPath).toBe(join(TEMP_HOME, "custom-codex", "AGENTS.md"))
    expect(paths.configTomlPath).toBe(join(TEMP_HOME, "custom-codex", "config.toml"))
    expect(paths.contextModeRoutingPath).toContain(join("instructions", "context-mode-routing.md"))
  })

  test("runInstall for Codex keeps only RTK/context-mode/codebase-memory", async () => {
    const { runInstall } = await import(`../src/commands/install.ts?${Date.now()}`)
    const results = await runInstall(["plugin", "theme", "rtk", "context-mode", "codebase-memory"], "install", { target: "codex", check: true })
    expect(results.map(r => r.component).sort()).toEqual(["codebase-memory", "context-mode", "rtk"])
  })

  test("runInstall for Codex installs all token tools and excludes full ecosystem assets", async () => {
    fakeBinWithBody("rtk", "#!/bin/sh\nexit 0\n")
    fakeBin("npm")
    fakeBin("context-mode")
    fakeBin("codebase-memory-mcp")

    const { runInstall } = await import(`../src/commands/install.ts?${Date.now()}`)
    const results = await runInstall(["plugin", "theme", "sounds", "sdd-integration", "rtk", "context-mode", "codebase-memory"], "install", { target: "codex" })
    const codexHome = join(TEMP_HOME, "custom-codex")
    const agents = readFileSync(join(codexHome, "AGENTS.md"), "utf8")

    expect(results.map(r => r.component).sort()).toEqual(["codebase-memory", "context-mode", "rtk"])
    expect(existsSync(join(codexHome, "instructions", "rtk-routing.md"))).toBe(true)
    expect(existsSync(join(codexHome, "instructions", "context-mode-routing.md"))).toBe(true)
    expect(existsSync(join(codexHome, "instructions", "codebase-memory-routing.md"))).toBe(true)
    expect(agents).toContain("@instructions/rtk-routing.md")
    expect(agents).toContain("@instructions/context-mode-routing.md")
    expect(agents).toContain("@instructions/codebase-memory-routing.md")
    expect(existsSync(join(codexHome, "plugin"))).toBe(false)
  })

  test("context-mode Codex install writes instructions and does not require TOML mutation", async () => {
    fakeBin("npm")
    fakeBin("context-mode")
    const { getContextModeComponent } = await import(`../src/components/context-mode.ts?${Date.now()}`)
    const result = await getContextModeComponent().install({ target: "codex" })
    expect(["success", "skipped", "error"]).toContain(result.status)
    const routing = join(TEMP_HOME, "custom-codex", "instructions", "context-mode-routing.md")
    expect(existsSync(routing)).toBe(true)
    expect(readFileSync(join(TEMP_HOME, "custom-codex", "AGENTS.md"), "utf8")).toContain("@instructions/context-mode-routing.md")
  })

  test("Codex AGENTS include accumulates all managed token-tool instructions", async () => {
    const {
      ensureCodexAgentsInclude,
      ensureCodexInstructionFile,
      getCodexPaths,
    } = await import(`../src/platform/codex-paths.ts?${Date.now()}`)
    const paths = getCodexPaths()

    ensureCodexInstructionFile(paths.rtkRoutingPath, "<!-- cyberpunk-managed:rtk-routing -->\nRTK\n")
    ensureCodexAgentsInclude(["rtk-routing.md"])
    ensureCodexInstructionFile(paths.contextModeRoutingPath, "<!-- cyberpunk-managed:context-mode-routing -->\nContext\n")
    ensureCodexAgentsInclude(["context-mode-routing.md"])
    ensureCodexInstructionFile(paths.codebaseMemoryRoutingPath, "<!-- cyberpunk-managed:codebase-memory-routing -->\nMemory\n")
    ensureCodexAgentsInclude(["codebase-memory-routing.md"])

    const agents = readFileSync(paths.agentsPath, "utf8")
    expect(agents).toContain("@instructions/rtk-routing.md")
    expect(agents).toContain("@instructions/context-mode-routing.md")
    expect(agents).toContain("@instructions/codebase-memory-routing.md")
  })

  test("Codex AGENTS include keeps other managed entries after one component uninstall", async () => {
    const {
      ensureCodexAgentsInclude,
      ensureCodexInstructionFile,
      getCodexPaths,
      removeCodexAgentsInclude,
      removeCodexInstructionFile,
    } = await import(`../src/platform/codex-paths.ts?${Date.now()}`)
    const paths = getCodexPaths()

    ensureCodexInstructionFile(paths.rtkRoutingPath, "<!-- cyberpunk-managed:rtk-routing -->\nRTK\n")
    ensureCodexInstructionFile(paths.contextModeRoutingPath, "<!-- cyberpunk-managed:context-mode-routing -->\nContext\n")
    ensureCodexAgentsInclude(["rtk-routing.md"])
    ensureCodexAgentsInclude(["context-mode-routing.md"])

    removeCodexInstructionFile(paths.rtkRoutingPath, "<!-- cyberpunk-managed:rtk-routing -->")
    removeCodexAgentsInclude()

    const agents = readFileSync(paths.agentsPath, "utf8")
    expect(agents).not.toContain("@instructions/rtk-routing.md")
    expect(agents).toContain("@instructions/context-mode-routing.md")
  })

  test("codebase-memory Codex install patches only existing safe TOML", async () => {
    fakeBin("codebase-memory-mcp")
    const codexHome = join(TEMP_HOME, "custom-codex")
    mkdirSync(codexHome, { recursive: true })
    writeFileSync(join(codexHome, "config.toml"), "[mcp_servers.existing]\ncommand = \"x\"\n", "utf8")
    const { getCodebaseMemoryComponent } = await import(`../src/components/codebase-memory.ts?${Date.now()}`)
    const { unpatchCodexMcpToml } = await import(`../src/platform/codex-paths.ts?${Date.now()}`)
    await getCodebaseMemoryComponent().install({ target: "codex" })
    const toml = readFileSync(join(codexHome, "config.toml"), "utf8")
    expect(toml).toContain("[mcp_servers.codebase-memory]")
    expect(toml).toContain("codebase-memory-mcp")
    expect(existsSync(join(codexHome, "config.toml.tmp"))).toBe(false)

    expect(unpatchCodexMcpToml("codebase-memory")).toBe(true)
    expect(readFileSync(join(codexHome, "config.toml"), "utf8")).not.toContain("[mcp_servers.codebase-memory]")
    expect(existsSync(join(codexHome, "config.toml.tmp"))).toBe(false)
  })

  test("codebase-memory Codex install falls back to instructions when TOML schema is unsafe", async () => {
    fakeBin("codebase-memory-mcp")
    const codexHome = join(TEMP_HOME, "custom-codex")
    mkdirSync(codexHome, { recursive: true })
    writeFileSync(join(codexHome, "config.toml"), "[profiles.default]\nmodel = \"x\"\n", "utf8")

    const { getCodebaseMemoryComponent } = await import(`../src/components/codebase-memory.ts?${Date.now()}`)
    const result = await getCodebaseMemoryComponent().install({ target: "codex" })
    const toml = readFileSync(join(codexHome, "config.toml"), "utf8")

    expect(["success", "skipped"]).toContain(result.status)
    expect(toml).not.toContain("[mcp_servers.codebase-memory]")
    expect(toml).toContain("[profiles.default]")
    expect(existsSync(join(codexHome, "instructions", "codebase-memory-routing.md"))).toBe(true)
  })

  test("Codex uninstall removes managed token-tool assets while preserving user files", async () => {
    fakeBinWithBody("rtk", "#!/bin/sh\nexit 0\n")
    fakeBin("npm")
    fakeBin("context-mode")
    fakeBin("codebase-memory-mcp")

    const { runInstall, runUninstall } = await import(`../src/commands/install.ts?install=${Date.now()}`)
    await runInstall(["rtk", "context-mode", "codebase-memory"], "install", { target: "codex" })

    const codexHome = join(TEMP_HOME, "custom-codex")
    writeFileSync(join(codexHome, "user-notes.md"), "keep me", "utf8")
    const results = await runUninstall(["rtk", "context-mode", "codebase-memory"], { target: "codex" })

    expect(results.map(r => r.component).sort()).toEqual(["codebase-memory", "context-mode", "rtk"])
    expect(existsSync(join(codexHome, "instructions", "rtk-routing.md"))).toBe(false)
    expect(existsSync(join(codexHome, "instructions", "context-mode-routing.md"))).toBe(false)
    expect(existsSync(join(codexHome, "instructions", "codebase-memory-routing.md"))).toBe(false)
    expect(existsSync(join(codexHome, "AGENTS.md"))).toBe(false)
    expect(readFileSync(join(codexHome, "user-notes.md"), "utf8")).toBe("keep me")
  })

  test("RTK Codex install invokes upstream init with -g --codex", async () => {
    const evalCode = `
      const commands = [];
      const { getRtkComponent, __setRtkTestOverrides } = await import(${JSON.stringify(join(process.cwd(), "src/components/rtk.ts"))} + "?rtk-init-subprocess=" + Date.now());
      __setRtkTestOverrides({ command: ${JSON.stringify(join(TEMP_HOME, ".local", "bin", "rtk"))}, exec: (command) => { commands.push(command); } });
      const result = await getRtkComponent().install({ target: "codex" });
      console.log(JSON.stringify({ status: result.status, commands }));
    `
    const proc = Bun.spawnSync([process.execPath, "--eval", evalCode], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: TEMP_HOME, CODEX_HOME: join(TEMP_HOME, "custom-codex") },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60000,
    })
    const parsed = JSON.parse(Buffer.from(proc.stdout).toString("utf8"))

    expect(proc.exitCode).toBe(0)
    expect(["success", "skipped"]).toContain(parsed.status)
    expect(parsed.commands.some((command: string) => command.includes("init -g --codex"))).toBe(true)
  })
})
