// src/opencode-config.ts — register/unregister OpenCode plugin entries in opencode.json

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "fs"
import { join } from "path"
import { getHomeDirAuto } from "./platform/paths"

export const CYBERPUNK_PLUGIN_ENTRY = "./plugins/cyberpunk"

export interface OpenCodePluginUpdateResult {
  changed: boolean
  registered: boolean
  warning?: string
}

export interface OpenCodeConfig {
  plugin?: string[]
  model?: string
  small_model?: string
  agent?: Record<string, Record<string, unknown>>
  provider?: Record<string, OpenCodeProviderConfig>
  disabled_providers?: string[]
  enabled_providers?: string[]
  [key: string]: unknown
}

export interface OpenCodeProviderConfig {
  name?: string
  models?: Record<string, { name?: string } | Record<string, unknown>>
  [key: string]: unknown
}

export interface OpenCodeModelChoice {
  providerId: string
  providerName: string
  modelId: string
  modelName: string
  modelRef: string
  source: "provider" | "configured" | "opencode-cli"
}

export interface OpenCodeModelProviderGroup {
  providerId: string
  providerName: string
  models: OpenCodeModelChoice[]
}

export type SddReviewAgentName = "sdd-review" | "sdd-review-adversary"

export function getOpenCodeConfigDir(): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode")
}

export function getOpenCodeConfigPath(): string {
  return join(getOpenCodeConfigDir(), "opencode.json")
}

function hasValidPluginArray(config: OpenCodeConfig): config is OpenCodeConfig & { plugin: string[] } {
  return Array.isArray(config.plugin) && config.plugin.every(entry => typeof entry === "string")
}

/**
 * Read OpenCode config from disk. Returns null if file doesn't exist
 * or can't be parsed.
 * Exported for doctor diagnostics.
 */
export function readOpenCodeConfig(): OpenCodeConfig | null {
  const configPath = getOpenCodeConfigPath()
  if (!existsSync(configPath)) return null
  try {
    const raw = readFileSync(configPath, "utf8")
    return JSON.parse(raw) as OpenCodeConfig
  } catch {
    return null
  }
}

export type OpenCodeConfigReadResult =
  | { ok: true; config: OpenCodeConfig; exists: true; error?: undefined }
  | { ok: false; config: null; exists: false; error?: undefined }
  | { ok: false; config: null; exists: true; error: string }

export function readOpenCodeConfigDetailed(): OpenCodeConfigReadResult {
  const configPath = getOpenCodeConfigPath()
  if (!existsSync(configPath)) return { ok: false, config: null, exists: false }
  try {
    const raw = readFileSync(configPath, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, config: null, exists: true, error: "OpenCode config must be a JSON object" }
    }
    return { ok: true, config: parsed as OpenCodeConfig, exists: true }
  } catch (err) {
    return { ok: false, config: null, exists: true, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Atomic write: write to .tmp then rename over target.
 * Exported for doctor repair helpers.
 */
export function writeOpenCodeConfig(config: OpenCodeConfig): void {
  const configDir = getOpenCodeConfigDir()
  const configPath = getOpenCodeConfigPath()
  mkdirSync(configDir, { recursive: true })
  const tmpPath = configPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + "\n", "utf8")
  renameSync(tmpPath, configPath)
}

function splitModelRef(modelRef: string): { providerId: string; modelId: string } | null {
  const idx = modelRef.indexOf("/")
  if (idx <= 0 || idx === modelRef.length - 1) return null
  return { providerId: modelRef.slice(0, idx), modelId: modelRef.slice(idx + 1) }
}

function isProviderEnabled(config: OpenCodeConfig, providerId: string): boolean {
  if (Array.isArray(config.disabled_providers) && config.disabled_providers.includes(providerId)) return false
  if (Array.isArray(config.enabled_providers) && config.enabled_providers.length > 0) {
    return config.enabled_providers.includes(providerId)
  }
  return true
}

function addModelChoice(
  groups: Map<string, OpenCodeModelProviderGroup>,
  providerId: string,
  providerName: string,
  modelId: string,
  modelName: string,
  source: OpenCodeModelChoice["source"]
): void {
  const group = groups.get(providerId) ?? { providerId, providerName, models: [] }
  group.providerName = providerName || group.providerName || providerId
  const modelRef = `${providerId}/${modelId}`
  if (!group.models.some(model => model.modelRef === modelRef)) {
    group.models.push({ providerId, providerName: group.providerName, modelId, modelName, modelRef, source })
  }
  groups.set(providerId, group)
}

/**
 * Return providers/models known from the user's OpenCode config.
 *
 * OpenCode exposes custom provider model catalogs under `provider.*.models`.
 * Built-in provider catalogs are not stored in opencode.json, so for those we
 * safely list model refs already configured in top-level/agent model fields.
 */
export function listConfiguredOpenCodeModels(config: OpenCodeConfig | null = readOpenCodeConfig()): OpenCodeModelProviderGroup[] {
  if (!config) return []

  const groups = new Map<string, OpenCodeModelProviderGroup>()
  const providerEntries = config.provider && typeof config.provider === "object" ? Object.entries(config.provider) : []

  for (const [providerId, providerConfig] of providerEntries) {
    if (!isProviderEnabled(config, providerId)) continue
    const providerName = typeof providerConfig?.name === "string" ? providerConfig.name : providerId
    if (!groups.has(providerId)) groups.set(providerId, { providerId, providerName, models: [] })
    const models = providerConfig?.models && typeof providerConfig.models === "object" ? providerConfig.models : {}
    for (const [modelId, modelConfig] of Object.entries(models)) {
      const modelName = modelConfig && typeof modelConfig === "object" && typeof modelConfig.name === "string"
        ? modelConfig.name
        : modelId
      addModelChoice(groups, providerId, providerName, modelId, modelName, "provider")
    }
  }

  const configuredModelRefs = new Set<string>()
  if (typeof config.model === "string") configuredModelRefs.add(config.model)
  if (typeof config.small_model === "string") configuredModelRefs.add(config.small_model)
  if (config.agent && typeof config.agent === "object") {
    for (const agentConfig of Object.values(config.agent)) {
      const model = agentConfig?.model
      if (typeof model === "string") configuredModelRefs.add(model)
    }
  }

  for (const modelRef of configuredModelRefs) {
    const split = splitModelRef(modelRef)
    if (!split || !isProviderEnabled(config, split.providerId)) continue
    const providerName = config.provider?.[split.providerId]?.name ?? split.providerId
    addModelChoice(groups, split.providerId, providerName, split.modelId, split.modelId, "configured")
  }

  return [...groups.values()]
    .map(group => ({ ...group, models: [...group.models].sort((a, b) => a.modelName.localeCompare(b.modelName)) }))
    .sort((a, b) => a.providerName.localeCompare(b.providerName))
}

export function parseOpenCodeModelListOutput(output: string): OpenCodeModelProviderGroup[] {
  const groups = new Map<string, OpenCodeModelProviderGroup>()
  const modelRefPattern = /([A-Za-z0-9._-]+\/[A-Za-z0-9._:@+-]+)/g
  for (const rawLine of output.split(/\r?\n/)) {
    for (const match of rawLine.matchAll(modelRefPattern)) {
      const split = splitModelRef(match[1])
      if (!split) continue
      addModelChoice(groups, split.providerId, split.providerId, split.modelId, split.modelId, "opencode-cli")
    }
  }
  return [...groups.values()]
    .map(group => ({ ...group, models: [...group.models].sort((a, b) => a.modelName.localeCompare(b.modelName)) }))
    .sort((a, b) => a.providerName.localeCompare(b.providerName))
}

function mergeModelProviderGroups(groups: OpenCodeModelProviderGroup[]): OpenCodeModelProviderGroup[] {
  const merged = new Map<string, OpenCodeModelProviderGroup>()
  for (const group of groups) {
    for (const model of group.models) {
      addModelChoice(merged, model.providerId, group.providerName || model.providerName, model.modelId, model.modelName, model.source)
    }
  }
  return [...merged.values()]
    .map(group => ({ ...group, models: [...group.models].sort((a, b) => a.modelName.localeCompare(b.modelName)) }))
    .sort((a, b) => a.providerName.localeCompare(b.providerName))
}

export function listAvailableOpenCodeModels(): OpenCodeModelProviderGroup[] {
  const configured = listConfiguredOpenCodeModels()
  const opencodeBin = typeof Bun !== "undefined" ? Bun.which("opencode") : null
  if (!opencodeBin) return configured

  try {
    const proc = Bun.spawnSync([opencodeBin, "models"], {
      stdout: "pipe",
      stderr: "pipe",
      timeout: 5000,
    })
    if (proc.exitCode !== 0) return configured
    const cliGroups = parseOpenCodeModelListOutput(Buffer.from(proc.stdout).toString("utf8"))
    return mergeModelProviderGroups([...configured, ...cliGroups])
  } catch {
    return configured
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function getSddReviewBaseAgent(config: OpenCodeConfig): Record<string, unknown> {
  const existing = isPlainRecord(config.agent?.["sdd-review"]) ? config.agent!["sdd-review"] : {}
  return {
    ...existing,
    description: existing.description ?? "Code review using assigned model against specs and design decisions",
    hidden: existing.hidden ?? true,
    mode: existing.mode ?? "subagent",
    prompt: existing.prompt ?? "{file:~/.config/opencode/prompts/sdd/sdd-review.md}",
    tools: existing.tools ?? { bash: true, read: true, write: true },
  }
}

export function configureSddReviewModel(modelRef: string, agentName: SddReviewAgentName = "sdd-review"): { changed: boolean; warning?: string } {
  if (!splitModelRef(modelRef)) return { changed: false, warning: `Invalid OpenCode model ref: ${modelRef}` }
  const readResult = readOpenCodeConfigDetailed()
  if (!readResult.ok && readResult.exists) {
    return { changed: false, warning: `OpenCode config is invalid JSON — refusing to overwrite: ${readResult.error}` }
  }
  const config = readResult.ok ? readResult.config : {}
  config.agent = isPlainRecord(config.agent) ? config.agent as Record<string, Record<string, unknown>> : {}
  const previous = config.agent[agentName]?.model
  const base = agentName === "sdd-review-adversary" ? getSddReviewBaseAgent(config) : {}
  config.agent[agentName] = {
    ...base,
    ...(isPlainRecord(config.agent[agentName]) ? config.agent[agentName] : {}),
    model: modelRef,
  }
  writeOpenCodeConfig(config)
  return { changed: previous !== modelRef }
}

export function getConfiguredSddReviewModel(config: OpenCodeConfig | null = readOpenCodeConfig(), agentName: SddReviewAgentName = "sdd-review"): string | undefined {
  const model = config?.agent?.[agentName]?.model
  return typeof model === "string" && splitModelRef(model) ? model : undefined
}

export function removePrimaryClaudeReviewAgent(config: OpenCodeConfig): boolean {
  if (!config.agent || typeof config.agent !== "object" || !("sdd-claude-review" in config.agent)) return false
  delete config.agent["sdd-claude-review"]
  return true
}

export function ensureSddReviewTaskPermission(config: OpenCodeConfig): boolean {
  config.agent = config.agent && typeof config.agent === "object" ? config.agent : {}
  const orchestrator = config.agent["gentle-orchestrator"] ?? {}
  const permission = orchestrator.permission && typeof orchestrator.permission === "object"
    ? orchestrator.permission as Record<string, unknown>
    : {}
  const taskPermission = permission.task && typeof permission.task === "object"
    ? permission.task as Record<string, unknown>
    : {}
  let changed = false
  if (taskPermission["sdd-review"] !== "allow") {
    taskPermission["sdd-review"] = "allow"
    changed = true
  }
  if (taskPermission["sdd-review-adversary"] !== "allow") {
    taskPermission["sdd-review-adversary"] = "allow"
    changed = true
  }
  permission.task = taskPermission
  config.agent["gentle-orchestrator"] = { ...orchestrator, permission }
  return changed
}

export function ensureSddReviewAdversaryAgent(config: OpenCodeConfig): boolean {
  config.agent = isPlainRecord(config.agent) ? config.agent as Record<string, Record<string, unknown>> : {}
  const review = config.agent["sdd-review"]
  const adversary = config.agent["sdd-review-adversary"]
  if (!isPlainRecord(review) || typeof review.model !== "string") return false
  if (isPlainRecord(adversary)) return false
  config.agent["sdd-review-adversary"] = {
    ...getSddReviewBaseAgent(config),
    model: review.model,
  }
  return true
}

/**
 * Register a plugin entry in OpenCode config plugin array.
 * Idempotent — will not create duplicate entries.
 * Non-fatal — missing file or invalid plugin field is skipped with warning.
 */
export function registerOpenCodePlugin(pluginEntry: string): OpenCodePluginUpdateResult {
  const config = readOpenCodeConfig()

  if (config === null) {
    return {
      changed: false,
      registered: false,
      warning: "OpenCode config not found — registration skipped",
    }
  }

  // Validate plugin field is an array
  if (config.plugin !== undefined && !hasValidPluginArray(config)) {
    return {
      changed: false,
      registered: false,
      warning: "OpenCode config 'plugin' field is not an array — registration skipped",
    }
  }

  // Initialize plugin array if missing
  if (!config.plugin) {
    config.plugin = []
  }

  // Idempotent: skip if already registered
  if (config.plugin.includes(pluginEntry)) {
    return { changed: false, registered: true }
  }

  // Append
  config.plugin.push(pluginEntry)
  writeOpenCodeConfig(config)

  return { changed: true, registered: true }
}

export function registerCyberpunkPlugin(): OpenCodePluginUpdateResult {
  return registerOpenCodePlugin(CYBERPUNK_PLUGIN_ENTRY)
}

/**
 * Unregister a plugin entry from OpenCode config plugin array.
 * Only removes the target entry, leaves others untouched.
 * Non-fatal — missing file or invalid plugin field is skipped silently.
 */
export function unregisterOpenCodePlugin(pluginEntry: string): OpenCodePluginUpdateResult {
  const config = readOpenCodeConfig()

  if (config === null) {
    return { changed: false, registered: false }
  }

  // Validate plugin field
  if (!hasValidPluginArray(config)) {
    return { changed: false, registered: false }
  }

  const idx = config.plugin.indexOf(pluginEntry)
  if (idx === -1) {
    return { changed: false, registered: false }
  }

  config.plugin.splice(idx, 1)
  writeOpenCodeConfig(config)

  return { changed: true, registered: false }
}

export function unregisterCyberpunkPlugin(): OpenCodePluginUpdateResult {
  return unregisterOpenCodePlugin(CYBERPUNK_PLUGIN_ENTRY)
}

export function isOpenCodePluginRegistered(pluginEntry: string): boolean {
  const config = readOpenCodeConfig()
  return config !== null && hasValidPluginArray(config) && config.plugin.includes(pluginEntry)
}
