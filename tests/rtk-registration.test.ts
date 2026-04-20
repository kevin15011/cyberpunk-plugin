// tests/rtk-registration.test.ts — verify RTK component registers/unregisters OpenCode plugin entry

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-rtk-test-${Date.now()}`)
const CYBERPUNK_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const CYBERPUNK_CONFIG_PATH = join(CYBERPUNK_CONFIG_DIR, "config.json")
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const OPENCODE_CONFIG_PATH = join(OPENCODE_DIR, "opencode.json")
const LOCAL_BIN_DIR = join(TEMP_HOME, ".local", "bin")
const LOCAL_RTK_PATH = join(LOCAL_BIN_DIR, "rtk")
const ORIGINAL_HOME = process.env.HOME

function writeCyberpunkConfig() {
  mkdirSync(CYBERPUNK_CONFIG_DIR, { recursive: true })
  writeFileSync(
    CYBERPUNK_CONFIG_PATH,
    JSON.stringify({
      version: 1,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
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

function installFakeRtkBinary() {
  mkdirSync(LOCAL_BIN_DIR, { recursive: true })
  writeFileSync(LOCAL_RTK_PATH, "#!/bin/sh\nexit 0\n", "utf8")
  chmodSync(LOCAL_RTK_PATH, 0o755)
}

describe("RTK OpenCode plugin registration", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
  })

  afterEach(() => {
    process.env.HOME = ORIGINAL_HOME
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("install registers ./plugins/rtk in opencode.json", async () => {
    installFakeRtkBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: ["./plugins/cyberpunk"] })

    const { getRtkComponent } = await import("../src/components/rtk.ts?" + Date.now())
    const component = getRtkComponent()
    const result = await component.install()

    expect(["success", "skipped"]).toContain(result.status)
    expect(readOpenCodeConfig().plugin).toEqual(["./plugins/cyberpunk", "./plugins/rtk"])
  })

  test("uninstall unregisters ./plugins/rtk from opencode.json", async () => {
    installFakeRtkBinary()
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: ["./plugins/cyberpunk", "./plugins/rtk", "./plugins/other"] })

    const { getRtkComponent } = await import("../src/components/rtk.ts?" + Date.now())
    const component = getRtkComponent()
    const result = await component.uninstall()

    expect(result.status).toBe("success")
    expect(readOpenCodeConfig().plugin).toEqual(["./plugins/cyberpunk", "./plugins/other"])
  })
})
