// tests/installer-auto-deps.test.ts — automatic dependency bootstrap for installer components

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const actualDetect = await import("../src/platform/detect")
const actualChildProcess = await import("node:child_process")

const TEMP_HOME = join(tmpdir(), `cyberpunk-auto-deps-${Date.now()}`)
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const CYBERPUNK_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const ORIGINAL_HOME = process.env.HOME
const ORIGINAL_PATH = process.env.PATH

function seedConfig() {
  mkdirSync(CYBERPUNK_CONFIG_DIR, { recursive: true })
  writeFileSync(join(CYBERPUNK_CONFIG_DIR, "config.json"), JSON.stringify({ version: 2, components: {} }, null, 2), "utf8")
  mkdirSync(OPENCODE_DIR, { recursive: true })
  writeFileSync(join(OPENCODE_DIR, "opencode.json"), JSON.stringify({ plugin: [], mcp: {} }, null, 2), "utf8")
}

function makeExecutable(path: string, content = "#!/bin/sh\nexit 0\n") {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, content, "utf8")
  chmodSync(path, 0o755)
}

describe("installer automatic dependency bootstrap", () => {
  beforeEach(() => {
    rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
    process.env.PATH = join(TEMP_HOME, "empty-path")
    seedConfig()
  })

  afterEach(() => {
    mock.restore()
    process.env.HOME = ORIGINAL_HOME
    process.env.PATH = ORIGINAL_PATH
    rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("sounds installs ffmpeg with Homebrew on macOS before generating files", async () => {
    const commands: string[] = []

    mock.module("../src/platform/detect", () => ({
      ...actualDetect,
      detectEnvironment: mock(() => "darwin"),
      isWSL: mock(() => false),
    }))

    mock.module("child_process", () => ({
      ...actualChildProcess,
      execSync: mock((command: string) => {
        commands.push(command)
        if (command.includes("which ffmpeg") && !commands.some(c => c.includes("brew install ffmpeg"))) {
          throw new Error("ffmpeg missing")
        }
        if (command.includes("which brew")) return "/opt/homebrew/bin/brew\n"
        return ""
      }),
    }))

    const { getSoundsComponent } = await import(`../src/components/sounds.ts?auto=${Date.now()}-${Math.random()}`)

    const result = await getSoundsComponent().install()

    expect(result.status).toBe("success")
    expect(commands.some(command => command.includes("brew install ffmpeg"))).toBe(true)
  })

  test("sounds installs Homebrew first on macOS when brew is missing", async () => {
    const commands: string[] = []

    mock.module("../src/platform/detect", () => ({
      ...actualDetect,
      detectEnvironment: mock(() => "darwin"),
      isWSL: mock(() => false),
    }))

    mock.module("child_process", () => ({
      ...actualChildProcess,
      execSync: mock((command: string) => {
        commands.push(command)
        if (command.includes("which ffmpeg") && !commands.some(c => c.includes("brew install ffmpeg"))) {
          throw new Error("ffmpeg missing")
        }
        if (command.includes("which brew") && !commands.some(c => c.includes("Homebrew/install"))) {
          throw new Error("brew missing")
        }
        return ""
      }),
    }))

    const { getSoundsComponent } = await import(`../src/components/sounds.ts?auto=${Date.now()}-${Math.random()}`)

    const result = await getSoundsComponent().install()

    expect(result.status).toBe("success")
    expect(commands.some(command => command.includes("Homebrew/install"))).toBe(true)
    expect(commands.some(command => command.includes("brew install ffmpeg"))).toBe(true)
  })

  test("context-mode falls back to a user npm prefix when global install is not permitted", async () => {
    const commands: string[] = []

    mock.module("child_process", () => ({
      ...actualChildProcess,
      execSync: mock((command: string) => {
        commands.push(command)
        if (command.includes("which npm")) return "/usr/local/bin/npm\n"
        if (command.includes("which context-mode")) throw new Error("context-mode missing")
        if (command === "npm install -g context-mode") throw new Error("EACCES permission denied")
        return ""
      }),
    }))

    const { getContextModeComponent } = await import(`../src/components/context-mode.ts?auto=${Date.now()}-${Math.random()}`)

    const result = await getContextModeComponent().install()

    expect(result.status).toBe("success")
    expect(commands.some(command => command.includes("npm install -g context-mode --prefix"))).toBe(true)
    expect(process.env.PATH).toContain(join(TEMP_HOME, ".local", "npm-global", "bin"))
  })

  test("codebase-memory can bootstrap through wget when curl is unavailable", async () => {
    const commands: string[] = []

    mock.module("child_process", () => ({
      ...actualChildProcess,
      execSync: mock((command: string) => {
        commands.push(command)
        if (command.includes("which curl")) throw new Error("curl missing")
        if (command.includes("which wget")) return "/usr/bin/wget\n"
        if (command.includes("wget") && command.includes("codebase-memory-mcp")) {
          makeExecutable(join(TEMP_HOME, ".local", "bin", "codebase-memory-mcp"))
        }
        return ""
      }),
    }))

    const { getCodebaseMemoryComponent } = await import(`../src/components/codebase-memory.ts?auto=${Date.now()}-${Math.random()}`)

    const result = await getCodebaseMemoryComponent().install()

    expect(result.status).toBe("success")
    expect(existsSync(join(TEMP_HOME, ".local", "bin", "codebase-memory-mcp"))).toBe(true)
    expect(commands.some(command => command.includes("wget") && command.includes("install.sh"))).toBe(true)
  })
})
