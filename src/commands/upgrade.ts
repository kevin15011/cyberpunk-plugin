// src/commands/upgrade.ts — git fetch or binary download, compare versions, replace files preserving config

import { existsSync, writeFileSync, renameSync, unlinkSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import type { InstallMode } from "../config/schema"

const REPO = "kevin15011/cyberpunk-plugin"
const BINARY_INSTALL_DIR = join(
  (process.env.HOME || process.env.USERPROFILE || "~"),
  ".local", "bin"
)
const BINARY_PATH = join(BINARY_INSTALL_DIR, "cyberpunk")

export interface UpgradeStatus {
  currentVersion: string
  latestVersion: string
  upToDate: boolean
  changedFiles: string[]
}

export interface UpgradeResult {
  status: "up-to-date" | "upgraded" | "error"
  fromVersion?: string
  toVersion?: string
  filesUpdated?: string[]
  error?: string
}

// ── Helpers ───────────────────────────────────────────────────────

function getRepoDir(): string {
  if (existsSync(join(process.cwd(), ".git"))) {
    return process.cwd()
  }
  return ""
}

function gitCommand(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: cwd || process.cwd(),
      stdio: "pipe",
      encoding: "utf8",
    }).trim()
  } catch (err: any) {
    throw new Error(`git command failed: git ${args}: ${err.message || err}`)
  }
}

/**
 * Get the current app version from package.json.
 */
export function getAppVersion(): string {
  try {
    // Read from package.json at build time — fallback to "0.0.0"
    const pkg = require("../../package.json")
    return pkg.version || "0.0.0"
  } catch {
    return "0.0.0"
  }
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b
 *   0 if a === b
 *   1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number)
  const pb = b.replace(/^v/, "").split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

/**
 * Detect platform asset suffix for GitHub release download.
 */
export function getPlatformAsset(): string {
  const os = process.platform === "darwin" ? "darwin" : "linux"
  let arch = process.arch
  if (arch === "x64") arch = "x64"
  else if (arch === "arm64") arch = "arm64"
  else arch = "x64" // fallback
  return `cyberpunk-${os}-${arch}`
}

/**
 * Fetch latest release tag from GitHub API.
 */
export async function fetchLatestReleaseTag(): Promise<string> {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`
  const resp = await fetch(url, {
    headers: { "User-Agent": "cyberpunk-cli" },
  })
  if (!resp.ok) {
    throw new Error(`GitHub API returned ${resp.status}`)
  }
  const data = await resp.json() as { tag_name?: string }
  if (!data.tag_name) {
    throw new Error("No tag_name in release response")
  }
  return data.tag_name
}

/**
 * Download binary from GitHub release to a temp file, then rename over target.
 */
async function downloadAndReplaceBinary(assetName: string, tag: string): Promise<void> {
  const downloadUrl = `https://github.com/${REPO}/releases/download/${tag}/${assetName}`
  const tmpPath = BINARY_PATH + ".tmp"

  const resp = await fetch(downloadUrl, {
    headers: { "User-Agent": "cyberpunk-cli" },
  })
  if (!resp.ok) {
    throw new Error(`Download failed: HTTP ${resp.status}`)
  }

  const arrayBuf = await resp.arrayBuffer()
  writeFileSync(tmpPath, Buffer.from(arrayBuf))

  // chmod +x
  try {
    execSync(`chmod +x "${tmpPath}"`, { stdio: "pipe" })
  } catch {
    // chmod failure is not fatal
  }

  // Atomic rename
  renameSync(tmpPath, BINARY_PATH)
}

// ── Repo upgrade (existing path) ─────────────────────────────────

async function checkRepoUpgrade(): Promise<UpgradeStatus> {
  const repoDir = getRepoDir()
  if (!repoDir) {
    throw new Error("No se pudo determinar el directorio del repositorio")
  }

  let currentVersion: string
  try {
    currentVersion = gitCommand("rev-parse HEAD", repoDir)
  } catch {
    currentVersion = "unknown"
  }

  try {
    gitCommand("fetch origin main", repoDir)
  } catch (err) {
    throw new Error(`No se pudo conectar al repositorio remoto: ${err}`)
  }

  let latestVersion: string
  try {
    latestVersion = gitCommand("rev-parse origin/main", repoDir)
  } catch {
    throw new Error("No se pudo obtener la versión remota")
  }

  const upToDate = currentVersion === latestVersion

  let changedFiles: string[] = []
  if (!upToDate) {
    try {
      const diff = gitCommand(`diff --name-only ${currentVersion}..${latestVersion}`, repoDir)
      changedFiles = diff.split("\n").filter(Boolean)
    } catch {
      changedFiles = []
    }
  }

  return { currentVersion, latestVersion, upToDate, changedFiles }
}

async function runRepoUpgrade(): Promise<UpgradeResult> {
  const repoDir = getRepoDir()
  if (!repoDir) {
    return {
      status: "error",
      error: "No se pudo determinar el directorio del repositorio",
    }
  }

  let status: UpgradeStatus
  try {
    status = await checkRepoUpgrade()
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    }
  }

  if (status.upToDate) {
    return {
      status: "up-to-date",
      fromVersion: status.currentVersion,
      toVersion: status.latestVersion,
    }
  }

  // Back up files that will change
  const { copyFileSync } = await import("fs")
  const filesToBackup = status.changedFiles.filter(f =>
    f !== "src/config/schema.ts" &&
    !f.endsWith("config.json") &&
    existsSync(join(repoDir, f))
  )

  for (const file of filesToBackup) {
    const filePath = join(repoDir, file)
    if (existsSync(filePath)) {
      copyFileSync(filePath, filePath + ".bak")
    }
  }

  try {
    gitCommand("pull origin main", repoDir)
  } catch (err) {
    for (const file of filesToBackup) {
      const bakPath = join(repoDir, file + ".bak")
      if (existsSync(bakPath)) {
        copyFileSync(bakPath, join(repoDir, file))
      }
    }
    return {
      status: "error",
      error: `Error al hacer pull: ${err}`,
    }
  }

  // Update lastUpgradeCheck timestamp
  const config = loadConfig()
  config.lastUpgradeCheck = new Date().toISOString()
  saveConfig(config)

  return {
    status: "upgraded",
    fromVersion: status.currentVersion,
    toVersion: status.latestVersion,
    filesUpdated: status.changedFiles,
  }
}

// ── Binary upgrade (new path) ────────────────────────────────────

export async function checkBinaryUpgrade(): Promise<UpgradeStatus> {
  const currentVersion = getAppVersion()
  const latestTag = await fetchLatestReleaseTag()
  const latestVersion = latestTag.replace(/^v/, "")
  const upToDate = compareSemver(currentVersion, latestVersion) >= 0

  return {
    currentVersion,
    latestVersion,
    upToDate,
    changedFiles: upToDate ? [] : [BINARY_PATH],
  }
}

export async function runBinaryUpgrade(): Promise<UpgradeResult> {
  const currentVersion = getAppVersion()

  let latestTag: string
  try {
    latestTag = await fetchLatestReleaseTag()
  } catch (err) {
    return {
      status: "error",
      error: `No se pudo obtener la última versión: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const latestVersion = latestTag.replace(/^v/, "")

  // Binary installs always refresh from the latest published asset.
  // `checkUpgrade()` remains informational and may report semver parity,
  // but `runUpgrade()` force-downloads to avoid stale local binaries when
  // a release asset is rebuilt under the same version tag.

  // Download and replace
  const assetName = getPlatformAsset()
  try {
    await downloadAndReplaceBinary(assetName, latestTag)
  } catch (err) {
    // Clean up temp file on failure
    const tmpPath = BINARY_PATH + ".tmp"
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath) } catch {}
    }
    return {
      status: "error",
      error: `Error al descargar binary: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Update lastUpgradeCheck timestamp — preserve config
  const config = loadConfig()
  config.lastUpgradeCheck = new Date().toISOString()
  saveConfig(config)

  return {
    status: "upgraded",
    fromVersion: currentVersion,
    toVersion: latestVersion,
    filesUpdated: [BINARY_PATH],
  }
}

// ── Public API — dispatch by installMode ──────────────────────────

export async function checkUpgrade(): Promise<UpgradeStatus> {
  const config = loadConfig()
  const mode: InstallMode = config.installMode || "repo"

  if (mode === "binary") {
    return checkBinaryUpgrade()
  }

  return checkRepoUpgrade()
}

export async function runUpgrade(): Promise<UpgradeResult> {
  const config = loadConfig()
  const mode: InstallMode = config.installMode || "repo"

  if (mode === "binary") {
    return runBinaryUpgrade()
  }

  return runRepoUpgrade()
}
