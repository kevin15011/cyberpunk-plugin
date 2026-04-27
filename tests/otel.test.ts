// tests/otel.test.ts — verify otel component

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

const TEMP_HOME = join(tmpdir(), `cyberpunk-otel-test-${Date.now()}`)
const CYBERPUNK_CONFIG_DIR = join(TEMP_HOME, ".config", "cyberpunk")
const CYBERPUNK_CONFIG_PATH = join(CYBERPUNK_CONFIG_DIR, "config.json")
const OPENCODE_DIR = join(TEMP_HOME, ".config", "opencode")
const OPENCODE_CONFIG_PATH = join(OPENCODE_DIR, "opencode.json")
const BASHRC_PATH = join(TEMP_HOME, ".bashrc")
const ORIGINAL_HOME = process.env.HOME
const OTEL_PLUGIN_PACKAGE = "@devtheops/opencode-plugin-otel"
const LEGACY_OTEL_PLUGIN_PACKAGE = "opencode-plugin-otel"

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

describe("otel component", () => {
  beforeEach(() => {
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
  })

  afterEach(() => {
    process.env.HOME = ORIGINAL_HOME
    if (existsSync(TEMP_HOME)) rmSync(TEMP_HOME, { recursive: true, force: true })
  })

  test("install registers plugin in opencode.json", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [] })

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    const result = await component.install()

    expect(["success", "skipped"]).toContain(result.status)
    const cfg = readOpenCodeConfig()
    expect(cfg.plugin).toContain(OTEL_PLUGIN_PACKAGE)
  })

  test("install migrates unpublished legacy plugin package", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [LEGACY_OTEL_PLUGIN_PACKAGE, "./plugins/cyberpunk"] })

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    await component.install()

    const cfg = readOpenCodeConfig()
    expect(cfg.plugin).toContain(OTEL_PLUGIN_PACKAGE)
    expect(cfg.plugin).not.toContain(LEGACY_OTEL_PLUGIN_PACKAGE)
    expect(cfg.plugin).toContain("./plugins/cyberpunk")
  })

  test("install writes env block to .bashrc", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [] })
    writeFileSync(BASHRC_PATH, "# existing content\nexport PATH=$HOME/bin:$PATH\n", "utf8")

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    await component.install()

    const bashrc = readFileSync(BASHRC_PATH, "utf8")
    expect(bashrc).toContain("# >>> cyberpunk-managed:otel-env >>>")
    expect(bashrc).toContain("# <<< cyberpunk-managed:otel-env <<<")
    expect(bashrc).toContain('export OPENCODE_ENABLE_TELEMETRY="1"')
    expect(bashrc).toContain('export OPENCODE_OTLP_ENDPOINT="http://localhost:4317"')
    expect(bashrc).toContain('export OPENCODE_OTLP_PROTOCOL="grpc"')
    expect(bashrc).toContain('export OPENCODE_METRIC_PREFIX="opencode."')
    expect(bashrc).not.toContain("OPENCODE_OTLP_HEADERS")
    // Preserves existing content
    expect(bashrc).toContain("# existing content")
  })

  test("install is idempotent (no duplicate env blocks)", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [] })
    writeFileSync(BASHRC_PATH, "", "utf8")

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    await component.install()
    await component.install()

    const bashrc = readFileSync(BASHRC_PATH, "utf8")
    const markerCount = bashrc.split("# >>> cyberpunk-managed:otel-env >>>").length - 1
    expect(markerCount).toBe(1)
  })

  test("uninstall removes plugin and env block but preserves other content", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [OTEL_PLUGIN_PACKAGE, LEGACY_OTEL_PLUGIN_PACKAGE, "./plugins/cyberpunk"] })
    writeFileSync(BASHRC_PATH, "# my stuff\n# >>> cyberpunk-managed:otel-env >>>\nexport OPENCODE_ENABLE_TELEMETRY=1\n# <<< cyberpunk-managed:otel-env <<<\n# more stuff\n", "utf8")

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    const result = await component.uninstall()

    expect(result.status).toBe("success")
    const cfg = readOpenCodeConfig()
    expect(cfg.plugin).not.toContain(OTEL_PLUGIN_PACKAGE)
    expect(cfg.plugin).not.toContain(LEGACY_OTEL_PLUGIN_PACKAGE)
    expect(cfg.plugin).toContain("./plugins/cyberpunk")
    const bashrc = readFileSync(BASHRC_PATH, "utf8")
    expect(bashrc).not.toContain("cyberpunk-managed:otel-env")
    expect(bashrc).toContain("# my stuff")
    expect(bashrc).toContain("# more stuff")
  })

  test("status returns installed when plugin and env present", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [OTEL_PLUGIN_PACKAGE] })
    writeFileSync(BASHRC_PATH, "# >>> cyberpunk-managed:otel-env >>>\n# <<< cyberpunk-managed:otel-env <<<\n", "utf8")

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    const status = await component.status()

    expect(status.status).toBe("installed")
  })

  test("status returns available when nothing configured", async () => {
    writeCyberpunkConfig()
    writeOpenCodeConfig({ plugin: [] })

    const { getOtelComponent } = await import("../src/components/otel.ts?" + Date.now())
    const component = getOtelComponent()
    const status = await component.status()

    expect(status.status).toBe("available")
  })

  test("env block helper works correctly", async () => {
    const { buildEnvBlock, addEnvBlock, removeEnvBlock, isEnvBlockPresent } = await import("../src/components/otel.ts?" + Date.now())

    const block = buildEnvBlock()
    expect(block).toContain("OPENCODE_ENABLE_TELEMETRY")
    expect(block).not.toContain("OPENCODE_OTLP_HEADERS")

    const original = "# my content\n"
    const withBlock = addEnvBlock(original)
    expect(isEnvBlockPresent(withBlock)).toBe(true)
    expect(withBlock).toContain("# my content")

    const removed = removeEnvBlock(withBlock)
    expect(isEnvBlockPresent(removed)).toBe(false)
    expect(removed).toContain("# my content")
  })
})

// ────────────────────────────────────────────────────────────────────
// Bug fix: otel:endpoint doctor check should return pass when port listens
// ────────────────────────────────────────────────────────────────────

describe("otel: parseEndpointPort (pure helper)", () => {
  test("extracts port from http://localhost:4317", async () => {
    const { parseEndpointPort } = await import("../src/components/otel.ts?" + Date.now())
    expect(parseEndpointPort("http://localhost:4317")).toBe(4317)
  })

  test("extracts port from http://127.0.0.1:4318", async () => {
    const { parseEndpointPort } = await import("../src/components/otel.ts?" + Date.now())
    expect(parseEndpointPort("http://127.0.0.1:4318")).toBe(4318)
  })

  test("extracts port from http://0.0.0.0:55690", async () => {
    const { parseEndpointPort } = await import("../src/components/otel.ts?" + Date.now())
    expect(parseEndpointPort("http://0.0.0.0:55690")).toBe(55690)
  })

  test("returns null for URL without port", async () => {
    const { parseEndpointPort } = await import("../src/components/otel.ts?" + Date.now())
    expect(parseEndpointPort("http://localhost")).toBeNull()
  })

  test("returns null for empty string", async () => {
    const { parseEndpointPort } = await import("../src/components/otel.ts?" + Date.now())
    expect(parseEndpointPort("")).toBeNull()
  })

  test("returns null for malformed input", async () => {
    const { parseEndpointPort } = await import("../src/components/otel.ts?" + Date.now())
    expect(parseEndpointPort("not-a-url")).toBeNull()
  })
})

describe("otel: buildEndpointCheck (pure helper)", () => {
  test("returns pass when port is listening", async () => {
    const { buildEndpointCheck } = await import("../src/components/otel.ts?" + Date.now())
    const check = buildEndpointCheck(true, "http://localhost:4317")
    expect(check.status).toBe("pass")
    expect(check.id).toBe("otel:endpoint")
    expect(check.message).toMatch(/4317/)
  })

  test("returns warn when port is NOT listening", async () => {
    const { buildEndpointCheck } = await import("../src/components/otel.ts?" + Date.now())
    const check = buildEndpointCheck(false, "http://localhost:4317")
    expect(check.status).toBe("warn")
    expect(check.id).toBe("otel:endpoint")
    expect(check.message).toMatch(/4317/)
  })

  test("pass message mentions endpoint activo", async () => {
    const { buildEndpointCheck } = await import("../src/components/otel.ts?" + Date.now())
    const check = buildEndpointCheck(true, "http://localhost:4317")
    expect(check.message.toLowerCase()).toMatch(/activo|listening|escuchando/)
  })

  test("warn message is actionable (mentions starting collector)", async () => {
    const { buildEndpointCheck } = await import("../src/components/otel.ts?" + Date.now())
    const check = buildEndpointCheck(false, "http://localhost:4317")
    expect(check.message.toLowerCase()).toMatch(/inici|collector|no escucha/)
  })

  test("uses endpoint in label", async () => {
    const { buildEndpointCheck } = await import("../src/components/otel.ts?" + Date.now())
    const check = buildEndpointCheck(true, "http://localhost:4317")
    expect(check.label).toContain("4317")
  })
})
