// tests/context-mode-routing.test.ts — behavioral tests for less aggressive context-mode routing

import { describe, test, expect } from "bun:test"

const loadContextModeModule = () => import(`../src/components/context-mode.ts?routing=${Date.now()}-${Math.random()}`)

describe("context-mode routing template", () => {
  test("exports a routing template string", async () => {
    const mod = await loadContextModeModule()
    expect("CONTEXT_MODE_ROUTING" in mod).toBe(true)
    expect(typeof (mod as Record<string, unknown>).CONTEXT_MODE_ROUTING).toBe("string")
  })

  test("does not recommend ctx_batch_execute by default", async () => {
    const mod = await loadContextModeModule()
    const routing = String((mod as Record<string, unknown>).CONTEXT_MODE_ROUTING ?? "")

    expect(routing).not.toContain("Use `ctx_batch_execute` by default")
    expect(routing).toContain("only when the output is genuinely large")
  })

  test("keeps native tools first for focused work and RTK for verbose CLI output", async () => {
    const mod = await loadContextModeModule()
    const routing = String((mod as Record<string, unknown>).CONTEXT_MODE_ROUTING ?? "")

    expect(routing).toContain("Use `glob` and `grep` for targeted discovery")
    expect(routing).toContain("Use `read` when you need the actual contents of 1-3 files")
    expect(routing).toContain("Prefer `rtk` when the main problem is verbose CLI output")
  })
})
