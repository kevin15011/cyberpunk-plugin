// tests/preflight.test.ts

import { beforeEach, describe, expect, mock, test } from "bun:test"

const actualDetect = await import("../src/platform/detect")
const actualPlatform = await import("../src/components/platform")

type MockStatus = {
  id: string
  label: string
  status: "installed" | "available" | "error"
  error?: string
}

let detectedEnvironment: "linux" | "wsl" | "darwin" = "linux"
let mockedPrerequisites = {
  ffmpeg: true,
  npm: true,
  bun: true,
  curl: true,
}
let mockedStatuses: MockStatus[] = []

mock.module("../src/platform/detect", () => ({
  ...actualDetect,
  detectEnvironment: mock(() => detectedEnvironment),
  isWSL: mock(() => detectedEnvironment === "wsl"),
}))

mock.module("../src/components/platform", () => ({
  ...actualPlatform,
  checkPlatformPrerequisites: mock(() => ({ ...mockedPrerequisites })),
}))

mock.module("../src/commands/status", () => ({
  collectStatus: mock(async (filterIds?: string[]) => {
    if (!filterIds || filterIds.length === 0) {
      return mockedStatuses.map(status => ({ ...status }))
    }

    return mockedStatuses
      .filter(status => filterIds.includes(status.id))
      .map(status => ({ ...status }))
  }),
}))

async function importModules() {
  const nonce = `${Date.now()}-${Math.random()}`
  const preflight = await import(`../src/commands/preflight?${nonce}`)
  const output = await import(`../src/cli/output?${nonce}`)
  const presets = await import(`../src/presets/index?${nonce}`)

  return {
    ...preflight,
    ...output,
    ...presets,
  }
}

describe("preset preflight", () => {
  beforeEach(() => {
    detectedEnvironment = "linux"
    mockedPrerequisites = {
      ffmpeg: true,
      npm: true,
      bun: true,
      curl: true,
    }
    mockedStatuses = [
      { id: "plugin", label: "OpenCode Event Sounds", status: "available" },
      { id: "theme", label: "Tema cyberpunk", status: "available" },
      { id: "sounds", label: "Sonidos", status: "available" },
      { id: "context-mode", label: "Context-Mode", status: "available" },
      { id: "rtk", label: "RTK (Token Proxy)", status: "available" },
      { id: "tmux", label: "Tmux config", status: "available" },
    ]
  })

  test("platform partial mock preserves runtime doctor exports", async () => {
    const platform = await import(`../src/components/platform?${Date.now()}-${Math.random()}`)

    expect(typeof platform.getRuntimeDependencyChecks).toBe("function")
  })

  test("buildPresetPreflight keeps minimal preset ready with advisory file touches", async () => {
    const { resolvePreset, buildPresetPreflight } = await importModules()

    mockedStatuses = [
      { id: "plugin", label: "OpenCode Event Sounds", status: "installed" },
      { id: "theme", label: "Tema cyberpunk", status: "available" },
    ]

    const summary = await buildPresetPreflight(resolvePreset("minimal"))

    expect(summary.preset.id).toBe("minimal")
    expect(summary.dependencies).toEqual([])
    expect(summary.warnings).toEqual([])
    expect(summary.components).toEqual([
      {
        id: "plugin",
        installed: true,
        readiness: "ready",
        dependencyIds: [],
        fileTouches: ["~/.config/opencode/plugins/cyberpunk.ts"],
      },
    ])
  })

  test("buildPresetPreflight groups dependency readiness and degraded components for full preset", async () => {
    const { resolvePreset, buildPresetPreflight } = await importModules()

    mockedPrerequisites = {
      ffmpeg: false,
      npm: true,
      bun: false,
      curl: false,
    }
    mockedStatuses = [
      { id: "plugin", label: "OpenCode Event Sounds", status: "installed" },
      { id: "sdd-integration", label: "SDD Integration", status: "available" },
      { id: "theme", label: "Tema cyberpunk", status: "available" },
      { id: "sounds", label: "Sonidos", status: "available" },
      { id: "context-mode", label: "Context-Mode", status: "installed" },
      { id: "rtk", label: "RTK (Token Proxy)", status: "available" },
      { id: "tmux", label: "Tmux config", status: "available" },
      { id: "tui-plugins", label: "TUI Plugins", status: "available" },
      { id: "codebase-memory", label: "Codebase Memory MCP", status: "available" },
    ]

    const summary = await buildPresetPreflight(resolvePreset("cyberpunk-full"))

    expect(summary.dependencies).toEqual([
      {
        id: "ffmpeg",
        label: "ffmpeg",
        requiredBy: ["sounds"],
        available: false,
        severity: "warn",
        message: "No disponible",
      },
      {
        id: "npm",
        label: "npm",
        requiredBy: ["context-mode"],
        available: true,
        severity: "info",
        message: "Disponible",
      },
      {
        id: "bun",
        label: "bun",
        requiredBy: ["context-mode"],
        available: false,
        severity: "info",
        message: "No disponible",
      },
      {
        id: "curl",
        label: "curl",
        requiredBy: ["rtk", "codebase-memory"],
        available: false,
        severity: "warn",
        message: "No disponible",
      },
    ])

    expect(summary.components).toEqual([
      {
        id: "plugin",
        installed: true,
        readiness: "ready",
        dependencyIds: [],
        fileTouches: ["~/.config/opencode/plugins/cyberpunk.ts"],
      },
      {
        id: "sdd-integration",
        installed: false,
        readiness: "ready",
        dependencyIds: [],
        fileTouches: [
          "~/.config/opencode/skills/_shared/sdd-phase-common.md",
          "~/.config/opencode/skills/sdd-propose/SKILL.md",
          "~/.config/opencode/skills/sdd-spec/SKILL.md",
          "~/.config/opencode/skills/sdd-design/SKILL.md",
          "~/.config/opencode/skills/sdd-tasks/SKILL.md",
          "~/.config/opencode/skills/sdd-apply/SKILL.md",
          "~/.config/opencode/skills/sdd-review/SKILL.md",
          "~/.config/opencode/skills/sdd-verify/SKILL.md",
          "~/.config/opencode/skills/sdd-archive/SKILL.md",
          "~/.config/opencode/opencode.json",
        ],
      },
      {
        id: "theme",
        installed: false,
        readiness: "ready",
        dependencyIds: [],
        fileTouches: [
          "~/.config/opencode/themes/cyberpunk.json",
          "~/.config/opencode/themes/tui.json",
        ],
      },
      {
        id: "sounds",
        installed: false,
        readiness: "degraded",
        dependencyIds: ["ffmpeg"],
        fileTouches: ["~/.config/opencode/sounds/*.wav"],
      },
      {
        id: "context-mode",
        installed: true,
        readiness: "degraded",
        dependencyIds: ["npm", "bun"],
        fileTouches: [
          "~/.config/opencode/opencode.json",
          "~/.config/opencode/ROUTING.md",
        ],
      },
      {
        id: "rtk",
        installed: false,
        readiness: "degraded",
        dependencyIds: ["curl"],
        fileTouches: [
          "~/.config/opencode/ROUTING.md",
          "~/.config/opencode/opencode.json",
        ],
      },
      {
        id: "tmux",
        installed: false,
        readiness: "ready",
        dependencyIds: [],
        fileTouches: ["Managed block in ~/.tmux.conf"],
      },
      {
        id: "tui-plugins",
        installed: false,
        readiness: "ready",
        dependencyIds: [],
        fileTouches: ["~/.config/opencode/tui.json"],
      },
      {
        id: "codebase-memory",
        installed: false,
        readiness: "degraded",
        dependencyIds: ["curl"],
        fileTouches: [
          "~/.config/opencode/opencode.json",
          "~/.config/opencode/instructions/codebase-memory-routing.md",
        ],
      },
    ])
    expect(summary.components.map(component => component.id)).not.toContain("otel" as never)
    expect(summary.components.map(component => component.id)).not.toContain("otel-collector" as never)

    expect(summary.warnings.some((warning: string) => warning.includes("ffmpeg"))).toBe(true)
    expect(summary.warnings.some((warning: string) => warning.includes("tmux.conf"))).toBe(true)
  })

  test("buildPresetPreflight resolves old wsl alias to developer-toolkit with deprecation warning", async () => {
    const { resolvePreset, buildPresetPreflight } = await importModules()

    detectedEnvironment = "linux"
    mockedPrerequisites.ffmpeg = false

    const summary = await buildPresetPreflight(resolvePreset("wsl"))

    expect(summary.preset.id).toBe("developer-toolkit")
    expect(summary.warnings.some((warning: string) => warning.includes("deprecado"))).toBe(true)
  })

  test("buildPresetPreflight resolves old mac alias to developer-toolkit", async () => {
    const { resolvePreset, buildPresetPreflight } = await importModules()

    detectedEnvironment = "darwin"
    mockedPrerequisites = {
      ffmpeg: true,
      npm: false,
      bun: true,
      curl: false,
    }

    const summary = await buildPresetPreflight(resolvePreset("mac"))

    expect(summary.preset.id).toBe("developer-toolkit")
    expect(summary.warnings.some((warning: string) => warning.includes("deprecado"))).toBe(true)
    expect(summary.components.find((component: any) => component.id === "context-mode")?.readiness).toBe("degraded")
    expect(summary.components.find((component: any) => component.id === "rtk")?.readiness).toBe("degraded")
  })

  test("buildPresetPreflight keeps partial advisory disclosure unstated when some metadata is unknown", async () => {
    const {
      resolvePreset,
      buildPresetPreflight,
      formatPresetPreflight,
      FILE_TOUCH_MAP,
      DEPENDENCY_MAP,
    } = await importModules()

    delete (FILE_TOUCH_MAP as Record<string, string[]>).theme
    delete (DEPENDENCY_MAP as Record<string, unknown>)["context-mode"]

    const summary = await buildPresetPreflight(resolvePreset("cyberpunk-full"))
    const rendered = formatPresetPreflight(summary)

    expect(summary.components.find((component: any) => component.id === "theme")).toEqual({
      id: "theme",
      installed: false,
      readiness: "ready",
      dependencyIds: [],
      fileTouches: [],
    })
    expect(summary.components.find((component: any) => component.id === "context-mode")).toEqual({
      id: "context-mode",
      installed: false,
      readiness: "ready",
      dependencyIds: [],
      fileTouches: [
        "~/.config/opencode/opencode.json",
        "~/.config/opencode/ROUTING.md",
      ],
    })
    expect(rendered).toContain("solo se muestran los detalles conocidos")
    expect(rendered).toContain("~/.config/opencode/plugins/cyberpunk.ts")
    expect(rendered).not.toContain("~/.config/opencode/themes/cyberpunk.json")
    expect(rendered).not.toContain("~/.config/opencode/themes/tui.json")
    expect(rendered).not.toContain("npm —")
    expect(rendered).not.toContain("bun —")
  })

  test("formatPresetPreflight renders sections, degraded readiness, advisories, and warnings", async () => {
    const { formatPresetPreflight } = await importModules()

    const rendered = formatPresetPreflight({
      preset: {
        id: "cyberpunk-full",
        label: "Cyberpunk Full Experience",
        components: ["plugin", "sounds", "context-mode"],
        warnings: ["tmux solo modifica el bloque gestionado en ~/.tmux.conf"],
      },
      components: [
        {
          id: "plugin",
          installed: true,
          readiness: "ready",
          dependencyIds: [],
          fileTouches: ["~/.config/opencode/plugins/cyberpunk.ts"],
        },
        {
          id: "sounds",
          installed: false,
          readiness: "degraded",
          dependencyIds: ["ffmpeg"],
          fileTouches: ["~/.config/opencode/sounds/*.wav"],
        },
        {
          id: "context-mode",
          installed: false,
          readiness: "degraded",
          dependencyIds: ["npm", "bun"],
          fileTouches: ["~/.config/opencode/opencode.json"],
        },
      ],
      dependencies: [
        {
          id: "ffmpeg",
          label: "ffmpeg",
          requiredBy: ["sounds"],
          available: false,
          severity: "warn",
          message: "No disponible",
        },
        {
          id: "npm",
          label: "npm",
          requiredBy: ["context-mode"],
          available: true,
          severity: "info",
          message: "Disponible",
        },
      ],
      warnings: [
        "sounds necesita ffmpeg instalado",
        "tmux solo modifica el bloque gestionado en ~/.tmux.conf",
      ],
      notes: [],
    })

    expect(rendered).toContain("Preset: Cyberpunk Full Experience")
    expect(rendered).toContain("Componentes")
    expect(rendered).toContain("OpenCode Event Sounds")
    expect(rendered).toContain("ya instalado")
    expect(rendered).toContain("degradado")
    expect(rendered).toContain("Dependencias")
    expect(rendered).toContain("ffmpeg")
    expect(rendered).toContain("sounds")
    expect(rendered).toContain("Archivos")
    expect(rendered).toContain("~/.config/opencode/sounds/*.wav")
    expect(rendered).toContain("Avisos")
    expect(rendered).toContain("tmux.conf")
  })
})
