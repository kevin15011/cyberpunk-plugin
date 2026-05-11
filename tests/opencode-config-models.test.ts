// tests/opencode-config-models.test.ts — OpenCode model catalog/config helpers

import { describe, expect, test } from "bun:test"
import { configureSddReviewModel, ensureSddReviewAdversaryAgent, ensureSddReviewTaskPermission, getConfiguredSddReviewModel, getOpenCodeConfigPath, listConfiguredOpenCodeModels, parseOpenCodeModelListOutput, readOpenCodeConfig, removePrimaryClaudeReviewAgent } from "../src/opencode-config"
import { afterEach } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { tmpdir } from "os"

const ORIGINAL_HOME = process.env.HOME
let tempHome = ""

afterEach(() => {
  if (ORIGINAL_HOME === undefined) delete process.env.HOME
  else process.env.HOME = ORIGINAL_HOME
  if (tempHome && existsSync(tempHome)) rmSync(tempHome, { recursive: true, force: true })
  tempHome = ""
})

describe("opencode-config model helpers", () => {
  test("lists custom provider models and configured agent models grouped by provider", () => {
    const providers = listConfiguredOpenCodeModels({
      provider: {
        custom: {
          name: "Custom Provider",
          models: {
            "fast-model": { name: "Fast Model" },
          },
        },
      },
      agent: {
        "sdd-review": { model: "openai/gpt-5.5" },
      },
    })

    expect(providers.find(provider => provider.providerId === "custom")?.models[0]?.modelRef).toBe("custom/fast-model")
    expect(providers.find(provider => provider.providerId === "openai")?.models[0]?.modelRef).toBe("openai/gpt-5.5")
  })

  test("removes only the primary claude review agent", () => {
    const config = {
      agent: {
        "sdd-claude-review": { model: "anthropic/opus" },
        "sdd-claude-review-intranet": { model: "anthropic/opus" },
      },
    }

    expect(removePrimaryClaudeReviewAgent(config)).toBe(true)
    expect(config.agent["sdd-claude-review"]).toBeUndefined()
    expect(config.agent["sdd-claude-review-intranet"]).toBeDefined()
  })

  test("parses full opencode models output grouped by provider", () => {
    const providers = parseOpenCodeModelListOutput(`
openai/gpt-5.5
openai/gpt-5.5-fast  Fast model
zai-coding-plan/glm-5.1
noise line with spaces
`)

    expect(providers.find(provider => provider.providerId === "openai")?.models.map(model => model.modelRef)).toEqual([
      "openai/gpt-5.5",
      "openai/gpt-5.5-fast",
    ])
    expect(providers.find(provider => provider.providerId === "zai-coding-plan")?.models[0]?.modelRef).toBe("zai-coding-plan/glm-5.1")
  })

  test("allows gentle orchestrator to launch sdd-review", () => {
    const config = { agent: { "gentle-orchestrator": { permission: { task: { "*": "deny" } } } } }

    expect(ensureSddReviewTaskPermission(config)).toBe(true)
    expect(config.agent["gentle-orchestrator"].permission.task["sdd-review"]).toBe("allow")
    expect(config.agent["gentle-orchestrator"].permission.task["sdd-review-adversary"]).toBe("allow")
  })

  test("creates sdd-review-adversary from primary review agent", () => {
    const config = { agent: { "sdd-review": { model: "openai/gpt-5.5", prompt: "{file:test}", tools: { read: true } } } }

    expect(ensureSddReviewAdversaryAgent(config)).toBe(true)
    expect(config.agent["sdd-review-adversary"].model).toBe("openai/gpt-5.5")
    expect(config.agent["sdd-review-adversary"].prompt).toBe("{file:test}")
  })

  test("rejects invalid sdd-review model refs", () => {
    const result = configureSddReviewModel("missing-provider-prefix")
    expect(result.changed).toBe(false)
    expect(result.warning).toContain("Invalid")
  })

  test("does not overwrite corrupted opencode.json", () => {
    tempHome = join(tmpdir(), `cyberpunk-opencode-config-${Date.now()}-${Math.random()}`)
    process.env.HOME = tempHome
    const configPath = getOpenCodeConfigPath()
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, "{ invalid json", "utf8")

    const result = configureSddReviewModel("openai/gpt-5.5")

    expect(result.changed).toBe(false)
    expect(result.warning).toContain("refusing to overwrite")
  })

  test("does not overwrite non-object opencode.json", () => {
    tempHome = join(tmpdir(), `cyberpunk-opencode-config-${Date.now()}-${Math.random()}`)
    process.env.HOME = tempHome
    const configPath = getOpenCodeConfigPath()
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, "null", "utf8")

    const result = configureSddReviewModel("openai/gpt-5.5")

    expect(result.changed).toBe(false)
    expect(result.warning).toContain("refusing to overwrite")
    expect(readOpenCodeConfig()).toBeNull()
  })

  test("configured sdd-review model must be a valid provider/model ref", () => {
    expect(getConfiguredSddReviewModel({ agent: { "sdd-review": { model: "missing-provider-prefix" } } })).toBeUndefined()
    expect(getConfiguredSddReviewModel({ agent: { "sdd-review": { model: "openai/gpt-5.5" } } })).toBe("openai/gpt-5.5")
    expect(getConfiguredSddReviewModel({ agent: { "sdd-review-adversary": { model: "opencode-go/kimi-k2.6" } } }, "sdd-review-adversary")).toBe("opencode-go/kimi-k2.6")
  })
})
