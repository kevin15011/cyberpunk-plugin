// src/updates/cache.ts — TTL cache for update metadata

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { getConfigDir } from "../config/load"
import type { UpdateCacheFile } from "./types"

export function getUpdateCachePath(): string {
  return join(getConfigDir(), "updates.json")
}

export function readUpdateCache(): UpdateCacheFile | null {
  const path = getUpdateCachePath()
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as UpdateCacheFile
    if (!parsed.checkedAt || !Array.isArray(parsed.tools)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeUpdateCache(cache: UpdateCacheFile): void {
  const path = getUpdateCachePath()
  mkdirSync(getConfigDir(), { recursive: true })
  writeFileSync(path + ".tmp", JSON.stringify(cache, null, 2) + "\n", "utf8")
  renameSync(path + ".tmp", path)
}

export function isUpdateCacheFresh(cache: UpdateCacheFile, ttlMs: number, now = Date.now()): boolean {
  const checked = Date.parse(cache.checkedAt)
  return Number.isFinite(checked) && now - checked < ttlMs
}

export function removeUpdateCache(): void {
  const path = getUpdateCachePath()
  if (existsSync(path)) rmSync(path, { force: true })
}
