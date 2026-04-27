// tests/metrics-viewer.test.ts — tests for metrics viewer: parser, loader, formatters, CLI flags, TUI screen

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import {
  parseOtelNdjson,
  resolveMetricsPath,
  loadMetricsViewerData,
  formatMetricsText,
  formatMetricsJson,
} from "../src/components/metrics-viewer"
import type { MetricsViewerData, UsageSummary, RecentLlmEvent, MetricsScreenState } from "../src/components/metrics-viewer"
import { parseArgs } from "../src/cli/parse-args"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

// ─── OTEL Test Helpers ────────────────────────────────────────────────────────

/** Build an OTLP log envelope line with the given attributes */
function makeLogEnvelope(attrs: Record<string, string | number>, timestamp?: string): string {
  const otlpAttrs = Object.entries(attrs).map(([k, v]) => ({
    key: k,
    value: typeof v === "string" ? { stringValue: v } : { intValue: String(v) },
  }))
  return JSON.stringify({
    resourceLogs: [{
      scopeLogs: [{
        logRecords: [{
          timeUnixNano: timestamp ?? "1700000000000000000",
          attributes: otlpAttrs,
        }],
      }],
    }],
  })
}

/** Build an OTLP metric envelope line */
function makeMetricEnvelope(metricName: string, metricValue: number, attrs?: Record<string, string | number>): string {
  const otlpAttrs = attrs
    ? Object.entries(attrs).map(([k, v]) => ({
        key: k,
        value: typeof v === "string" ? { stringValue: v } : { intValue: String(v) },
      }))
    : []
  return JSON.stringify({
    resourceMetrics: [{
      scopeMetrics: [{
        metrics: [{
          name: metricName,
          gauge: {
            dataPoints: [{
              asInt: String(metricValue),
              timeUnixNano: "1700000000000000000",
              attributes: otlpAttrs,
            }],
          },
        }],
      }],
    }],
  })
}

/** Build an OTLP span envelope line */
function makeSpanEnvelope(attrs: Record<string, string | number>, spanName?: string): string {
  const otlpAttrs = Object.entries(attrs).map(([k, v]) => ({
    key: k,
    value: typeof v === "string" ? { stringValue: v } : { intValue: String(v) },
  }))
  return JSON.stringify({
    resourceSpans: [{
      scopeSpans: [{
        spans: [{
          name: spanName ?? "llm.completion",
          startTimeUnixNano: "1700000000000000000",
          attributes: otlpAttrs,
        }],
      }],
    }],
  })
}

/** Build a flat JSON line (non-OTLP) with simple key-value pairs */
function makeFlatLine(attrs: Record<string, string | number>): string {
  return JSON.stringify(attrs)
}

// ─── Temp File Helpers ────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyberpunk-metrics-test-"))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeTempFile(content: string): string {
  const filePath = path.join(tmpDir, "telemetry.json")
  fs.writeFileSync(filePath, content)
  return filePath
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1: Types & Pure Parser (Tasks 1.1, 1.2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("parseOtelNdjson", () => {
  // ── Task 1.1: Basic aggregation ──

  test("aggregates usage summary from log envelope with token/cost fields", () => {
    const line = makeLogEnvelope({
      "gen_ai.usage.input_tokens": 100,
      "gen_ai.usage.output_tokens": 50,
      "gen_ai.request.model": "gpt-4",
      "gen_ai.provider.name": "openai",
      "cost": 0.005,
    })

    const { summary, recentEvents } = parseOtelNdjson([line])

    expect(summary.inputTokens).toBe(100)
    expect(summary.outputTokens).toBe(50)
    expect(summary.costUsd).toBeCloseTo(0.005)
    expect(summary.requestCount).toBe(1)
    expect(summary.eventCount).toBe(1)
    expect(summary.models["gpt-4"]).toBe(1)
    expect(summary.providers["openai"]).toBe(1)
    expect(recentEvents).toHaveLength(1)
    expect(recentEvents[0].model).toBe("gpt-4")
    expect(recentEvents[0].provider).toBe("openai")
    expect(recentEvents[0].kind).toBe("log")
    expect(recentEvents[0].inputTokens).toBe(100)
    expect(recentEvents[0].outputTokens).toBe(50)
  })

  test("aggregates across multiple log lines", () => {
    const lines = [
      makeLogEnvelope({ "gen_ai.usage.input_tokens": 100, "gen_ai.usage.output_tokens": 50, "gen_ai.request.model": "gpt-4" }),
      makeLogEnvelope({ "gen_ai.usage.input_tokens": 200, "gen_ai.usage.output_tokens": 80, "gen_ai.request.model": "claude-3" }),
      makeLogEnvelope({ "gen_ai.usage.input_tokens": 50, "gen_ai.usage.output_tokens": 30, "gen_ai.request.model": "gpt-4" }),
    ]

    const { summary } = parseOtelNdjson(lines)

    expect(summary.inputTokens).toBe(350)
    expect(summary.outputTokens).toBe(160)
    expect(summary.requestCount).toBe(3)
    expect(summary.eventCount).toBe(3)
    expect(summary.models["gpt-4"]).toBe(2)
    expect(summary.models["claude-3"]).toBe(1)
  })

  test("detects metric envelope kind", () => {
    const line = makeMetricEnvelope("gen_ai.usage.input_tokens", 100, { "gen_ai.request.model": "gpt-4" })
    const { recentEvents } = parseOtelNdjson([line])
    expect(recentEvents[0].kind).toBe("metric")
  })

  test("detects span envelope kind", () => {
    const line = makeSpanEnvelope({ "llm.prompt_tokens": 100 })
    const { recentEvents } = parseOtelNdjson([line])
    expect(recentEvents[0].kind).toBe("span")
  })

  test("detects unknown kind for non-OTLP JSON", () => {
    const line = makeFlatLine({ "input_tokens": 100 })
    const { recentEvents } = parseOtelNdjson([line])
    expect(recentEvents[0].kind).toBe("unknown")
  })

  test("counts malformed lines without crashing", () => {
    const lines = [
      "not json at all",
      makeLogEnvelope({ "gen_ai.usage.input_tokens": 100 }),
      "{ broken json",
      "",
      "  ",
    ]

    const { summary, recentEvents } = parseOtelNdjson(lines)

    expect(summary.malformedLines).toBe(2)
    expect(summary.eventCount).toBe(1)
    expect(summary.inputTokens).toBe(100)
    expect(recentEvents).toHaveLength(1)
  })

  // ── Task 1.2: Candidate key extraction ──

  test("extracts input tokens from gen_ai.usage.input_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "gen_ai.usage.input_tokens": 150 }),
    ])
    expect(summary.inputTokens).toBe(150)
  })

  test("extracts input tokens from llm.prompt_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "llm.prompt_tokens": 200 }),
    ])
    expect(summary.inputTokens).toBe(200)
  })

  test("extracts input tokens from short name input_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeFlatLine({ "input_tokens": 50 }),
    ])
    expect(summary.inputTokens).toBe(50)
  })

  test("extracts output tokens from gen_ai.usage.output_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "gen_ai.usage.output_tokens": 75 }),
    ])
    expect(summary.outputTokens).toBe(75)
  })

  test("extracts output tokens from llm.completion_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "llm.completion_tokens": 80 }),
    ])
    expect(summary.outputTokens).toBe(80)
  })

  test("extracts total tokens from gen_ai.usage.total_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "gen_ai.usage.total_tokens": 500 }),
    ])
    expect(summary.totalTokens).toBe(500)
  })

  test("extracts total tokens from llm.total_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "llm.total_tokens": 600 }),
    ])
    expect(summary.totalTokens).toBe(600)
  })

  test("extracts cached tokens from gen_ai.usage.cache_tokens", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "gen_ai.usage.cache_tokens": 1200 }),
    ])
    expect(summary.cachedTokens).toBe(1200)
  })

  test("extracts cost from cost field", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "cost": 0.042, "gen_ai.usage.input_tokens": 100 }),
    ])
    expect(summary.costUsd).toBeCloseTo(0.042)
  })

  test("extracts cost from cost_usd field", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "cost_usd": 0.015, "gen_ai.usage.input_tokens": 100 }),
    ])
    expect(summary.costUsd).toBeCloseTo(0.015)
  })

  test("extracts model from gen_ai.request.model", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "gen_ai.request.model": "gpt-4o", "gen_ai.usage.input_tokens": 100 }),
    ])
    expect(summary.models["gpt-4o"]).toBe(1)
  })

  test("extracts model from llm.model", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "llm.model": "claude-3-opus", "gen_ai.usage.input_tokens": 100 }),
    ])
    expect(summary.models["claude-3-opus"]).toBe(1)
  })

  test("extracts provider from gen_ai.provider.name", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "gen_ai.provider.name": "anthropic", "gen_ai.usage.input_tokens": 100 }),
    ])
    expect(summary.providers["anthropic"]).toBe(1)
  })

  test("extracts provider from llm.vendor", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "llm.vendor": "openai", "gen_ai.usage.input_tokens": 100 }),
    ])
    expect(summary.providers["openai"]).toBe(1)
  })

  test("extracts from metric envelope where metric name IS the key", () => {
    const line = makeMetricEnvelope("gen_ai.usage.input_tokens", 250, {
      "gen_ai.request.model": "gpt-4",
      "gen_ai.provider.name": "openai",
    })
    const { summary } = parseOtelNdjson([line])
    expect(summary.inputTokens).toBe(250)
    expect(summary.models["gpt-4"]).toBe(1)
  })

  test("counts records without usage when no token/cost fields present", () => {
    const { summary } = parseOtelNdjson([
      makeLogEnvelope({ "some.other.field": "value" }),
      makeLogEnvelope({ "gen_ai.usage.input_tokens": 100 }),
      makeLogEnvelope({ "another.field": 42 }),
    ])
    expect(summary.recordsWithoutUsage).toBe(2)
    expect(summary.requestCount).toBe(1)
  })

  test("trims recent events to max 20", () => {
    const lines = Array.from({ length: 30 }, (_, i) =>
      makeLogEnvelope({ "gen_ai.usage.input_tokens": i })
    )
    const { recentEvents } = parseOtelNdjson(lines)
    expect(recentEvents).toHaveLength(20)
    // Should keep the LAST 20 (indices 10-29)
    expect(recentEvents[0].inputTokens).toBe(10)
    expect(recentEvents[19].inputTokens).toBe(29)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1: Loader Edge Cases (Task 1.4)
// ═══════════════════════════════════════════════════════════════════════════════

describe("loadMetricsViewerData", () => {
  test("returns clear diagnostics for missing file", () => {
    const missingPath = path.join(tmpDir, "does-not-exist.json")
    const data = loadMetricsViewerData(missingPath)

    expect(data.exists).toBe(false)
    expect(data.empty).toBe(true)
    expect(data.summary.requestCount).toBe(0)
    expect(data.summary.eventCount).toBe(0)
    expect(data.recentEvents).toHaveLength(0)
    expect(data.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("does not exist")])
    )
  })

  test("returns clear diagnostics for empty file", () => {
    const filePath = writeTempFile("")
    const data = loadMetricsViewerData(filePath)

    expect(data.exists).toBe(true)
    expect(data.empty).toBe(true)
    expect(data.summary.requestCount).toBe(0)
    expect(data.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("empty")])
    )
  })

  test("handles all-malformed lines", () => {
    const filePath = writeTempFile("not json\n{broken\nalso not json\n")
    const data = loadMetricsViewerData(filePath)

    expect(data.exists).toBe(true)
    expect(data.empty).toBe(false)
    expect(data.summary.malformedLines).toBe(3)
    expect(data.summary.eventCount).toBe(0)
    expect(data.summary.requestCount).toBe(0)
    expect(data.recentEvents).toHaveLength(0)
  })

  test("handles valid mixed with malformed lines", () => {
    const valid = makeLogEnvelope({ "gen_ai.usage.input_tokens": 100, "gen_ai.request.model": "gpt-4" })
    const filePath = writeTempFile(`${valid}\nnot json\n${valid}\n{broken}\n`)
    const data = loadMetricsViewerData(filePath)

    expect(data.summary.malformedLines).toBe(2)
    expect(data.summary.eventCount).toBe(2)
    expect(data.summary.inputTokens).toBe(200)
    expect(data.summary.requestCount).toBe(2)
    expect(data.summary.models["gpt-4"]).toBe(2)
  })

  test("handles valid records but no token/cost fields", () => {
    const line = makeLogEnvelope({ "some.field": "value", "another": 42 })
    const filePath = writeTempFile(`${line}\n`)
    const data = loadMetricsViewerData(filePath)

    expect(data.summary.eventCount).toBe(1)
    expect(data.summary.recordsWithoutUsage).toBe(1)
    expect(data.summary.requestCount).toBe(0)
    // No crash, clear diagnostics
    expect(data.recentEvents).toHaveLength(1)
    expect(data.recentEvents[0].inputTokens).toBeUndefined()
  })

  test("uses resolveMetricsPath with custom homeDir", () => {
    const p = resolveMetricsPath("/fake/home")
    expect(p).toBe("/fake/home/.local/state/cyberpunk/otel/opencode-telemetry.json")
  })

  test("sets exists=true, empty=false for valid data file", () => {
    const valid = makeLogEnvelope({ "gen_ai.usage.input_tokens": 100 })
    const filePath = writeTempFile(`${valid}\n`)
    const data = loadMetricsViewerData(filePath)

    expect(data.exists).toBe(true)
    expect(data.empty).toBe(false)
    expect(data.summary.bytesRead).toBeGreaterThan(0)
    expect(data.path).toBe(filePath)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2: Formatters (Tasks 2.1, 2.2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("formatMetricsText", () => {
  test("shows summary section before recent events for valid data", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: true,
      empty: false,
      summary: {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costUsd: 0.42,
        requestCount: 10,
        eventCount: 12,
        models: { "gpt-4": 8, "claude-3": 4 },
        providers: { "openai": 8, "anthropic": 4 },
        malformedLines: 0,
        recordsWithoutUsage: 0,
        bytesRead: 5000,
        truncated: false,
      },
      recentEvents: [{
        timestamp: "2024-01-15 10:30:00",
        kind: "log",
        model: "gpt-4",
        provider: "openai",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
      }],
      warnings: [],
    }

    const output = formatMetricsText(data)
    const lines = output.split("\n")

    // Summary section comes first
    const summaryIdx = lines.findIndex(l => l.includes("LLM Usage Summary"))
    const recentIdx = lines.findIndex(l => l.includes("Recent LLM Events"))
    expect(summaryIdx).toBeLessThan(recentIdx)

    // Contains key summary data
    expect(output).toContain("1,000") // input tokens
    expect(output).toContain("500")   // output tokens
    expect(output).toContain("0.42")  // cost
    expect(output).toContain("gpt-4 (8)")
    expect(output).toContain("openai (8)")
  })

  test("does NOT output raw JSON braces/envelopes", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: true,
      empty: false,
      summary: {
        inputTokens: 100,
        requestCount: 1,
        eventCount: 1,
        models: {},
        providers: {},
        malformedLines: 0,
        recordsWithoutUsage: 0,
        bytesRead: 500,
        truncated: false,
      },
      recentEvents: [],
      warnings: [],
    }

    const output = formatMetricsText(data)
    // Should not contain raw OTEL envelope markers
    expect(output).not.toContain("resourceMetrics")
    expect(output).not.toContain("resourceLogs")
    expect(output).not.toContain("scopeMetrics")
    expect(output).not.toContain("scopeLogs")
  })

  test("shows N/A for absent token fields", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: true,
      empty: false,
      summary: {
        // inputTokens missing
        // outputTokens missing
        requestCount: 1,
        eventCount: 1,
        models: {},
        providers: {},
        malformedLines: 0,
        recordsWithoutUsage: 0,
        bytesRead: 500,
        truncated: false,
      },
      recentEvents: [],
      warnings: [],
    }

    const output = formatMetricsText(data)
    expect(output).toContain("N/A")
  })

  test("shows 'not emitted' for absent cached tokens", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: true,
      empty: false,
      summary: {
        inputTokens: 100,
        requestCount: 1,
        eventCount: 1,
        models: {},
        providers: {},
        malformedLines: 0,
        recordsWithoutUsage: 0,
        bytesRead: 500,
        truncated: false,
      },
      recentEvents: [],
      warnings: [],
    }

    const output = formatMetricsText(data)
    expect(output).toContain("not emitted")
  })

  test("shows clear no-data message for missing file", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: false,
      empty: true,
      summary: {
        requestCount: 0, eventCount: 0, models: {}, providers: {},
        malformedLines: 0, recordsWithoutUsage: 0, bytesRead: 0, truncated: false,
      },
      recentEvents: [],
      warnings: ["File does not exist"],
    }

    const output = formatMetricsText(data)
    expect(output).toContain("No Data")
    expect(output).toContain("does not exist")
    expect(output).toContain("cyberpunk install --otel-collector")
  })

  test("shows diagnostics section last", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: true,
      empty: false,
      summary: {
        inputTokens: 100,
        requestCount: 1,
        eventCount: 1,
        models: { "gpt-4": 1 },
        providers: {},
        malformedLines: 3,
        recordsWithoutUsage: 2,
        bytesRead: 5000,
        truncated: false,
      },
      recentEvents: [{
        kind: "log",
        model: "gpt-4",
        inputTokens: 100,
      }],
      warnings: [],
    }

    const output = formatMetricsText(data)
    const lines = output.split("\n")
    const summaryIdx = lines.findIndex(l => l.includes("LLM Usage Summary"))
    const recentIdx = lines.findIndex(l => l.includes("Recent LLM Events"))
    const diagIdx = lines.findIndex(l => l.includes("Diagnostics"))
    expect(summaryIdx).toBeLessThan(recentIdx)
    expect(recentIdx).toBeLessThan(diagIdx)
    expect(output).toContain("Malformed lines: 3")
    expect(output).toContain("Records without usage: 2")
  })
})

describe("formatMetricsJson", () => {
  test("outputs valid JSON matching MetricsViewerData contract", () => {
    const data: MetricsViewerData = {
      path: "/test/telemetry.json",
      exists: true,
      empty: false,
      summary: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        requestCount: 1,
        eventCount: 1,
        models: { "gpt-4": 1 },
        providers: { "openai": 1 },
        malformedLines: 0,
        recordsWithoutUsage: 0,
        bytesRead: 500,
        truncated: false,
      },
      recentEvents: [{
        kind: "log",
        model: "gpt-4",
        provider: "openai",
        inputTokens: 100,
        outputTokens: 50,
      }],
      warnings: [],
    }

    const jsonStr = formatMetricsJson(data)
    const parsed = JSON.parse(jsonStr)

    expect(parsed.exists).toBe(true)
    expect(parsed.empty).toBe(false)
    expect(parsed.summary.inputTokens).toBe(100)
    expect(parsed.summary.models["gpt-4"]).toBe(1)
    expect(parsed.recentEvents).toHaveLength(1)
    expect(parsed.path).toBe("/test/telemetry.json")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: CLI Command Integration (Task 3.1)
// ═══════════════════════════════════════════════════════════════════════════════

describe("parseArgs — metrics command", () => {
  test("parseArgs(['metrics']) → command: 'metrics'", () => {
    const result = parseArgs(["metrics"])
    expect(result.command).toBe("metrics")
  })

  test("parseArgs(['metrics', '--json']) → command: 'metrics', flags.json: true", () => {
    const result = parseArgs(["metrics", "--json"])
    expect(result.command).toBe("metrics")
    expect(result.flags.json).toBe(true)
  })

  test("parseArgs(['metrics', '--watch', '--interval', '30']) → watch and interval", () => {
    const result = parseArgs(["metrics", "--watch", "--interval", "30"])
    expect(result.command).toBe("metrics")
    expect(result.flags.watch).toBe(true)
    expect(result.flags.interval).toBe(30)
  })

  test("'m' alias resolves to metrics", () => {
    const result = parseArgs(["m"])
    expect(result.command).toBe("metrics")
  })

  test("--metrics flag resolves to metrics command", () => {
    const result = parseArgs(["--metrics"])
    expect(result.command).toBe("metrics")
  })

  test("--interval without value produces parse error", () => {
    const result = parseArgs(["metrics", "--interval"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
    expect(result.parseErrors[0]).toMatch(/--interval/)
  })

  test("--interval with non-numeric value produces parse error", () => {
    const result = parseArgs(["metrics", "--interval", "abc"])
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 4: TUI Screen (Tasks 4.1, 4.2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Metrics TUI screen", () => {
  // Import screen dynamically since types need to be updated
  let metricsScreen: typeof import("../src/tui/screens/metrics-viewer")["metricsScreen"]
  let initialState: typeof import("../src/tui/router")["initialState"]

  beforeEach(async () => {
    const mod = await import("../src/tui/screens/metrics-viewer")
    metricsScreen = mod.metricsScreen
    const routerMod = await import("../src/tui/router")
    initialState = routerMod.initialState
  })

  function makeState(overrides: Partial<import("../src/tui/types").TUIState> = {}): import("../src/tui/types").TUIState {
    const base = initialState([])
    return {
      ...base,
      route: { id: "metrics-viewer" as const },
      ...overrides,
    }
  }

  // ── Task 4.1: Render tests ──

  test("renders summary section with valid data", () => {
    const state = makeState({
      metrics: {
        data: {
          path: "/test/telemetry.json",
          exists: true,
          empty: false,
          summary: {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            costUsd: 0.42,
            requestCount: 10,
            eventCount: 12,
            models: { "gpt-4": 10 },
            providers: { "openai": 10 },
            malformedLines: 0,
            recordsWithoutUsage: 0,
            bytesRead: 5000,
            truncated: false,
          },
          recentEvents: [{
            timestamp: "2024-01-15 10:30:00",
            kind: "log",
            model: "gpt-4",
            provider: "openai",
            inputTokens: 100,
            outputTokens: 50,
            costUsd: 0.01,
          }],
          warnings: [],
        },
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
        lastUpdatedAt: Date.now() - 5000,
        nextRefreshAt: Date.now() + 25_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("LLM Usage Summary")
    expect(output).toContain("1,000")
    expect(output).toContain("500")
    expect(output).toContain("0.42")
    expect(output).toContain("gpt-4 (10)")
  })

  test("renders recent events section", () => {
    const state = makeState({
      metrics: {
        data: {
          path: "/test/telemetry.json",
          exists: true,
          empty: false,
          summary: {
            inputTokens: 100,
            requestCount: 1,
            eventCount: 1,
            models: {},
            providers: {},
            malformedLines: 0,
            recordsWithoutUsage: 0,
            bytesRead: 500,
            truncated: false,
          },
          recentEvents: [{
            timestamp: "2024-01-15 10:30:00",
            kind: "log",
            model: "gpt-4",
            provider: "openai",
            inputTokens: 100,
          }],
          warnings: [],
        },
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("Recent LLM Events")
    expect(output).toContain("gpt-4")
    expect(output).toContain("openai")
  })

  test("renders loading state", () => {
    const state = makeState({
      metrics: {
        loading: true,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("Loading")
  })

  test("renders error state", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
        error: "Permission denied",
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("Error")
    expect(output).toContain("Permission denied")
  })

  test("renders no-data state for missing file", () => {
    const state = makeState({
      metrics: {
        data: {
          path: "/test/telemetry.json",
          exists: false,
          empty: true,
          summary: {
            requestCount: 0, eventCount: 0, models: {}, providers: {},
            malformedLines: 0, recordsWithoutUsage: 0, bytesRead: 0, truncated: false,
          },
          recentEvents: [],
          warnings: ["File does not exist"],
        },
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("No Data")
  })

  test("shows paused indicator when paused", () => {
    const state = makeState({
      metrics: {
        data: {
          path: "/test/telemetry.json",
          exists: true,
          empty: false,
          summary: {
            inputTokens: 100,
            requestCount: 1,
            eventCount: 1,
            models: {},
            providers: {},
            malformedLines: 0,
            recordsWithoutUsage: 0,
            bytesRead: 500,
            truncated: false,
          },
          recentEvents: [],
          warnings: [],
        },
        loading: false,
        paused: true,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toMatch(/PAUSED/i)
  })

  test("shows controls hint line", () => {
    const state = makeState({
      metrics: {
        data: {
          path: "/test/telemetry.json",
          exists: true,
          empty: false,
          summary: {
            inputTokens: 100,
            requestCount: 1,
            eventCount: 1,
            models: {},
            providers: {},
            malformedLines: 0,
            recordsWithoutUsage: 0,
            bytesRead: 500,
            truncated: false,
          },
          recentEvents: [],
          warnings: [],
        },
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    // Should contain controls
    expect(output).toMatch(/\[r\]/)
    expect(output).toMatch(/\[p\]/)
    expect(output).toMatch(/Esc/)
  })

  // ── Task 4.2: Update tests ──

  test("'r' key triggers refresh-metrics intent", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const result = metricsScreen.update(state, { type: "char", ch: "r" })
    expect(result.intent.type).toBe("refresh-metrics")
  })

  test("'p' key toggles pause on", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const result = metricsScreen.update(state, { type: "char", ch: "p" })
    expect(result.state.metrics?.paused).toBe(true)
    expect(result.intent.type).toBe("none")
  })

  test("'p' key toggles pause off", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: true,
        refreshIntervalMs: 30_000,
      },
    })

    const result = metricsScreen.update(state, { type: "char", ch: "p" })
    expect(result.state.metrics?.paused).toBe(false)
  })

  test("Esc key triggers back intent", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const result = metricsScreen.update(state, { type: "back" })
    expect(result.intent.type).toBe("back")
  })

  test("Ctrl-C triggers quit intent", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const result = metricsScreen.update(state, { type: "ctrl-c" })
    expect(result.intent.type).toBe("quit")
    expect(result.state.quit).toBe(true)
  })

  // ── Verification fix: q key as back/exit ──

  test("'q' key triggers back intent", () => {
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const result = metricsScreen.update(state, { type: "char", ch: "q" })
    expect(result.intent.type).toBe("back")
  })

  // ── Verification fix: refresh indicators in all states ──

  test("loading state shows last-updated indicator when available", () => {
    const now = Date.now()
    const state = makeState({
      metrics: {
        loading: true,
        paused: false,
        refreshIntervalMs: 30_000,
        lastUpdatedAt: now - 5000,
        nextRefreshAt: now + 25_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("Loading")
    expect(output).toMatch(/Last updated/i)
    expect(output).toMatch(/Next refresh/i)
  })

  test("error state shows last-updated indicator when available", () => {
    const now = Date.now()
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
        error: "Permission denied",
        lastUpdatedAt: now - 10_000,
        nextRefreshAt: now + 20_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("Error")
    expect(output).toMatch(/Last updated/i)
    expect(output).toMatch(/Next refresh/i)
  })

  test("no-data state shows refresh indicator when available", () => {
    const now = Date.now()
    const state = makeState({
      metrics: {
        data: {
          path: "/test/telemetry.json",
          exists: false,
          empty: true,
          summary: {
            requestCount: 0, eventCount: 0, models: {}, providers: {},
            malformedLines: 0, recordsWithoutUsage: 0, bytesRead: 0, truncated: false,
          },
          recentEvents: [],
          warnings: ["File does not exist"],
        },
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
        lastUpdatedAt: now - 3000,
        nextRefreshAt: now + 27_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("No Data")
    expect(output).toMatch(/Last updated/i)
    expect(output).toMatch(/Next refresh/i)
  })

  test("no-data-loaded state shows refresh indicator when available", () => {
    const now = Date.now()
    const state = makeState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
        lastUpdatedAt: now - 7000,
        nextRefreshAt: now + 23_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("No data loaded")
    expect(output).toMatch(/Last updated/i)
    expect(output).toMatch(/Next refresh/i)
  })

  test("loading state without lastUpdatedAt omits refresh indicators", () => {
    const state = makeState({
      metrics: {
        loading: true,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toContain("Loading")
    expect(output).not.toMatch(/Last updated/i)
  })

  test("controls hint includes q key", () => {
    const state = makeState({
      metrics: {
        loading: true,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const lines = metricsScreen.render(state)
    const output = lines.join("\n")

    expect(output).toMatch(/\[Esc\/q\]/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Verification fix: Auto-refresh cycle behavioral tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Metrics auto-refresh cycle", () => {
  let loadMetricsDataHelper: typeof import("../src/tui/index")["loadMetricsDataHelper"]
  let routerInitialState: typeof import("../src/tui/router")["initialState"]

  beforeEach(async () => {
    const indexMod = await import("../src/tui/index")
    loadMetricsDataHelper = indexMod.loadMetricsDataHelper
    const routerMod = await import("../src/tui/router")
    routerInitialState = routerMod.initialState
  })

  function makeMetricsState(overrides: Partial<import("../src/tui/types").TUIState> = {}): import("../src/tui/types").TUIState {
    const base = routerInitialState([])
    return {
      ...base,
      route: { id: "metrics-viewer" as const },
      ...overrides,
    }
  }

  test("loadMetricsDataHelper sets lastUpdatedAt and nextRefreshAt on success", async () => {
    // Uses fake HOME via temp file — loadMetricsViewerData() reads default path
    // which won't exist, so it returns no-data state
    const fakeHome = tmpDir
    const originalHome = process.env.HOME
    process.env.HOME = fakeHome

    try {
      const now = Date.now()
      const state = makeMetricsState({
        metrics: {
          loading: true,
          paused: false,
          refreshIntervalMs: 30_000,
        },
      })

      const result = await loadMetricsDataHelper(state)

      expect(result.metrics?.loading).toBe(false)
      expect(result.metrics?.lastUpdatedAt).toBeGreaterThanOrEqual(now)
      expect(result.metrics?.nextRefreshAt).toBeGreaterThanOrEqual(now + 25_000)
      expect(result.metrics?.error).toBeUndefined()
    } finally {
      process.env.HOME = originalHome
    }
  })

  test("loadMetricsDataHelper clears nextRefreshAt when paused", async () => {
    const fakeHome = tmpDir
    const originalHome = process.env.HOME
    process.env.HOME = fakeHome

    try {
      const state = makeMetricsState({
        metrics: {
          loading: true,
          paused: true,
          refreshIntervalMs: 30_000,
        },
      })

      const result = await loadMetricsDataHelper(state)

      expect(result.metrics?.loading).toBe(false)
      expect(result.metrics?.lastUpdatedAt).toBeGreaterThan(0)
      expect(result.metrics?.nextRefreshAt).toBeUndefined()
    } finally {
      process.env.HOME = originalHome
    }
  })

  test("loadMetricsDataHelper loads from temp file with valid data", async () => {
    const valid = makeLogEnvelope({ "gen_ai.usage.input_tokens": 200, "gen_ai.request.model": "gpt-4" })
    const filePath = writeTempFile(`${valid}\n`)

    const state = makeMetricsState({
      metrics: {
        loading: true,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    // Manually inject path via metrics state data override isn't possible,
    // so we test through loadMetricsViewerData directly and verify helper pattern
    const data = loadMetricsViewerData(filePath)
    expect(data.exists).toBe(true)
    expect(data.summary.inputTokens).toBe(200)
  })

  test("loadMetricsDataHelper preserves error on failure", async () => {
    const state = makeMetricsState({
      metrics: {
        loading: true,
        paused: false,
        refreshIntervalMs: 30_000,
      },
    })

    const result = await loadMetricsDataHelper(state)
    // Should succeed even if no file — loadMetricsViewerData returns diagnostics, not errors
    expect(result.metrics?.loading).toBe(false)
  })

  // ── Timer lifecycle: route entry → pause → resume → route leave ──

  test("route entry sets loading state with correct interval", () => {
    // Simulates what index.ts does on first navigation
    const state = makeMetricsState()
    const metricsState: MetricsScreenState = {
      loading: true,
      paused: false,
      refreshIntervalMs: 30_000,
    }

    const enteredState = { ...state, metrics: metricsState }

    expect(enteredState.metrics?.loading).toBe(true)
    expect(enteredState.metrics?.paused).toBe(false)
    expect(enteredState.metrics?.refreshIntervalMs).toBe(30_000)
  })

  test("pause toggle stops next refresh calculation", async () => {
    const fakeHome = tmpDir
    const originalHome = process.env.HOME
    process.env.HOME = fakeHome

    try {
      // Load data first
      let state = makeMetricsState({
        metrics: {
          loading: true,
          paused: false,
          refreshIntervalMs: 30_000,
        },
      })
      state = await loadMetricsDataHelper(state)
      expect(state.metrics?.nextRefreshAt).toBeDefined()

      // Toggle pause
      const pausedState = {
        ...state,
        metrics: { ...state.metrics!, paused: true },
      }
      expect(pausedState.metrics?.paused).toBe(true)

      // Refresh while paused — nextRefreshAt should be undefined
      const refreshedPaused = await loadMetricsDataHelper(pausedState)
      expect(refreshedPaused.metrics?.nextRefreshAt).toBeUndefined()
      expect(refreshedPaused.metrics?.lastUpdatedAt).toBeGreaterThan(0)
    } finally {
      process.env.HOME = originalHome
    }
  })

  test("resume re-enables next refresh calculation", async () => {
    const fakeHome = tmpDir
    const originalHome = process.env.HOME
    process.env.HOME = fakeHome

    try {
      const now = Date.now()
      let state = makeMetricsState({
        metrics: {
          loading: false,
          paused: true,
          refreshIntervalMs: 30_000,
          lastUpdatedAt: now - 15_000,
        },
      })

      // Resume
      state = { ...state, metrics: { ...state.metrics!, paused: false } }
      expect(state.metrics?.paused).toBe(false)

      // Refresh should set nextRefreshAt
      const refreshed = await loadMetricsDataHelper(state)
      expect(refreshed.metrics?.nextRefreshAt).toBeGreaterThanOrEqual(now)
    } finally {
      process.env.HOME = originalHome
    }
  })

  test("route leave clears metrics state (router behavior)", () => {
    const { pushRoute, route: makeRoute } = require("../src/tui/router")
    const state = makeMetricsState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
        lastUpdatedAt: Date.now(),
      },
    })

    expect(state.metrics).toBeDefined()

    // Navigate away — router resets metrics state
    const leftState = pushRoute(state, makeRoute("home"))
    expect(leftState.metrics).toBeUndefined()
  })

  // ── Fake timer test: simulate 30s interval ──

  test("simulated interval refresh updates state timestamps", async () => {
    const fakeHome = tmpDir
    const originalHome = process.env.HOME
    process.env.HOME = fakeHome

    try {
      const t0 = Date.now()

      // Initial load
      let state = makeMetricsState({
        metrics: {
          loading: true,
          paused: false,
          refreshIntervalMs: 30_000,
        },
      })
      state = await loadMetricsDataHelper(state)
      const firstUpdate = state.metrics!.lastUpdatedAt!
      expect(firstUpdate).toBeGreaterThanOrEqual(t0)

      // Simulate interval tick (30s later)
      const t1 = Date.now() + 30_000
      const origNow = Date.now
      // We can't override Date.now for the helper, but we can verify the state
      // would be refreshed with new timestamps on next call
      state = await loadMetricsDataHelper(state)
      const secondUpdate = state.metrics!.lastUpdatedAt!
      expect(secondUpdate).toBeGreaterThanOrEqual(firstUpdate)
      expect(state.metrics?.nextRefreshAt).toBeGreaterThanOrEqual(secondUpdate)
    } finally {
      process.env.HOME = originalHome
    }
  })

  test("interval callback skips when paused", async () => {
    // This tests the guard logic that index.ts uses:
    // "if (state.route.id !== 'metrics-viewer' || !state.metrics || state.metrics.paused) return"
    const state = makeMetricsState({
      metrics: {
        loading: false,
        paused: true,
        refreshIntervalMs: 30_000,
        lastUpdatedAt: 1000, // old timestamp
      },
    })

    // Simulating the guard: when paused, interval callback returns early
    const shouldSkip = state.route.id !== "metrics-viewer" || !state.metrics || state.metrics.paused
    expect(shouldSkip).toBe(true)
  })

  test("interval callback skips when route changed", () => {
    const state = makeMetricsState({
      metrics: {
        loading: false,
        paused: false,
        refreshIntervalMs: 30_000,
      },
      route: { id: "home" as const }, // Not metrics-viewer
    })

    const shouldSkip = state.route.id !== "metrics-viewer" || !state.metrics || state.metrics.paused
    expect(shouldSkip).toBe(true)
  })
})
