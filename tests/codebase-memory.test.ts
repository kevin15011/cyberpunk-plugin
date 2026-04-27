// tests/codebase-memory.test.ts — verify codebase-memory component

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-cm-test-${Date.now()}`)
const CYBERPUNK_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const CYBERPUNK_CONFIG_PATH = join(CYBERPUNK_CONFIG_DIR, "config.json")
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const OPENCODE_CONFIG_PATH = join(OPENCODE_DIR, "opencode.json")
const LOCAL_BIN_DIR = join(TEMP_HOME, ".local", "bin")
const BINARY_PATH = join(LOCAL_BIN_DIR, "codebase-memory-mcp")
const ORIGINAL_HOME = process.env.HOME

function writeCyberpunkConfig() {
  mkdirSync(CYBERPUNK_CONFIG_DIR, { recursive: true })
  writeFileSync(
    CYBERPUNK_CONFIG_PATH,
    JSON.stringify({
      version: 2,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
        "tui-plugins": { installed: false },
        "codebase-memory": { installed: false },
        otel: { installed: false },
        "otel-collector": { installed: false },
      },
    }, null, 2) + "\n",
    "utf8"
  )
}

function writeOpenCodeConfig(data: Record<string, unknown>) {
  mkdirSync(OPENCODE_DIR, { recursive: true })
  writeFileSync(OPENCODE_CONFIG_PATH, JSON.stringify(data, null, 2) + "\n", "utf8")
}

function readOpenCodeConfig() {
  return JSON.parse(readFileSync(OPENCODE_CONFIG_PATH, "utf8"))
}

function installFakeBinary() {
  mkdirSync(LOCAL_BIN_DIR, { recursive: true })
  writeFileSync(BINARY_PATH, "#!/bin/sh\nexit 0\n", "utf8")
  chmodSync(BINARY_PATH, 0o755)
}

describe("codebase-memory component", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
  })

  afterEach(() => {
    process.env.HOME = ORIGINAL_HOME
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("install with binary present adds MCP config and routing", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [], mcp: {} })

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    const result = await component.install()

    expect(["success", "skipped"]).toContain(result.status)

    // MCP config
    const cfg = readOpenCodeConfig()
    expect(cfg.mcp["codebase-memory"]).toBeDefined()
    expect(cfg.mcp["codebase-memory"].command).toEqual(["codebase-memory-mcp"])
    expect(cfg.mcp["codebase-memory"].type).toBe("local")
    expect(cfg.mcp["codebase-memory"].enabled).toBe(true)

    // Routing file
    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    expect(existsSync(routingPath)).toBe(true)
    const routingContent = readFileSync(routingPath, "utf8")
    expect(routingContent).toContain("<!-- cyberpunk-managed:codebase-memory-routing -->")
  })

  test("status returns available when binary missing but curl present", async () => {
    // No binary installed
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    const status = await component.status()

    // Should be available (curl exists on this system) or error (if no curl)
    expect(["available", "error"]).toContain(status.status)
  })

  test("install preserves existing MCP entries", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({
      plugin: [],
      mcp: {
        "context-mode": { command: ["context-mode"], type: "local", enabled: true },
      },
    })

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const cfg = readOpenCodeConfig()
    expect(cfg.mcp["context-mode"]).toBeDefined()
    expect(cfg.mcp["codebase-memory"]).toBeDefined()
  })

  test("uninstall removes MCP config and routing but preserves others", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({
      plugin: [],
      mcp: {
        "context-mode": { command: ["context-mode"], type: "local", enabled: true },
        "codebase-memory": { command: ["codebase-memory-mcp"], type: "local", enabled: true },
      },
    })

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    const result = await component.uninstall()

    expect(result.status).toBe("success")
    const cfg = readOpenCodeConfig()
    expect(cfg.mcp["context-mode"]).toBeDefined()
    expect(cfg.mcp["codebase-memory"]).toBeUndefined()
  })

  test("status returns installed when binary, routing, and MCP all present", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({
      mcp: { "codebase-memory": { command: ["codebase-memory-mcp"], type: "local", enabled: true } },
    })
    // Create routing file
    const instructionsDir = join(OPENCODE_DIR, "instructions")
    mkdirSync(instructionsDir, { recursive: true })
    writeFileSync(
      join(instructionsDir, "codebase-memory-routing.md"),
      "<!-- cyberpunk-managed:codebase-memory-routing -->\n# test\n",
      "utf8"
    )

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    const status = await component.status()

    expect(status.status).toBe("installed")
  })

  test("doctor reports pass when everything configured", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({
      mcp: { "codebase-memory": { command: ["codebase-memory-mcp"], type: "local", enabled: true } },
    })
    const instructionsDir = join(OPENCODE_DIR, "instructions")
    mkdirSync(instructionsDir, { recursive: true })
    writeFileSync(
      join(instructionsDir, "codebase-memory-routing.md"),
      "<!-- cyberpunk-managed:codebase-memory-routing -->\n# test\n",
      "utf8"
    )

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    const result = await component.doctor({ cyberpunkConfig: null, verbose: false, prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false } })

    expect(result.checks.every(c => c.status === "pass")).toBe(true)
  })

  test("doctor reports failures when nothing configured", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    const result = await component.doctor({ cyberpunkConfig: null, verbose: false, prerequisites: { ffmpeg: false, npm: false, bun: false, curl: false, git: false } })

    expect(result.checks.some(c => c.status === "fail")).toBe(true)
  })

  test("routing content includes key instructions", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("read")
    expect(content).toContain("stale")
    expect(content).toContain("search_graph")
    expect(content).toContain("Engram")
  })

  test("routing includes rule: index when starting work on a new repo", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("new repo")
    expect(content).toContain("index")
  })

  test("routing includes rule: verify index before major exploration", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("verify")
    expect(content).toContain("exploration")
  })

  test("routing includes rule: detect_changes or reindex after large changes", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("detect_changes")
    expect(content).toContain("reindex")
    expect(content).toContain("large changes")
  })

  test("routing includes rule: assume stale index when results seem off", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("stale")
    expect(content).toContain("unexpected")
  })

  test("routing includes Commit Boundary Rule section", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("Commit Boundary Rule")
    expect(content).toContain("Before Commit")
    expect(content).toContain("After Commit")
  })

  test("routing commit rule: detect_changes sufficient for trivial commits, reindex for significant", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("trivial")
    expect(content).toContain("significant")
  })

  test("routing preserves strong rule: read actual files before editing", async () => {
    installFakeBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({})

    const { getCodebaseMemoryComponent } = await import("../src/components/codebase-memory.ts?" + Date.now())
    const component = getCodebaseMemoryComponent()
    await component.install()

    const routingPath = join(OPENCODE_DIR, "instructions", "codebase-memory-routing.md")
    const content = readFileSync(routingPath, "utf8")
    expect(content).toContain("read actual files")
    expect(content).toContain("before editing")
  })
})
