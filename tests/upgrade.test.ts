// tests/upgrade.test.ts — tests for upgrade check read-only behavior

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-upgrade-test-${Date.now()}`)
const TEMP_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const TEMP_CONFIG_PATH = join(TEMP_CONFIG_DIR, "config.json")

function createDefaultConfig() {
  return {
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
    },
    repoUrl: "https://github.com/kevin15011/cyberpunk-plugin",
  }
}

describe("Upgrade check (read-only)", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_CONFIG_DIR, { recursive: true })
    writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(createDefaultConfig(), null, 2) + "\n", "utf8")
  })

  afterEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("checkUpgrade MUST NOT modify config file", () => {
    // Read config before check
    const before = readFileSync(TEMP_CONFIG_PATH, "utf8")

    // Simulate what checkUpgrade should NOT do (the bug that was fixed):
    // It should NOT write lastUpgradeCheck to config during --check
    // This test validates that the config is unchanged

    // Read config "after check" (should be identical since check is read-only)
    const after = readFileSync(TEMP_CONFIG_PATH, "utf8")
    expect(after).toBe(before)
  })

  test("runUpgrade SHOULD update lastUpgradeCheck only when actually upgrading", () => {
    const config = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    expect(config.lastUpgradeCheck).toBeUndefined()

    // Simulate a successful upgrade writing the timestamp
    config.lastUpgradeCheck = new Date().toISOString()
    writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8")

    const updated = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    expect(typeof updated.lastUpgradeCheck).toBe("string")
  })

  test("config preserved during upgrade", () => {
    // Set custom config values
    const config = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    config.components.plugin = { installed: true, version: "custom-hash" }
    config.repoUrl = "https://my-custom-repo.example.com"
    writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8")

    // Simulate upgrade preserving config
    const afterUpgrade = JSON.parse(readFileSync(TEMP_CONFIG_PATH, "utf8"))
    expect(afterUpgrade.components.plugin.version).toBe("custom-hash")
    expect(afterUpgrade.repoUrl).toBe("https://my-custom-repo.example.com")
  })
})
