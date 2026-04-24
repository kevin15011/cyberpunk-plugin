import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

type InstallMode = "repo" | "binary"

type ComponentState = {
  installed: boolean
  version?: string
  installedAt?: string
  path?: string
}

type TestConfigOverrides = {
  installMode?: InstallMode
  components?: Partial<Record<"plugin" | "theme" | "sounds" | "context-mode" | "rtk" | "tmux", ComponentState>>
  [key: string]: unknown
}

export function createTempHome(prefix: string) {
  const home = mkdtempSync(join(tmpdir(), `${prefix}-`))
  const configDir = join(home, ".config", "cyberpunk")
  const configPath = join(configDir, "config.json")

  return {
    home,
    configDir,
    configPath,
    cleanup() {
      rmSync(home, { recursive: true, force: true })
    },
  }
}

export function setDefaultConfig(dir: string, overrides: TestConfigOverrides = {}) {
  const configPath = join(dir, "config.json")
  const { components: componentOverrides, ...restOverrides } = overrides
  const baseConfig = {
    version: 1,
    components: {
      plugin: { installed: false },
      theme: { installed: false },
      sounds: { installed: false },
      "context-mode": { installed: false },
      rtk: { installed: false },
      tmux: { installed: false },
      ...componentOverrides,
    },
    repoUrl: "https://github.com/kevin15011/cyberpunk-plugin",
    ...restOverrides,
  }

  mkdirSync(dir, { recursive: true })
  writeFileSync(configPath, JSON.stringify(baseConfig, null, 2) + "\n", "utf8")

  return configPath
}

export async function importAfterHomeSet<T>(modulePath: string, home = process.env.HOME): Promise<T> {
  const originalHome = process.env.HOME

  try {
    if (home !== undefined) {
      process.env.HOME = home
    } else {
      delete process.env.HOME
    }

    return await import(`${modulePath}?t=${Date.now()}`) as T
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
  }
}
