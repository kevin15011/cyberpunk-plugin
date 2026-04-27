// src/tui/screens/metrics-viewer.ts — Metrics viewer screen: LLM usage summary, recent events, refresh controls

import type { KeyEvent, ScreenModule, ScreenResult, TUIState } from "../types"
import type { MetricsViewerData, MetricsScreenState } from "../../components/metrics-viewer"
import { bold, cyan, green, red, yellow, gray, separator } from "../theme"

export const metricsScreen: ScreenModule = {
  render(state: TUIState): string[] {
    const lines: string[] = []
    const ms = state.metrics

    // No metrics state yet (should not happen, but defensive)
    if (!ms) {
      lines.push(bold(cyan("═══ LLM Usage Metrics ═══")))
      lines.push("")
      lines.push(gray("  Initializing..."))
      lines.push("")
      lines.push(gray("  [Esc/q] Back"))
      return lines
    }

    // Loading state
    if (ms.loading) {
      lines.push(bold(cyan("═══ LLM Usage Metrics ═══")))
      lines.push("")
      lines.push(gray("  Loading telemetry data..."))
      appendRefreshStatus(lines, ms)
      lines.push("")
      lines.push(gray("  [Esc/q] Back"))
      return lines
    }

    // Error state
    if (ms.error) {
      lines.push(bold(cyan("═══ LLM Usage Metrics ═══")))
      lines.push("")
      lines.push(red(`  Error: ${ms.error}`))
      appendRefreshStatus(lines, ms)
      lines.push("")
      lines.push(gray("  [r] Retry  [Esc/q] Back"))
      return lines
    }

    // No data loaded
    const data = ms.data
    if (!data) {
      lines.push(bold(cyan("═══ LLM Usage Metrics ═══")))
      lines.push("")
      lines.push(gray("  No data loaded"))
      appendRefreshStatus(lines, ms)
      lines.push("")
      lines.push(gray("  [r] Refresh  [Esc/q] Back"))
      return lines
    }

    // ── No-data file states ──
    if (!data.exists || data.empty) {
      lines.push(bold(cyan("═══ LLM Usage — No Data ═══")))
      lines.push("")
      lines.push("  No telemetry data found.")
      lines.push("")
      lines.push(gray(`  Source: ${data.path}`))
      if (!data.exists) {
        lines.push(gray("  File does not exist."))
      } else if (data.empty) {
        lines.push(gray("  File is empty."))
      }
      appendRefreshStatus(lines, ms)
      lines.push("")
      lines.push(gray("  [r] Refresh  [Esc/q] Back"))
      return lines
    }

    // ── Summary section ──
    const s = data.summary
    lines.push(bold(cyan("═══ LLM Usage Summary ═══")))
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
      lines.push(separator())
      lines.push(bold("  Recent LLM Events"))
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
      lines.push(separator())
      lines.push(bold("  Diagnostics"))
      lines.push("")
      if (s.malformedLines > 0) lines.push(`  Malformed lines:  ${s.malformedLines}`)
      if (s.recordsWithoutUsage > 0) lines.push(`  No usage data:    ${s.recordsWithoutUsage}`)
      if (s.truncated) lines.push(yellow("  [!] Output truncated"))
      for (const w of data.warnings) {
        lines.push(gray(`  ${w}`))
      }
    }

    // ── Status line ──
    lines.push("")
    lines.push(separator())

    const statusParts: string[] = []
    if (ms.paused) {
      statusParts.push(yellow("PAUSED"))
    } else {
      statusParts.push(green("LIVE"))
    }
    if (ms.lastUpdatedAt) {
      const ago = Math.max(0, Math.round((Date.now() - ms.lastUpdatedAt) / 1000))
      statusParts.push(`Updated ${ago}s ago`)
    }
    if (!ms.paused && ms.nextRefreshAt) {
      const until = Math.max(0, Math.round((ms.nextRefreshAt - Date.now()) / 1000))
      statusParts.push(`Next refresh in ${until}s`)
    }

    lines.push(`  ${statusParts.join(" │ ")}`)
    lines.push(gray("  [r] Refresh  [p] Pause/Resume  [Esc/q] Back"))

    return lines
  },

  update(state: TUIState, key: KeyEvent): ScreenResult {
    switch (key.type) {
      case "char": {
        if (key.ch === "r") {
          return { state, intent: { type: "refresh-metrics" } }
        }
        if (key.ch === "p") {
          const ms = state.metrics
          if (ms) {
            return {
              state: { ...state, metrics: { ...ms, paused: !ms.paused } },
              intent: { type: "none" },
            }
          }
        }
        if (key.ch === "q") {
          return { state, intent: { type: "back" } }
        }
        break
      }
      case "back":
        return { state, intent: { type: "back" } }
      case "ctrl-c":
        return { state: { ...state, quit: true }, intent: { type: "quit" } }
    }

    return { state, intent: { type: "none" } }
  },
}

// ─── Refresh status helper ────────────────────────────────────────────────────

/** Append refresh status indicators (last updated / next refresh) to lines */
function appendRefreshStatus(lines: string[], ms: MetricsScreenState): void {
  const parts: string[] = []
  if (ms.lastUpdatedAt) {
    const ago = Math.max(0, Math.round((Date.now() - ms.lastUpdatedAt) / 1000))
    parts.push(`Last updated ${ago}s ago`)
  }
  if (!ms.paused && ms.nextRefreshAt) {
    const until = Math.max(0, Math.round((ms.nextRefreshAt - Date.now()) / 1000))
    parts.push(`Next refresh in ${until}s`)
  }
  if (parts.length > 0) {
    lines.push(gray(`  ${parts.join(" │ ")}`))
  }
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtNum(v: number | undefined): string {
  return v !== undefined ? v.toLocaleString() : "N/A"
}

function fmtCached(v: number | undefined): string {
  return v !== undefined ? v.toLocaleString() : gray("not emitted")
}

function fmtCost(v: number | undefined): string {
  return v !== undefined ? `$${v.toFixed(4)}` : "N/A"
}

function fmtMap(m: Record<string, number>): string {
  return Object.entries(m).map(([k, v]) => `${k} (${v})`).join(", ")
}
