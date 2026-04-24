// src/commands/upgrade.ts — git fetch or binary download, compare versions, replace files preserving config

import { existsSync, writeFileSync, renameSync, unlinkSync, readFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { createHash } from "node:crypto"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import type { InstallMode } from "../config/schema"

const REPO = "kevin15011/cyberpunk-plugin"

type UpgradeTestOverrides = {
  getRepoDir?: () => string
  gitCommand?: (args: string, cwd?: string) => string
  fetchChecksums?: (tag: string, assetName: string) => Promise<string>
  computeFileSha256?: (path: string) => string
  smokeTestBinary?: (path: string) => boolean
  prepareDarwinBinary?: (path: string) => { attempted: boolean; guidance?: string }
}

export type BinaryVerification = {
  expectedSha256: string
  actualSha256: string
  smokeOk: boolean
  quarantineAttempted: boolean
}

let upgradeTestOverrides: UpgradeTestOverrides = {}

function getBinaryPath(): string {
  return join(
    (process.env.HOME || process.env.USERPROFILE || "~"),
    ".local", "bin",
    "cyberpunk"
  )
}

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
  if (upgradeTestOverrides.getRepoDir) {
    return upgradeTestOverrides.getRepoDir()
  }

  if (existsSync(join(process.cwd(), ".git"))) {
    return process.cwd()
  }
  return ""
}

function gitCommand(args: string, cwd?: string): string {
  if (upgradeTestOverrides.gitCommand) {
    return upgradeTestOverrides.gitCommand(args, cwd)
  }

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

export function __setUpgradeTestOverrides(overrides: UpgradeTestOverrides): void {
  upgradeTestOverrides = overrides
}

export function __resetUpgradeTestOverrides(): void {
  upgradeTestOverrides = {}
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
 * Release assets follow the shared `cyberpunk-{os}-{arch}` contract used by
 * both the GitHub workflow and install.sh bootstrapper.
 */
export function getPlatformAsset(): string {
  const os = process.platform === "darwin" ? "darwin" : "linux"
  let arch = process.arch
  if (arch === "x64") arch = "x64"
  else if (arch === "arm64") arch = "arm64"
  else arch = "x64" // fallback
  return `cyberpunk-${os}-${arch}`
}

// ── Binary verification helpers ───────────────────────────────────

/**
 * Fetch and parse SHA256 checksum from release checksums.txt for a given asset.
 */
export async function fetchChecksums(tag: string, assetName: string): Promise<string> {
  if (upgradeTestOverrides.fetchChecksums) {
    return upgradeTestOverrides.fetchChecksums(tag, assetName)
  }

  const url = `https://github.com/${REPO}/releases/download/${tag}/checksums.txt`
  const resp = await fetch(url, {
    headers: { "User-Agent": "cyberpunk-cli" },
  })
  if (!resp.ok) {
    throw new Error(`Failed to fetch checksums: HTTP ${resp.status}`)
  }
  const text = await resp.text()
  for (const line of text.split("\n")) {
    const parts = line.split(/\s+/)
    if (parts.length >= 2 && parts[1] === assetName) {
      return parts[0]
    }
  }
  throw new Error(`No checksum found for ${assetName} in checksums.txt`)
}

/**
 * Compute SHA256 hex digest of a file.
 */
export function computeFileSha256(filePath: string): string {
  if (upgradeTestOverrides.computeFileSha256) {
    return upgradeTestOverrides.computeFileSha256(filePath)
  }

  const fileBuffer = readFileSync(filePath)
  return createHash("sha256").update(fileBuffer).digest("hex")
}

/**
 * Run a lightweight smoke test on a binary candidate.
 * Returns true if the binary can execute --help (or help subcommand).
 */
export function smokeTestBinary(tmpPath: string): boolean {
  if (upgradeTestOverrides.smokeTestBinary) {
    return upgradeTestOverrides.smokeTestBinary(tmpPath)
  }

  try {
    execSync(`"${tmpPath}" --help`, {
      stdio: "pipe",
      timeout: 5000,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Attempt to remove macOS quarantine attribute from a binary.
 * Returns { attempted: true } on success, or guidance string on failure.
 */
export function prepareDarwinBinary(tmpPath: string): { attempted: boolean; guidance?: string } {
  if (upgradeTestOverrides.prepareDarwinBinary) {
    return upgradeTestOverrides.prepareDarwinBinary(tmpPath)
  }

  try {
    execSync(`xattr -d com.apple.quarantine "${tmpPath}"`, { stdio: "pipe" })
    return { attempted: true }
  } catch {
    return {
      attempted: true,
      guidance: `Could not remove quarantine attribute. Run manually:\n  xattr -d com.apple.quarantine "${tmpPath}"`,
    }
  }
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
 * Download binary from GitHub release, verify integrity, and atomically replace.
 * Verification chain: fetchChecksums → computeFileSha256 → smokeTestBinary
 * → prepareDarwinBinary (if darwin) → atomic rename.
 * On any step failure, deletes .tmp file and throws without replacing existing binary.
 */
async function downloadAndReplaceBinary(assetName: string, tag: string): Promise<void> {
  const binaryPath = getBinaryPath()
  const downloadUrl = `https://github.com/${REPO}/releases/download/${tag}/${assetName}`
  const tmpPath = binaryPath + ".tmp"

  // Step 1: Download
  const resp = await fetch(downloadUrl, {
    headers: { "User-Agent": "cyberpunk-cli" },
  })
  if (!resp.ok) {
    throw new Error(`Download failed: HTTP ${resp.status}`)
  }

  const arrayBuf = await resp.arrayBuffer()
  writeFileSync(tmpPath, Buffer.from(arrayBuf))

  // Step 2: chmod +x
  try {
    execSync(`chmod +x "${tmpPath}"`, { stdio: "pipe" })
  } catch {
    // chmod failure is not fatal
  }

  try {
    // Step 3: Verify SHA256 checksum
    const expectedHash = await fetchChecksums(tag, assetName)
    const actualHash = computeFileSha256(tmpPath)
    if (actualHash !== expectedHash) {
      throw new Error(`CHECKSUM_MISMATCH: Binary checksum mismatch — expected ${expectedHash}, got ${actualHash}. The downloaded file may be corrupted or tampered with. Re-run the upgrade or verify manually with: sha256sum "${tmpPath}"`)
    }

    // Step 4: Smoke test
    const smokeOk = smokeTestBinary(tmpPath)
    if (!smokeOk) {
      throw new Error(`SMOKE_TEST_FAILED: The downloaded binary failed verification. It may be corrupted or incompatible. The existing binary has not been replaced.`)
    }

    // Step 5: macOS quarantine preparation
    if (process.platform === "darwin") {
      const prep = prepareDarwinBinary(tmpPath)
      if (prep.guidance) {
        throw new Error(`QUARANTINE_FAILED: ${prep.guidance}`)
      }
    }

    // Step 6: Atomic rename
    renameSync(tmpPath, binaryPath)
  } catch (err) {
    // Clean up temp file on any verification or preparation failure
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath) } catch {}
    }
    throw err
  }
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
  const binaryPath = getBinaryPath()

  return {
    currentVersion,
    latestVersion,
    upToDate,
    changedFiles: upToDate ? [] : [binaryPath],
  }
}

export async function runBinaryUpgrade(): Promise<UpgradeResult> {
  const currentVersion = getAppVersion()
  const binaryPath = getBinaryPath()

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

  // Download and replace (with verification)
  const assetName = getPlatformAsset()
  try {
    await downloadAndReplaceBinary(assetName, latestTag)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    let errorMessage: string
    if (msg.startsWith("CHECKSUM_MISMATCH:")) {
      errorMessage = msg.replace("CHECKSUM_MISMATCH: ", "")
    } else if (msg.startsWith("SMOKE_TEST_FAILED:")) {
      errorMessage = msg.replace("SMOKE_TEST_FAILED: ", "")
    } else if (msg.startsWith("QUARANTINE_FAILED:")) {
      errorMessage = msg.replace("QUARANTINE_FAILED: ", "")
    } else {
      errorMessage = `Error al descargar binary: ${msg}`
    }

    return {
      status: "error",
      error: errorMessage,
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
    filesUpdated: [binaryPath],
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
