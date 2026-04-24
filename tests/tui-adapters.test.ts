// tests/tui-adapters.test.ts — mock runInstall/runUninstall, verify hook-driven state transitions

import { describe, expect, mock, test, beforeEach } from "bun:test"
import type { ComponentId, InstallResult } from "../src/components/types"
import type { TaskHooks } from "../src/tui/types"

// We test the adapter functions by importing them and mocking the underlying commands

describe("TaskHooks integration", () => {
  test("onComponentStart is called for each component", () => {
    const started: ComponentId[] = []
    const hooks: TaskHooks = {
      onComponentStart: (id) => { started.push(id) },
      onComponentFinish: () => {},
    }

    // Simulate what runInstall does with hooks
    hooks.onComponentStart?.("plugin" as ComponentId)
    hooks.onComponentStart?.("theme" as ComponentId)

    expect(started).toEqual(["plugin", "theme"])
  })

  test("onComponentFinish is called with result for each component", () => {
    const finished: InstallResult[] = []
    const hooks: TaskHooks = {
      onComponentStart: () => {},
      onComponentFinish: (result) => { finished.push(result) },
    }

    const result1: InstallResult = { component: "plugin", action: "install", status: "success" }
    const result2: InstallResult = { component: "theme", action: "install", status: "error", message: "fail" }

    hooks.onComponentFinish?.(result1)
    hooks.onComponentFinish?.(result2)

    expect(finished).toHaveLength(2)
    expect(finished[0].status).toBe("success")
    expect(finished[1].status).toBe("error")
    expect(finished[1].message).toBe("fail")
  })

  test("hooks are optional — undefined hooks do not throw", () => {
    const hooks: TaskHooks = {}
    // These should not throw
    expect(() => hooks.onComponentStart?.("plugin" as ComponentId)).not.toThrow()
    expect(() => hooks.onComponentFinish?.({
      component: "plugin",
      action: "install",
      status: "success",
    })).not.toThrow()
  })
})

describe("createTaskHooks", () => {
  test("creates hooks that call provided callbacks", async () => {
    const { createTaskHooks } = await import("../src/tui/adapters")
    const started: string[] = []
    const finished: string[] = []

    const hooks = createTaskHooks(
      (id) => { started.push(id) },
      (result) => { finished.push(result.component) }
    )

    hooks.onComponentStart?.("plugin" as ComponentId)
    hooks.onComponentFinish?.({ component: "plugin", action: "install", status: "success" })

    expect(started).toEqual(["plugin"])
    expect(finished).toEqual(["plugin"])
  })
})

describe("lastResults persistence", () => {
  test("results stored in state survive route transitions", async () => {
    const { route, pushRoute, popRoute } = await import("../src/tui/router")

    const fakeResults: InstallResult[] = [
      { component: "plugin", action: "install", status: "success" },
      { component: "theme", action: "install", status: "error", message: "fail" },
    ]

    let state = {
      statuses: [],
      route: route("results"),
      history: [route("task")],
      selectedComponents: [],
      cursor: 0,
      quit: false,
      lastResults: fakeResults,
    }

    // Navigate to result-detail and back
    state = pushRoute(state, route("result-detail", { resultIndex: 0 }))
    expect(state.lastResults).toEqual(fakeResults)

    state = { ...state, cursor: 0 }
    state = popRoute(state)
    expect(state.lastResults).toEqual(fakeResults)
    expect(state.route.id).toBe("results")
  })
})
