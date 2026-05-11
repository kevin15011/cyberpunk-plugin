// src/updates/checkers.ts — best-effort update discovery

import { spawnSync } from "child_process"
import { existsSync } from "fs"
import { join } from "path"
import { checkBinaryUpgrade, checkUpgrade } from "../commands/upgrade"
import { readConfigRaw } from "../config/load"
import { resolveContextModeExecutable } from "../components/context-mode"
import type { ToolUpdateStatus, UpdateTool } from "./types"

type FetchJson = (url: string, timeoutMs: number) => Promise<any>
type FetchLike = typeof fetch

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Update check timed out")), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "cyberpunk-cli" }, signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return await resp.json()
  } finally {
    clearTimeout(timer)
  }
}

function status(tool: UpdateTool, current: string | undefined, latest: string | undefined, error?: string): ToolUpdateStatus {
  const available = !!latest && (!current || current !== latest)
  return { tool, current, latest, available, checkedAt: new Date().toISOString(), error }
}

function commandVersion(command: string): string | undefined {
  try {
    const [bin, ...args] = command.split(/\s+/).filter(Boolean)
    const result = spawnSync(bin, args, { encoding: "utf8", timeout: 1000 })
    if (result.error) return undefined
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()
    return output.match(/v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/)?.[1]
  } catch {
    return undefined
  }
}

export async function checkCyberpunkUpdate(timeoutMs = 2500): Promise<ToolUpdateStatus> {
  try {
    const installMode = readConfigRaw().parsed?.installMode
    if (installMode === "binary" || !existsSync(join(process.cwd(), ".git"))) {
      const s = await checkBinaryUpgrade(timeoutMs)
      return { tool: "cyberpunk", current: s.currentVersion, latest: s.latestVersion, available: !s.upToDate, checkedAt: new Date().toISOString() }
    }

    const s = await checkUpgrade(timeoutMs)
    return { tool: "cyberpunk", current: s.currentVersion, latest: s.latestVersion, available: !s.upToDate, checkedAt: new Date().toISOString() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("No se pudo determinar el directorio del repositorio")) {
      try {
        const s = await checkBinaryUpgrade(timeoutMs)
        return { tool: "cyberpunk", current: s.currentVersion, latest: s.latestVersion, available: !s.upToDate, checkedAt: new Date().toISOString() }
      } catch (binaryErr) {
        return status("cyberpunk", undefined, undefined, binaryErr instanceof Error ? binaryErr.message : String(binaryErr))
      }
    }
    return status("cyberpunk", undefined, undefined, err instanceof Error ? err.message : String(err))
  }
}

export async function checkNpmUpdate(tool: "context-mode", packageName: string, timeoutMs: number, json: FetchJson = fetchJson): Promise<ToolUpdateStatus> {
  const command = tool === "context-mode" && packageName === "context-mode"
    ? (resolveContextModeExecutable() ?? packageName)
    : packageName
  try {
    const current = commandVersion(`${command} --version`)
    const data = await withTimeout(json(`https://registry.npmjs.org/${packageName}/latest`, timeoutMs), timeoutMs)
    return status(tool, current, data?.version)
  } catch (err) {
    return status(tool, commandVersion(`${command} --version`), undefined, err instanceof Error ? err.message : String(err))
  }
}

export async function checkGithubReleaseUpdate(tool: "rtk" | "codebase-memory", repo: string, command: string, timeoutMs: number, json: FetchJson = fetchJson): Promise<ToolUpdateStatus> {
  const current = commandVersion(command)
  try {
    const data = await withTimeout(json(`https://api.github.com/repos/${repo}/releases/latest`, timeoutMs), timeoutMs)
    const latest = String(data?.tag_name ?? "").replace(/^v/, "") || undefined
    return status(tool, current, latest)
  } catch (err) {
    try {
      const latest = await fetchGithubLatestReleaseTag(repo, timeoutMs)
      return status(tool, current, latest)
    } catch {
      return status(tool, current, undefined, err instanceof Error ? err.message : String(err))
    }
  }
}

export async function fetchGithubLatestReleaseTag(repo: string, timeoutMs: number, fetchImpl: FetchLike = fetch): Promise<string> {
  const resp = await withTimeout(fetchImpl(`https://github.com/${repo}/releases/latest`, {
    headers: { "User-Agent": "cyberpunk-cli" },
    redirect: "manual",
  }), timeoutMs)

  const location = resp.headers.get("location") ?? resp.url
  const fromLocation = parseReleaseTag(location)
  if (fromLocation) return fromLocation

  const text = await withTimeout(resp.text(), timeoutMs)
  const fromBody = parseReleaseTag(text)
  if (fromBody) return fromBody
  throw new Error("Could not resolve latest GitHub release tag")
}

function parseReleaseTag(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  return input.match(/\/releases\/tag\/v?([^"'<\s?#]+)/)?.[1]
}

export async function checkToolUpdate(tool: UpdateTool, timeoutMs: number): Promise<ToolUpdateStatus> {
  switch (tool) {
    case "cyberpunk": return checkCyberpunkUpdate(timeoutMs)
    case "context-mode": return checkNpmUpdate("context-mode", "context-mode", timeoutMs)
    case "rtk": return checkGithubReleaseUpdate("rtk", "rtk-ai/rtk", "rtk --version", timeoutMs)
    case "codebase-memory": return checkGithubReleaseUpdate("codebase-memory", "DeusData/codebase-memory-mcp", "codebase-memory-mcp --version", timeoutMs)
  }
}
