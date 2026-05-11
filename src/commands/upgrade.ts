// src/commands/upgrade.ts — git fetch or binary download, compare versions, replace files preserving config

import { closeSync, copyFileSync, existsSync, openSync, renameSync, unlinkSync, writeSync } from "fs"
import { createReadStream } from "node:fs"
import { basename, join } from "path"
import { execSync } from "child_process"
import { createHash } from "node:crypto"
import { loadConfig, readConfigRaw } from "../config/load"
import { saveConfig } from "../config/save"
import type { InstallMode } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { removeUpdateCache } from "../updates/cache"
import { APP_VERSION } from "../version"

const REPO = "kevin15011/cyberpunk-plugin"
const DEFAULT_UPGRADE_TIMEOUT_MS = 2500

type UpgradeTestOverrides = {
  getRepoDir?: () => string
  gitCommand?: (args: string, cwd?: string) => string
  fetchChecksums?: (tag: string, assetName: string) => Promise<string>
  computeFileSha256?: (path: string) => string | Promise<string>
  smokeTestBinary?: (path: string) => boolean
  prepareDarwinBinary?: (path: string) => { attempted: boolean; guidance?: string }
}

const UPGRADE_TEST_OVERRIDES_KEY = Symbol.for("cyberpunk.upgrade.testOverrides")

export type BinaryVerification = {
  expectedSha256: string
  actualSha256: string
  smokeOk: boolean
  quarantineAttempted: boolean
}

function getUpgradeTestOverrides(): UpgradeTestOverrides {
  const globalWithOverrides = globalThis as typeof globalThis & { [UPGRADE_TEST_OVERRIDES_KEY]?: UpgradeTestOverrides }
  return globalWithOverrides[UPGRADE_TEST_OVERRIDES_KEY] ?? {}
}

function setUpgradeTestOverrides(overrides: UpgradeTestOverrides): void {
  const globalWithOverrides = globalThis as typeof globalThis & { [UPGRADE_TEST_OVERRIDES_KEY]?: UpgradeTestOverrides }
  globalWithOverrides[UPGRADE_TEST_OVERRIDES_KEY] = overrides
}

function getBinaryPath(): string {
  return join(
    getHomeDirAuto(),
    ".local", "bin",
    process.platform === "win32" ? "cyberpunk.exe" : "cyberpunk"
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
  const upgradeTestOverrides = getUpgradeTestOverrides()
  if (upgradeTestOverrides.getRepoDir) {
    return upgradeTestOverrides.getRepoDir()
  }

  if (existsSync(join(process.cwd(), ".git"))) {
    return process.cwd()
  }

  // There is currently no persisted, trustworthy repo checkout path in the
  // config schema. Do not infer one from component install paths: those point
  // at copied theme/plugin assets, not necessarily the Git working tree.
  return ""
}

function resolveUpgradeInstallMode(): InstallMode {
  const raw = readConfigRaw().parsed
  const rawMode = raw?.installMode
  if (rawMode === "binary" || rawMode === "repo") return rawMode

  if (existsSync(getBinaryPath()) && !existsSync(join(process.cwd(), ".git"))) {
    return "binary"
  }

  return "repo"
}

function gitCommand(args: string, cwd?: string): string {
  const upgradeTestOverrides = getUpgradeTestOverrides()
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
  setUpgradeTestOverrides(overrides)
}

export function __resetUpgradeTestOverrides(): void {
  setUpgradeTestOverrides({})
}

/**
 * Get the current app version from package.json.
 */
export function getAppVersion(): string {
  return APP_VERSION || "0.0.0"
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  return Number.isFinite(timeoutMs) && (timeoutMs ?? 0) > 0 ? timeoutMs! : DEFAULT_UPGRADE_TIMEOUT_MS
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), normalizeTimeout(timeoutMs))
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const resolvedTimeoutMs = normalizeTimeout(timeoutMs)
  const timer = setTimeout(() => controller.abort(), resolvedTimeoutMs)
  try {
    return await withTimeout(fetch(url, {
      ...init,
      headers: { "User-Agent": "cyberpunk-cli", ...init?.headers },
      signal: controller.signal,
    }), resolvedTimeoutMs, "Upgrade network request timed out")
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Upgrade network request timed out")
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b
 *   0 if a === b
 *   1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    const na = pa.core[i] || 0
    const nb = pb.core[i] || 0
    if (na < nb) return -1
    if (na > nb) return 1
  }

  if (pa.prerelease.length === 0 && pb.prerelease.length > 0) return 1
  if (pa.prerelease.length > 0 && pb.prerelease.length === 0) return -1

  const len = Math.max(pa.prerelease.length, pb.prerelease.length)
  for (let i = 0; i < len; i++) {
    const ai = pa.prerelease[i]
    const bi = pb.prerelease[i]
    if (ai === undefined && bi !== undefined) return -1
    if (ai !== undefined && bi === undefined) return 1
    if (ai === bi) continue

    const an = /^\d+$/.test(ai) ? Number(ai) : undefined
    const bn = /^\d+$/.test(bi) ? Number(bi) : undefined
    if (an !== undefined && bn !== undefined) return an < bn ? -1 : 1
    if (an !== undefined) return -1
    if (bn !== undefined) return 1
    return ai < bi ? -1 : 1
  }
  return 0
}

function parseSemver(version: string): { core: number[]; prerelease: string[] } {
  const normalized = version.trim().replace(/^v/i, "").split("+")[0]
  const [corePart, prereleasePart] = normalized.split("-", 2)
  const core = corePart.split(".").slice(0, 3).map(part => {
    const parsed = Number.parseInt(part, 10)
    return Number.isFinite(parsed) ? parsed : 0
  })
  while (core.length < 3) core.push(0)
  return { core, prerelease: prereleasePart ? prereleasePart.split(".") : [] }
}

/**
 * Detect platform asset suffix for GitHub release download.
 * Release assets follow the shared `cyberpunk-{os}-{arch}` contract used by
 * both the GitHub workflow and install.sh bootstrapper.
 */
export function getPlatformAsset(): string {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux"
  let arch = process.arch
  if (os === "darwin" && arch === "x64") {
    throw new Error("Pre-built macOS x64 binaries are no longer published. Build Cyberpunk from source on Intel Macs.")
  }
  if (arch === "x64") arch = "x64"
  else if (arch === "arm64") arch = "arm64"
  else arch = "x64" // fallback
  return `cyberpunk-${os}-${arch}${os === "windows" ? ".exe" : ""}`
}

// ── Binary verification helpers ───────────────────────────────────

/**
 * Fetch and parse SHA256 checksum from release checksums.txt for a given asset.
 */
export async function fetchChecksums(tag: string, assetName: string, timeoutMs = DEFAULT_UPGRADE_TIMEOUT_MS): Promise<string> {
  const upgradeTestOverrides = getUpgradeTestOverrides()
  if (upgradeTestOverrides.fetchChecksums) {
    return upgradeTestOverrides.fetchChecksums(tag, assetName)
  }

  const url = `https://github.com/${REPO}/releases/download/${tag}/checksums.txt`
  const resp = await fetchWithTimeout(url, timeoutMs)
  if (!resp.ok) {
    throw new Error(`Failed to fetch checksums: HTTP ${resp.status}`)
  }
  const text = await withTimeout(resp.text(), timeoutMs, "Checksum response timed out")
  const expectedAsset = basename(assetName)
  for (const line of text.split("\n")) {
    const parts = line.split(/\s+/)
    if (parts.length >= 2 && basename(parts[1]) === expectedAsset) {
      return parts[0]
    }
  }
  throw new Error(`No checksum found for ${assetName} in checksums.txt`)
}

/**
 * Compute SHA256 hex digest of a file.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  const upgradeTestOverrides = getUpgradeTestOverrides()
  if (upgradeTestOverrides.computeFileSha256) {
    return await upgradeTestOverrides.computeFileSha256(filePath)
  }

  return await new Promise((resolve, reject) => {
    const hash = createHash("sha256")
    const stream = createReadStream(filePath)
    stream.on("data", chunk => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

async function writeResponseBodyToFile(resp: Response, filePath: string, timeoutMs: number): Promise<void> {
  if (!resp.body) {
    throw new Error("Download response did not include a body")
  }

  const reader = resp.body.getReader()
  const fd = openSync(filePath, "w", 0o755)
  try {
    while (true) {
      const chunk = await withTimeout(reader.read(), timeoutMs, "Binary download response timed out")
      if (chunk.done) break
      if (chunk.value.byteLength > 0) {
        writeSync(fd, chunk.value)
      }
    }
  } finally {
    try { reader.releaseLock() } catch {}
    closeSync(fd)
  }
}

/**
 * Run a lightweight smoke test on a binary candidate.
 * Returns true if the binary can execute --help (or help subcommand).
 */
export function smokeTestBinary(tmpPath: string): boolean {
  const upgradeTestOverrides = getUpgradeTestOverrides()
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
  const upgradeTestOverrides = getUpgradeTestOverrides()
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
export async function fetchLatestReleaseTag(timeoutMs = DEFAULT_UPGRADE_TIMEOUT_MS): Promise<string> {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`
  try {
    const resp = await fetchWithTimeout(url, timeoutMs)
    if (!resp.ok) {
      throw new Error(`GitHub API returned ${resp.status}`)
    }
    const data = await withTimeout(resp.json(), timeoutMs, "Release response timed out") as { tag_name?: string }
    if (!data.tag_name) {
      throw new Error("No tag_name in release response")
    }
    return data.tag_name
  } catch (err) {
    try {
      return await fetchLatestReleaseTagFromRedirect(timeoutMs)
    } catch {
      throw err
    }
  }
}

async function fetchLatestReleaseTagFromRedirect(timeoutMs: number): Promise<string> {
  const resp = await fetchWithTimeout(`https://github.com/${REPO}/releases/latest`, timeoutMs, { redirect: "manual" })
  const location = resp.headers.get("location") ?? resp.url
  const fromLocation = parseReleaseTag(location)
  if (fromLocation) return fromLocation

  const text = await withTimeout(resp.text(), timeoutMs, "Release redirect response timed out")
  const fromBody = parseReleaseTag(text)
  if (fromBody) return fromBody
  throw new Error("Could not resolve latest GitHub release tag")
}

function parseReleaseTag(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  const tag = input.match(/\/releases\/tag\/(v?[^"'<\s?#]+)/)?.[1]
  if (!tag) return undefined
  return tag.startsWith("v") ? tag : `v${tag}`
}

/**
 * Download binary from GitHub release, verify integrity, and atomically replace.
 * Verification chain: fetchChecksums → computeFileSha256 → smokeTestBinary
 * → prepareDarwinBinary (if darwin) → atomic rename.
 * On any step failure, deletes .tmp file and throws without replacing existing binary.
 */
async function downloadAndReplaceBinary(assetName: string, tag: string, timeoutMs = DEFAULT_UPGRADE_TIMEOUT_MS): Promise<void> {
  const binaryPath = getBinaryPath()
  const downloadUrl = `https://github.com/${REPO}/releases/download/${tag}/${assetName}`
  const tmpPath = binaryPath + ".tmp"

  // Step 1: Download
  const resp = await fetchWithTimeout(downloadUrl, timeoutMs)
  if (!resp.ok) {
    throw new Error(`Download failed: HTTP ${resp.status}`)
  }

  await writeResponseBodyToFile(resp, tmpPath, timeoutMs)

  // Step 2: chmod +x
  try {
    execSync(`chmod +x "${tmpPath}"`, { stdio: "pipe" })
  } catch {
    // chmod failure is not fatal
  }

  try {
    // Step 3: Verify SHA256 checksum
    const expectedHash = await fetchChecksums(tag, assetName, timeoutMs)
    const actualHash = await computeFileSha256(tmpPath)
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

  let branch: string
  try {
    branch = getCurrentRepoBranch(repoDir)
    gitCommand(`fetch origin ${branch}`, repoDir)
  } catch (err) {
    throw new Error(`No se pudo conectar al repositorio remoto: ${err}`)
  }

  let latestVersion: string
  try {
    latestVersion = gitCommand(`rev-parse origin/${branch}`, repoDir)
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

function getCurrentRepoBranch(repoDir: string): string {
  const branch = gitCommand("rev-parse --abbrev-ref HEAD", repoDir).trim()
  if (!branch || branch === "HEAD") {
    throw new Error("No se puede actualizar en modo repo desde un HEAD detached; cambia a una rama local con upstream remoto")
  }
  return branch
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
  let branch: string
  try {
    branch = getCurrentRepoBranch(repoDir)
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
    gitCommand(`pull --ff-only origin ${branch}`, repoDir)
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

  for (const file of filesToBackup) {
    const bakPath = join(repoDir, file + ".bak")
    if (existsSync(bakPath)) {
      try { unlinkSync(bakPath) } catch {}
    }
  }

  // Update lastUpgradeCheck timestamp
  const config = loadConfig()
  config.lastUpgradeCheck = new Date().toISOString()
  saveConfig(config)
  removeUpdateCache()

  return {
    status: "upgraded",
    fromVersion: status.currentVersion,
    toVersion: status.latestVersion,
    filesUpdated: status.changedFiles,
  }
}

// ── Binary upgrade (new path) ────────────────────────────────────

export async function checkBinaryUpgrade(timeoutMs = DEFAULT_UPGRADE_TIMEOUT_MS): Promise<UpgradeStatus> {
  const currentVersion = getAppVersion()
  const assetName = getPlatformAsset()
  const latestTag = await fetchLatestReleaseTag(timeoutMs)
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

export async function runBinaryUpgrade(timeoutMs = DEFAULT_UPGRADE_TIMEOUT_MS): Promise<UpgradeResult> {
  const currentVersion = getAppVersion()
  const binaryPath = getBinaryPath()
  let assetName: string

  try {
    assetName = getPlatformAsset()
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    }
  }

  let latestTag: string
  try {
    latestTag = await fetchLatestReleaseTag(timeoutMs)
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
  try {
    await downloadAndReplaceBinary(assetName, latestTag, timeoutMs)
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
  removeUpdateCache()

  return {
    status: "upgraded",
    fromVersion: currentVersion,
    toVersion: latestVersion,
    filesUpdated: [binaryPath],
  }
}

// ── Public API — dispatch by installMode ──────────────────────────

export async function checkUpgrade(timeoutMs = DEFAULT_UPGRADE_TIMEOUT_MS): Promise<UpgradeStatus> {
  const mode = resolveUpgradeInstallMode()

  if (mode === "binary") {
    return checkBinaryUpgrade(timeoutMs)
  }

  return checkRepoUpgrade()
}

export async function runUpgrade(timeoutMs?: number): Promise<UpgradeResult> {
  const config = loadConfig()
  const mode = resolveUpgradeInstallMode()
  const resolvedTimeoutMs = timeoutMs ?? config.updates?.timeoutMs ?? DEFAULT_UPGRADE_TIMEOUT_MS

  if (mode === "binary") {
    return runBinaryUpgrade(resolvedTimeoutMs)
  }

  return runRepoUpgrade()
}
