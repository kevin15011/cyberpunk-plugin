// src/components/metrics-viewer.ts — Types, OTEL NDJSON parser, loader, and formatters for LLM usage metrics
//
// Read-only module: NOT registered as a ComponentId or in install/uninstall flows.

import * as fs from "fs"
import * as path from "path"
import { cyan, green, red, yellow, gray, bold } from "../tui/theme"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsageSummary {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedTokens?: number
  costUsd?: number
  requestCount: number
  eventCount: number
  models: Record<string, number>
  providers: Record<string, number>
  malformedLines: number
  recordsWithoutUsage: number
  bytesRead: number
  truncated: boolean
}

export interface RecentLlmEvent {
  timestamp?: string
  kind: "metric" | "log" | "span" | "unknown"
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
  name?: string
}

export interface MetricsViewerData {
  path: string
  exists: boolean
  empty: boolean
  summary: UsageSummary
  recentEvents: RecentLlmEvent[]
  warnings: string[]
}

export interface MetricsScreenState {
  data?: MetricsViewerData
  loading: boolean
  paused: boolean
  lastUpdatedAt?: number
  nextRefreshAt?: number
  refreshIntervalMs: number
  error?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_BYTES = 1_048_576 // 1MB
const DEFAULT_MAX_EVENTS = 10_000

const INPUT_TOKEN_CANDIDATES = [
  "gen_ai.usage.input_tokens", "llm.prompt_tokens",
  "input_tokens", "prompt_tokens",
]
const OUTPUT_TOKEN_CANDIDATES = [
  "gen_ai.usage.output_tokens", "llm.completion_tokens",
  "output_tokens", "completion_tokens",
]
const TOTAL_TOKEN_CANDIDATES = [
  "gen_ai.usage.total_tokens", "llm.total_tokens",
  "total_tokens",
]
const CACHED_TOKEN_CANDIDATES = [
  "gen_ai.usage.cache_tokens", "cached_tokens", "cache_tokens",
]
const COST_CANDIDATES = [
  "cost", "cost_usd", "total_cost", "gen_ai.usage.cost",
]
const MODEL_CANDIDATES = [
  "gen_ai.request.model", "llm.model", "model", "model_name",
]
const PROVIDER_CANDIDATES = [
  "gen_ai.provider.name", "llm.vendor", "provider", "provider_name",
]

const MAX_RECENT_EVENTS = 20

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Extract a primitive value from an OTLP value wrapper or raw value */
function extractOtelValue(value: unknown): string | number | undefined {
  if (value == null) return undefined
  if (typeof value === "string" || typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>
    if ("stringValue" in obj) return String(obj.stringValue)
    if ("intValue" in obj) return Number(obj.intValue)
    if ("doubleValue" in obj) return Number(obj.doubleValue)
    if ("boolValue" in obj) return (obj.boolValue as boolean) ? 1 : 0
  }
  return undefined
}

/** Recursively flatten a JSON structure to extract all key-value pairs.
 *  Handles OTLP attribute arrays `[{key, value: {stringValue, ...}}]`,
 *  metric name→value mappings, and regular JSON objects. */
function flattenAttributes(obj: unknown, target: Map<string, string | number> = new Map()): Map<string, string | number> {
  if (obj == null || typeof obj !== "object") return target

  if (Array.isArray(obj)) {
    // OTLP attribute array pattern: [{key, value: {stringValue, ...}}, ...]
    if (obj.length > 0 && obj[0] != null && typeof obj[0] === "object" && "key" in obj[0] && "value" in obj[0]) {
      for (const attr of obj) {
        if (attr != null && typeof attr === "object" && "key" in attr && "value" in attr) {
          const val = extractOtelValue((attr as Record<string, unknown>).value)
          if (val !== undefined) {
            target.set(String((attr as Record<string, unknown>).key), val)
          }
        }
      }
      return target
    }
    for (const item of obj) {
      flattenAttributes(item, target)
    }
    return target
  }

  const record = obj as Record<string, unknown>

  // Handle metric objects: {name, gauge: {dataPoints: [{asInt, attributes}]}}
  if ("name" in record && typeof record.name === "string" &&
      ("gauge" in record || "sum" in record || "histogram" in record)) {
    const metricName = record.name
    const dataPoints = extractDataPoints(record.gauge ?? record.sum ?? record.histogram)
    for (const dp of dataPoints) {
      // Map the metric name to the data point value
      const value = dp.asInt ?? dp.asDouble
      if (value != null) {
        const num = Number(value)
        if (!isNaN(num)) {
          target.set(metricName, num)
        }
      }
      // Also flatten data point attributes
      if (dp.attributes) {
        flattenAttributes(dp.attributes, target)
      }
    }
    return target
  }

  for (const [key, value] of Object.entries(record)) {
    if (value == null) continue
    if (typeof value === "string" || typeof value === "number") {
      target.set(key, value)
    } else if (typeof value === "object") {
      flattenAttributes(value, target)
    }
  }

  return target
}

/** Extract dataPoints array from a metric aggregator (gauge, sum, histogram) */
function extractDataPoints(aggregator: unknown): Array<Record<string, unknown>> {
  if (aggregator == null || typeof aggregator !== "object") return []
  const agg = aggregator as Record<string, unknown>
  const dps = agg.dataPoints
  if (!Array.isArray(dps)) return []
  return dps.filter((dp): dp is Record<string, unknown> => dp != null && typeof dp === "object")
}

/** Find the first matching value from a list of candidate keys */
function extractFirstMatch(attrs: Map<string, string | number>, candidates: string[]): string | number | undefined {
  for (const key of candidates) {
    if (attrs.has(key)) return attrs.get(key)!
  }
  // Try with dots replaced by underscores (some exporters flatten differently)
  for (const key of candidates) {
    const flatKey = key.replace(/\./g, "_")
    if (attrs.has(flatKey)) return attrs.get(flatKey)!
  }
  return undefined
}

function toNum(val: string | number | undefined): number | undefined {
  if (val === undefined) return undefined
  const n = Number(val)
  return isNaN(n) ? undefined : n
}

function detectKind(obj: Record<string, unknown>): "metric" | "log" | "span" | "unknown" {
  if ("resourceMetrics" in obj) return "metric"
  if ("resourceLogs" in obj) return "log"
  if ("resourceSpans" in obj) return "span"
  return "unknown"
}

function formatTimestamp(nanoStr: string | undefined): string | undefined {
  if (!nanoStr) return undefined
  const ms = Number(nanoStr) / 1_000_000
  if (isNaN(ms)) return undefined
  const d = new Date(ms)
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "")
}

// ─── Public: Pure Parser ──────────────────────────────────────────────────────

export function parseOtelNdjson(lines: string[]): { summary: UsageSummary; recentEvents: RecentLlmEvent[]; warnings: string[] } {
  const summary: UsageSummary = {
    requestCount: 0,
    eventCount: 0,
    models: {},
    providers: {},
    malformedLines: 0,
    recordsWithoutUsage: 0,
    bytesRead: 0,
    truncated: false,
  }
  const recentEvents: RecentLlmEvent[] = []
  const warnings: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      summary.malformedLines++
      continue
    }

    summary.eventCount++
    const attrs = flattenAttributes(parsed)
    const kind = detectKind(parsed)

    const inputTokens = toNum(extractFirstMatch(attrs, INPUT_TOKEN_CANDIDATES))
    const outputTokens = toNum(extractFirstMatch(attrs, OUTPUT_TOKEN_CANDIDATES))
    const totalTokens = toNum(extractFirstMatch(attrs, TOTAL_TOKEN_CANDIDATES))
    const cachedTokens = toNum(extractFirstMatch(attrs, CACHED_TOKEN_CANDIDATES))
    const costUsd = toNum(extractFirstMatch(attrs, COST_CANDIDATES))

    const modelRaw = extractFirstMatch(attrs, MODEL_CANDIDATES)
    const providerRaw = extractFirstMatch(attrs, PROVIDER_CANDIDATES)
    const model = modelRaw != null ? String(modelRaw) : undefined
    const provider = providerRaw != null ? String(providerRaw) : undefined

    const timestamp = formatTimestamp(
      (attrs.get("timeUnixNano") as string | undefined) ??
      (attrs.get("startTimeUnixNano") as string | undefined) ??
      undefined
    )

    const hasUsage = inputTokens !== undefined || outputTokens !== undefined ||
      totalTokens !== undefined || cachedTokens !== undefined || costUsd !== undefined

    if (hasUsage) {
      if (inputTokens !== undefined) summary.inputTokens = (summary.inputTokens ?? 0) + inputTokens
      if (outputTokens !== undefined) summary.outputTokens = (summary.outputTokens ?? 0) + outputTokens
      if (totalTokens !== undefined) summary.totalTokens = (summary.totalTokens ?? 0) + totalTokens
      if (cachedTokens !== undefined) summary.cachedTokens = (summary.cachedTokens ?? 0) + cachedTokens
      if (costUsd !== undefined) summary.costUsd = (summary.costUsd ?? 0) + costUsd
      summary.requestCount++
    } else {
      summary.recordsWithoutUsage++
    }

    if (model) {
      summary.models[model] = (summary.models[model] ?? 0) + 1
    }
    if (provider) {
      summary.providers[provider] = (summary.providers[provider] ?? 0) + 1
    }

    recentEvents.push({
      timestamp,
      kind,
      model,
      provider,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      name: typeof attrs.get("name") === "string" ? attrs.get("name") as string : undefined,
    })
  }

  // Keep only last N recent events
  const trimmed = recentEvents.length > MAX_RECENT_EVENTS
    ? recentEvents.slice(-MAX_RECENT_EVENTS)
    : recentEvents

  return { summary, recentEvents: trimmed, warnings }
}

// ─── Public: Path Resolver ────────────────────────────────────────────────────

export function resolveMetricsPath(homeDir?: string): string {
  const home = homeDir ?? process.env.HOME ?? process.env.USERPROFILE ?? "~"
  return path.join(home, ".local", "state", "cyberpunk", "otel", "opencode-telemetry.json")
}

// ─── Public: Loader ───────────────────────────────────────────────────────────

export function loadMetricsViewerData(filePath?: string): MetricsViewerData {
  const resolvedPath = filePath ?? resolveMetricsPath()

  const emptySummary: UsageSummary = {
    requestCount: 0, eventCount: 0, models: {}, providers: {},
    malformedLines: 0, recordsWithoutUsage: 0, bytesRead: 0, truncated: false,
  }

  if (!fs.existsSync(resolvedPath)) {
    return {
      path: resolvedPath,
      exists: false,
      empty: true,
      summary: emptySummary,
      recentEvents: [],
      warnings: ["File does not exist"],
    }
  }

  const stat = fs.statSync(resolvedPath)
  if (stat.size === 0) {
    return {
      path: resolvedPath,
      exists: true,
      empty: true,
      summary: emptySummary,
      recentEvents: [],
      warnings: ["File is empty"],
    }
  }

  // Cap reading
  const bytesToRead = Math.min(stat.size, DEFAULT_MAX_BYTES)
  const byteTruncated = stat.size > DEFAULT_MAX_BYTES

  const fd = fs.openSync(resolvedPath, "r")
  const buf = Buffer.alloc(bytesToRead)
  fs.readSync(fd, buf, 0, bytesToRead, 0)
  fs.closeSync(fd)

  const content = buf.toString("utf-8")
  const allLines = content.split("\n")
  const lines = allLines.slice(0, DEFAULT_MAX_EVENTS)
  const lineTruncated = allLines.length > DEFAULT_MAX_EVENTS

  const { summary, recentEvents, warnings: parseWarnings } = parseOtelNdjson(lines)

  summary.bytesRead = bytesToRead
  summary.truncated = byteTruncated || lineTruncated
  if (byteTruncated) parseWarnings.push(`File truncated at ${DEFAULT_MAX_BYTES} bytes`)
  if (lineTruncated) parseWarnings.push(`Events capped at ${DEFAULT_MAX_EVENTS}`)

  return {
    path: resolvedPath,
    exists: true,
    empty: false,
    summary,
    recentEvents,
    warnings: parseWarnings,
  }
}

// ─── Public: Formatters ───────────────────────────────────────────────────────

function fmtNum(v: number | undefined): string {
  return v !== undefined ? v.toLocaleString() : "N/A"
}

function fmtCached(v: number | undefined): string {
  return v !== undefined ? v.toLocaleString() : "not emitted"
}

function fmtCost(v: number | undefined): string {
  return v !== undefined ? `$${v.toFixed(4)}` : "N/A"
}

function fmtMap(m: Record<string, number>): string {
  return Object.entries(m).map(([k, v]) => `${k} (${v})`).join(", ")
}

export function formatMetricsText(data: MetricsViewerData): string {
  const lines: string[] = []

  // ── No-data states ──
  if (!data.exists) {
    lines.push(bold(cyan("LLM Usage — No Data")))
    lines.push("")
    lines.push("No telemetry data found.")
    lines.push("")
    lines.push(gray(`Source: ${data.path}`))
    lines.push(gray("File does not exist."))
    lines.push("")
    lines.push("To generate telemetry, enable the OTEL collector:")
    lines.push(cyan("  cyberpunk install --otel-collector"))
    return lines.join("\n")
  }

  if (data.empty) {
    lines.push(bold(cyan("LLM Usage — No Data")))
    lines.push("")
    lines.push("No telemetry data found.")
    lines.push("")
    lines.push(gray(`Source: ${data.path}`))
    lines.push(gray("File is empty."))
    return lines.join("\n")
  }

  const s = data.summary

  // ── Summary section ──
  lines.push(bold(cyan("LLM Usage Summary")))
  lines.push("")
  lines.push(`  Input Tokens:    ${fmtNum(s.inputTokens)}`)
  lines.push(`  Output Tokens:   ${fmtNum(s.outputTokens)}`)
  lines.push(`  Total Tokens:    ${fmtNum(s.totalTokens)}`)
  lines.push(`  Cached Tokens:   ${fmtCached(s.cachedTokens)}`)
  lines.push(`  Cost (USD):      ${fmtCost(s.costUsd)}`)
  lines.push(`  Requests:        ${s.requestCount}`)
  lines.push(`  Events:          ${s.eventCount}`)

  if (Object.keys(s.models).length > 0) {
    lines.push(`  Models:          ${fmtMap(s.models)}`)
  }
  if (Object.keys(s.providers).length > 0) {
    lines.push(`  Providers:       ${fmtMap(s.providers)}`)
  }

  // No usage data diagnostic
  if (s.requestCount === 0 && s.eventCount > 0) {
    lines.push("")
    lines.push(yellow("  [!] Events found but no token/cost data detected."))
    lines.push(gray("    Token and cost fields were not emitted in the telemetry."))
  }

  // ── Recent events ──
  if (data.recentEvents.length > 0) {
    lines.push("")
    lines.push(gray("─── Recent LLM Events ───"))
    lines.push("")
    lines.push(gray("  Time                 Model       Provider   Tokens      Cost"))

    for (const ev of [...data.recentEvents].reverse()) {
      const time = ev.timestamp ?? "unknown"
      const model = (ev.model ?? "unknown").padEnd(11)
      const prov = (ev.provider ?? "unknown").padEnd(10)
      const tokens = ev.inputTokens !== undefined || ev.outputTokens !== undefined
        ? `${fmtNum(ev.inputTokens)}→${fmtNum(ev.outputTokens)}`
        : "N/A"
      const cost = ev.costUsd !== undefined ? `$${ev.costUsd.toFixed(4)}` : "N/A"
      lines.push(`  ${time}  ${model}  ${prov}  ${tokens.padEnd(11)} ${cost}`)
    }
  }

  // ── Diagnostics ──
  if (s.malformedLines > 0 || s.recordsWithoutUsage > 0 || s.truncated || data.warnings.length > 0) {
    lines.push("")
    lines.push(gray("─── Diagnostics ───"))
    lines.push("")
    lines.push(gray(`  Source: ${data.path}`))
    lines.push(gray(`  Bytes read: ${s.bytesRead.toLocaleString()}`))
    if (s.malformedLines > 0) lines.push(`  Malformed lines: ${s.malformedLines}`)
    if (s.recordsWithoutUsage > 0) lines.push(`  Records without usage: ${s.recordsWithoutUsage}`)
    if (s.truncated) lines.push(yellow("  [!] Output truncated (file too large)"))
    for (const w of data.warnings) {
      lines.push(gray(`  ${w}`))
    }
  }

  return lines.join("\n")
}

export function formatMetricsJson(data: MetricsViewerData): string {
  return JSON.stringify(data, null, 2)
}
