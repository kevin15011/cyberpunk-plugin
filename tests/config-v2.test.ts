// tests/config-v2.test.ts — RED: load v1 JSON, assert normalizeConfig() adds
// target: "opencode", profile: undefined, missing components get defaults;
// v2 JSON loads unchanged.

import { describe, test, expect } from "bun:test"
import type { CyberpunkConfig } from "../src/config/schema"

// ============================================================================
// Task 3.3 — Config v2 normalization and backward compatibility
// ============================================================================

describe("normalizeConfig()", () => {
  test("adds target 'opencode' when missing from v1 config", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const v1Config: CyberpunkConfig = {
      version: 1,
      components: {
        plugin: { installed: true, version: "bundled" },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
    }

    const normalized = normalizeConfig(v1Config)
    expect(normalized.target).toBe("opencode")
  })

  test("preserves existing target when v2 config already has one", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const v2Config: CyberpunkConfig = {
      version: 2,
      components: {
        plugin: { installed: true },
        theme: { installed: true },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
      target: "claude",
      profile: "developer",
    }

    const normalized = normalizeConfig(v2Config)
    expect(normalized.target).toBe("claude")
    expect(normalized.profile).toBe("developer")
  })

  test("adds default component entries when some are missing", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const partialConfig = {
      version: 1,
      components: {
        plugin: { installed: true },
      },
    } as unknown as CyberpunkConfig

    const normalized = normalizeConfig(partialConfig)
    expect(normalized.components.plugin.installed).toBe(true)
    expect(normalized.components.theme).toEqual({ installed: false })
    expect(normalized.components.sounds).toEqual({ installed: false })
    expect(normalized.components["context-mode"]).toEqual({ installed: false })
    expect(normalized.components.rtk).toEqual({ installed: false })
    expect(normalized.components.tmux).toEqual({ installed: false })
  })

  test("does not mutate the original config object", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const original: CyberpunkConfig = {
      version: 1,
      components: {
        plugin: { installed: true },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
    }

    const originalCopy = JSON.parse(JSON.stringify(original))
    normalizeConfig(original)

    expect(original).toEqual(originalCopy)
  })

  test("normalizes installMode to 'repo' when missing", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const config: CyberpunkConfig = {
      version: 1,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
    }

    const normalized = normalizeConfig(config)
    expect(normalized.installMode).toBe("repo")
  })

  test("preserves existing installMode when set", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const config: CyberpunkConfig = {
      version: 1,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
      installMode: "binary",
    }

    const normalized = normalizeConfig(config)
    expect(normalized.installMode).toBe("binary")
  })

  test("v2 config with agentState loads unchanged", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const v2Full: CyberpunkConfig = {
      version: 2,
      components: {
        plugin: { installed: true, version: "bundled", path: "/home/test/.config/opencode/plugins/cyberpunk.ts" },
        theme: { installed: true, version: "1.0" },
        sounds: { installed: true },
        "context-mode": { installed: true },
        rtk: { installed: true },
        tmux: { installed: false },
      },
      target: "opencode",
      profile: "admin",
      installMode: "repo",
      agentState: {
        opencode: { installed: true, version: "1.0.0" },
        claude: { installed: false },
        codex: { installed: false },
      },
    }

    const normalized = normalizeConfig(v2Full)
    expect(normalized.target).toBe("opencode")
    expect(normalized.profile).toBe("admin")
    expect(normalized.agentState).toEqual(v2Full.agentState)
    expect(normalized.version).toBe(2)
  })

  test("adds empty agentState when missing from v1 config", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const v1: CyberpunkConfig = {
      version: 1,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
    }

    const normalized = normalizeConfig(v1)
    expect(normalized.agentState).toEqual({})
  })

  test("upgrades version to 2 when v1 config is normalized", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const v1: CyberpunkConfig = {
      version: 1,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
    }

    const normalized = normalizeConfig(v1)
    expect(normalized.version).toBe(2)
  })

  test("keeps version 2 when already v2", async () => {
    const { normalizeConfig } = await import(`../src/config/load.ts?t=${Date.now()}`)

    const v2: CyberpunkConfig = {
      version: 2,
      components: {
        plugin: { installed: false },
        theme: { installed: false },
        sounds: { installed: false },
        "context-mode": { installed: false },
        rtk: { installed: false },
        tmux: { installed: false },
      },
      target: "opencode",
    }

    const normalized = normalizeConfig(v2)
    expect(normalized.version).toBe(2)
  })
})

describe("createDefaultConfig() v2", () => {
  test("creates config with version 2 and target opencode", async () => {
    const { createDefaultConfig } = await import(`../src/config/schema.ts?t=${Date.now()}`)

    const config = createDefaultConfig()
    expect(config.version).toBe(2)
    expect(config.target).toBe("opencode")
    expect(config.profile).toBeUndefined()
    expect(config.agentState).toEqual({})
  })

  test("creates config with all 6 component entries defaulting to installed: false", async () => {
    const { createDefaultConfig, COMPONENT_IDS } = await import(`../src/config/schema.ts?t=${Date.now()}`)

    const config = createDefaultConfig()
    for (const id of COMPONENT_IDS) {
      expect(config.components[id]).toBeDefined()
      expect(config.components[id].installed).toBe(false)
    }
  })
})
