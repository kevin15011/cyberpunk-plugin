// tests/domain-environment.test.ts — assert discriminated unions compile and enforce exhaustiveness

import { describe, test, expect } from "bun:test"
import type {
  AgentTarget,
  UserProfile,
  PlatformInfo,
  ShellInfo,
  ComponentCapability,
  DetectionResult,
  Recommendation,
} from "../src/domain/environment"
import type { ComponentId } from "../src/components/types"

// Runtime import to verify the module actually exports values/types
import {
  AGENT_TARGETS,
  PLATFORM_KINDS,
  SHELL_KINDS,
  CAPABILITY_STATUSES,
  RECOMMENDATION_ACTIONS,
  RECOMMENDATION_PRIORITIES,
  USER_PROFILES,
} from "../src/domain/environment"

// --- Exhaustiveness helpers ---

function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union value: ${String(value)}`)
}

// --- Module export existence ---

describe("domain/environment module exports", () => {
  test("AGENT_TARGETS constant array exists and has all targets", () => {
    expect(AGENT_TARGETS).toEqual(["opencode", "claude", "codex"])
  })

  test("PLATFORM_KINDS constant array exists and has all platform kinds", () => {
    expect(PLATFORM_KINDS).toEqual(["windows", "wsl", "darwin", "linux"])
  })

  test("SHELL_KINDS constant array exists and has all shell kinds", () => {
    expect(SHELL_KINDS).toEqual(["powershell", "cmd", "bash", "zsh", "unknown"])
  })

  test("CAPABILITY_STATUSES constant array has all statuses", () => {
    expect(CAPABILITY_STATUSES).toEqual(["supported", "degraded", "unsupported", "unknown"])
  })

  test("RECOMMENDATION_ACTIONS constant array has all actions", () => {
    expect(RECOMMENDATION_ACTIONS).toEqual(["install", "skip", "warn", "defer"])
  })

  test("RECOMMENDATION_PRIORITIES constant array has all priorities", () => {
    expect(RECOMMENDATION_PRIORITIES).toEqual(["high", "medium", "low"])
  })

  test("USER_PROFILES constant array has all profiles", () => {
    expect(USER_PROFILES).toEqual(["non-technical", "developer", "admin"])
  })
})

// --- AgentTarget exhaustiveness ---

describe("AgentTarget discriminated union", () => {
  test("exhaustive switch covers all known agent targets", () => {
    const targets: AgentTarget[] = ["opencode", "claude", "codex"]

    for (const t of targets) {
      // Exhaustive switch — compile error if AgentTarget gains a new member
      const _result: string = (() => {
        switch (t) {
          case "opencode":
            return "ok"
          case "claude":
            return "ok"
          case "codex":
            return "ok"
          default:
            return assertNever(t)
        }
      })()
      expect(_result).toBe("ok")
    }
  })

  test("AgentTarget only contains known values", () => {
    const valid: Set<string> = new Set(["opencode", "claude", "codex"])
    const values: AgentTarget[] = ["opencode", "claude", "codex"]
    for (const v of values) {
      expect(valid.has(v)).toBe(true)
    }
  })
})

// --- PlatformInfo.kind exhaustiveness ---

describe("PlatformInfo discriminated union", () => {
  test("PlatformInfo.kind covers windows, wsl, darwin, linux", () => {
    const kinds: PlatformInfo["kind"][] = ["windows", "wsl", "darwin", "linux"]

    for (const k of kinds) {
      const _result: string = (() => {
        switch (k) {
          case "windows":
            return "ok"
          case "wsl":
            return "ok"
          case "darwin":
            return "ok"
          case "linux":
            return "ok"
          default:
            return assertNever(k)
        }
      })()
      expect(_result).toBe("ok")
    }
  })

  test("PlatformInfo requires kind, arch, configRoot", () => {
    const info: PlatformInfo = {
      kind: "linux",
      arch: "x64",
      configRoot: "/home/user/.config",
    }
    expect(info.kind).toBe("linux")
    expect(info.arch).toBe("x64")
    expect(info.configRoot).toBe("/home/user/.config")
  })
})

// --- ShellInfo.kind exhaustiveness ---

describe("ShellInfo discriminated union", () => {
  test("ShellInfo.kind covers powershell, cmd, bash, zsh, unknown", () => {
    const kinds: ShellInfo["kind"][] = ["powershell", "cmd", "bash", "zsh", "unknown"]

    for (const k of kinds) {
      const _result: string = (() => {
        switch (k) {
          case "powershell":
            return "ok"
          case "cmd":
            return "ok"
          case "bash":
            return "ok"
          case "zsh":
            return "ok"
          case "unknown":
            return "ok"
          default:
            return assertNever(k)
        }
      })()
      expect(_result).toBe("ok")
    }
  })

  test("ShellInfo allows optional executable", () => {
    const withExe: ShellInfo = { kind: "bash", executable: "/bin/bash" }
    const withoutExe: ShellInfo = { kind: "unknown" }
    expect(withExe.executable).toBe("/bin/bash")
    expect(withoutExe.executable).toBeUndefined()
  })
})

// --- ComponentCapability ---

describe("ComponentCapability contract", () => {
  test("ComponentCapability has required fields with correct union types", () => {
    const cap: ComponentCapability = {
      component: "rtk" as ComponentId,
      targets: ["opencode"] as AgentTarget[],
      platforms: ["linux", "wsl", "darwin"] as PlatformInfo["kind"][],
      requires: ["bun"],
      status: "supported",
    }
    expect(cap.component).toBe("rtk")
    expect(cap.status).toBe("supported")
  })

  test("ComponentCapability status is exhaustive", () => {
    const statuses: ComponentCapability["status"][] = ["supported", "degraded", "unsupported", "unknown"]
    for (const s of statuses) {
      const _result: string = (() => {
        switch (s) {
          case "supported":
            return "ok"
          case "degraded":
            return "ok"
          case "unsupported":
            return "ok"
          case "unknown":
            return "ok"
          default:
            return assertNever(s)
        }
      })()
      expect(_result).toBe("ok")
    }
  })
})

// --- DetectionResult ---

describe("DetectionResult contract", () => {
  test("DetectionResult contains platform, shell, agents, capabilities", () => {
    const result: DetectionResult = {
      platform: { kind: "windows", arch: "x64", configRoot: "C:\\Users\\test\\AppData\\Roaming" },
      shell: { kind: "powershell", executable: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" },
      agents: {
        opencode: { installed: true, version: "1.0.0", configPath: "/home/user/.config/opencode" },
        claude: { installed: false },
        codex: { installed: false },
      },
      capabilities: [],
    }
    expect(result.platform.kind).toBe("windows")
    expect(result.shell.kind).toBe("powershell")
    expect(result.agents.opencode.installed).toBe(true)
    expect(result.agents.claude.installed).toBe(false)
    expect(result.agents.codex.installed).toBe(false)
  })

  test("DetectionResult agents record has exactly all AgentTarget keys", () => {
    const targets: AgentTarget[] = ["opencode", "claude", "codex"]
    const result: DetectionResult = {
      platform: { kind: "linux", arch: "x64", configRoot: "/home/user/.config" },
      shell: { kind: "bash" },
      agents: {
        opencode: { installed: true },
        claude: { installed: false },
        codex: { installed: false },
      },
      capabilities: [],
    }
    for (const t of targets) {
      expect(result.agents[t]).toBeDefined()
      expect(typeof result.agents[t].installed).toBe("boolean")
    }
  })
})

// --- Recommendation ---

describe("Recommendation contract", () => {
  test("Recommendation has action discriminated union", () => {
    const actions: Recommendation["action"][] = ["install", "skip", "warn", "defer"]
    for (const a of actions) {
      const _result: string = (() => {
        switch (a) {
          case "install":
            return "ok"
          case "skip":
            return "ok"
          case "warn":
            return "ok"
          case "defer":
            return "ok"
          default:
            return assertNever(a)
        }
      })()
      expect(_result).toBe("ok")
    }
  })

  test("Recommendation has priority discriminated union", () => {
    const priorities: Recommendation["priority"][] = ["high", "medium", "low"]
    for (const p of priorities) {
      expect(["high", "medium", "low"]).toContain(p)
    }
  })

  test("Recommendation has all required fields", () => {
    const rec: Recommendation = {
      component: "rtk" as ComponentId,
      target: "opencode" as AgentTarget,
      action: "install",
      reason: "All prerequisites met",
      priority: "high",
    }
    expect(rec.component).toBe("rtk")
    expect(rec.target).toBe("opencode")
    expect(rec.action).toBe("install")
    expect(rec.reason).toBe("All prerequisites met")
    expect(rec.priority).toBe("high")
  })
})

// --- UserProfile ---

describe("UserProfile discriminated union", () => {
  test("UserProfile covers all profiles", () => {
    const profiles: UserProfile[] = ["non-technical", "developer", "admin"]
    for (const p of profiles) {
      const _result: string = (() => {
        switch (p) {
          case "non-technical":
            return "ok"
          case "developer":
            return "ok"
          case "admin":
            return "ok"
          default:
            return assertNever(p)
        }
      })()
      expect(_result).toBe("ok")
    }
  })
})
