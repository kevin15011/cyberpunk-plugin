// tests/tui-router.test.ts — unit tests for router push/pop/replace/back/quit

import { describe, expect, test } from "bun:test"
import { pushRoute, popRoute, replaceRoute, currentRoute, canGoBack, handleBackOrQuit, route, initialState } from "../src/tui/router"
import type { TUIState } from "../src/tui/types"

function makeState(overrides?: Partial<TUIState>): TUIState {
  return {
    statuses: [],
    route: route("home"),
    history: [],
    selectedComponents: [],
    cursor: 0,
    quit: false,
    ...overrides,
  }
}

describe("router — pushRoute", () => {
  test("pushes new route and preserves history", () => {
    const s = makeState()
    const next = pushRoute(s, route("install"))
    expect(next.route.id).toBe("install")
    expect(next.history).toHaveLength(1)
    expect(next.history[0].id).toBe("home")
  })

  test("pushes multiple routes maintaining full history", () => {
    let s = makeState()
    s = pushRoute(s, route("install"))
    s = pushRoute(s, route("task", { action: "install" }))
    expect(s.route.id).toBe("task")
    expect(s.history).toHaveLength(2)
    expect(s.history[0].id).toBe("home")
    expect(s.history[1].id).toBe("install")
  })

  test("resets cursor on push", () => {
    let s = makeState({ cursor: 5 })
    s = pushRoute(s, route("status"))
    expect(s.cursor).toBe(0)
  })

  test("clears message on push", () => {
    let s = makeState({ message: "some error" })
    s = pushRoute(s, route("install"))
    expect(s.message).toBeUndefined()
  })
})

describe("router — popRoute", () => {
  test("pops back to previous route", () => {
    let s = makeState()
    s = pushRoute(s, route("install"))
    s = popRoute(s)
    expect(s.route.id).toBe("home")
    expect(s.history).toHaveLength(0)
  })

  test("sets quit when no history", () => {
    const s = makeState()
    const result = popRoute(s)
    expect(result.quit).toBe(true)
  })

  test("pops through multiple levels", () => {
    let s = makeState()
    s = pushRoute(s, route("install"))
    s = pushRoute(s, route("task", { action: "install" }))
    s = pushRoute(s, route("results"))
    s = popRoute(s)
    expect(s.route.id).toBe("task")
    s = popRoute(s)
    expect(s.route.id).toBe("install")
    s = popRoute(s)
    expect(s.route.id).toBe("home")
    expect(s.history).toHaveLength(0)
  })

  test("resets cursor on pop", () => {
    let s = makeState()
    s = pushRoute(s, route("install"))
    s = { ...s, cursor: 3 }
    s = popRoute(s)
    expect(s.cursor).toBe(0)
  })
})

describe("router — replaceRoute", () => {
  test("replaces current route without adding history", () => {
    const s = makeState()
    const replaced = replaceRoute(s, route("status"))
    expect(replaced.route.id).toBe("status")
    expect(replaced.history).toHaveLength(0)
  })

  test("preserves existing history", () => {
    let s = makeState()
    s = pushRoute(s, route("install"))
    s = replaceRoute(s, route("uninstall"))
    expect(s.route.id).toBe("uninstall")
    expect(s.history).toHaveLength(1)
    expect(s.history[0].id).toBe("home")
  })

  test("resets cursor on replace", () => {
    let s = makeState({ cursor: 5 })
    s = replaceRoute(s, route("status"))
    expect(s.cursor).toBe(0)
  })
})

describe("router — currentRoute", () => {
  test("returns the active route", () => {
    const s = makeState({ route: route("status") })
    expect(currentRoute(s).id).toBe("status")
  })
})

describe("router — canGoBack", () => {
  test("false when no history", () => {
    expect(canGoBack(makeState())).toBe(false)
  })

  test("true when history exists", () => {
    const s = makeState({ history: [route("home")] })
    expect(canGoBack(s)).toBe(true)
  })
})

describe("router — handleBackOrQuit", () => {
  test("pops when history exists", () => {
    let s = makeState()
    s = pushRoute(s, route("install"))
    s = handleBackOrQuit(s)
    expect(s.route.id).toBe("home")
    expect(s.quit).toBe(false)
  })

  test("sets quit when no history", () => {
    const s = makeState()
    const result = handleBackOrQuit(s)
    expect(result.quit).toBe(true)
  })
})

describe("router — initialState", () => {
  test("creates state with home route and empty history", () => {
    const s = initialState([])
    expect(s.route.id).toBe("home")
    expect(s.history).toHaveLength(0)
    expect(s.cursor).toBe(0)
    expect(s.quit).toBe(false)
    expect(s.selectedComponents).toHaveLength(0)
  })

  test("stores provided statuses", () => {
    const statuses = [
      { id: "plugin" as const, label: "Plugin", status: "installed" as const },
    ]
    const s = initialState(statuses)
    expect(s.statuses).toHaveLength(1)
    expect(s.statuses[0].id).toBe("plugin")
  })
})
