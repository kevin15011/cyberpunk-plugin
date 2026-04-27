// src/components/otel-collector.ts — install otelcol-contrib, write config, set up systemd or fallback script

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync, cpSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { isCommandOnPath } from "../platform/shell"

const BINARY_NAME = "otelcol-contrib"
const SERVICE_NAME = "cyberpunk-otel-collector"
const TELEMETRY_OUTPUT_PATH = "${env:HOME}/.local/state/cyberpunk/otel/opencode-telemetry.json"

// ── Pure helpers (exported for testing) ──────────────────────────────

type SupportedArch = "x64" | "arm64"
type SupportedPlatform = "linux" | "darwin"
const ARCH_MAP: Record<SupportedArch, string> = { x64: "amd64", arm64: "arm64" }

/**
 * Build a versioned download URL for otelcol-contrib as .tar.gz
 * Pure function — no side effects, fully deterministic.
 */
export function buildDownloadUrl(version: string, platform: SupportedPlatform, arch: SupportedArch): string {
  const goArch = ARCH_MAP[arch]
  const base = "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download"
  return `${base}/v${version}/otelcol-contrib_${version}_${platform}_${goArch}.tar.gz`
}

/**
 * Parse the latest version from GitHub API release JSON response.
 * Uses regex (no jq dependency) — matches "tag_name":"vX.Y.Z"
 * Returns the bare version string (e.g. "0.150.1") or null on failure.
 */
export function parseLatestVersion(apiResponse: string): string | null {
  if (!apiResponse) return null
  const match = apiResponse.match(/"tag_name"\s*:\s*"v(\d+\.\d+\.\d+)"/)
  return match ? match[1] : null
}

/**
 * Parse version from GitHub latest redirect URL.
 * Input: "https://github.com/.../releases/tag/v0.150.1" => "0.150.1"
 * Returns null if no valid version found.
 */
export function parseVersionFromRedirectUrl(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()
  const match = trimmed.match(/\/tag\/v(\d+\.\d+\.\d+)$/m)
  return match ? match[1] : null
}

/**
 * Build the tar extraction command string for a .tar.gz archive.
 */
export function buildExtractCommand(archivePath: string, targetDir: string): string {
  return `tar -xzf "${archivePath}" -C "${targetDir}"`
}

/**
 * Resolve the absolute path to the otelcol-contrib binary.
 * Priority:
 *   1. If ~/.local/bin/otelcol-contrib exists → use that (always absolute)
 *   2. If `which otelcol-contrib` resolves → use the returned absolute path
 *   3. Fallback → return ~/.local/bin/otelcol-contrib (expected install location)
 *
 * Pure-ish: only reads filesystem and runs `which`. Does NOT write anything.
 * Exported for testing.
 */
export function resolveCollectorBinaryPath(homeDir: string): string {
  const localBinPath = join(homeDir, ".local", "bin", BINARY_NAME)

  // Priority 1: already installed at expected location
  if (existsSync(localBinPath)) return localBinPath

  // Priority 2: resolve from PATH via `which`
  try {
    const whichResult = execSync(`which ${BINARY_NAME} 2>/dev/null`, {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 3000,
    }).trim()
    if (whichResult && whichResult.startsWith("/")) return whichResult
  } catch { /* not on PATH */ }

  // Priority 3: fallback to expected install location (absolute)
  return localBinPath
}

/**
 * Build the systemd .service file content with an absolute ExecStart path.
 * Pure function — no side effects.
 */
export function buildSystemdServiceContent(binaryPath: string, configPath: string): string {
  return `[Unit]
Description=Cyberpunk OTEL Collector (otelcol-contrib)
After=network.target

[Service]
ExecStart=${binaryPath} --config ${configPath}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
}

/**
 * Build the list of systemctl commands to run after writing the service file.
 * Ordered: daemon-reload → reset-failed → enable --now
 * Pure function — returns strings only, no execution.
 */
export function buildPostWriteCommands(serviceName: string): string[] {
  return [
    `systemctl --user daemon-reload`,
    `systemctl --user reset-failed ${serviceName}`,
    `systemctl --user enable --now ${serviceName}`,
  ]
}

// ── Internal helpers ─────────────────────────────────────────────────

function getPaths() {
  const home = getHomeDirAuto()
  return {
    home,
    localBinPath: join(home, ".local", "bin", BINARY_NAME),
    configDir: join(home, ".config", "cyberpunk", "otel-collector"),
    configPath: join(home, ".config", "cyberpunk", "otel-collector", "config.yaml"),
    stateDir: join(home, ".local", "state", "cyberpunk", "otel"),
    systemdDir: join(home, ".config", "systemd", "user"),
    servicePath: join(home, ".config", "systemd", "user", `${SERVICE_NAME}.service`),
    fallbackScriptPath: join(home, ".local", "bin", SERVICE_NAME),
  }
}

function isBinaryAvailable(): boolean {
  if (isCommandOnPath(BINARY_NAME)) return true
  const { localBinPath } = getPaths()
  return existsSync(localBinPath)
}

/**
 * Resolve the current platform/arch into our typed variants, or null if unsupported.
 */
function resolvePlatform(): { platform: SupportedPlatform; arch: SupportedArch } | null {
  const p = process.platform as string
  const a = process.arch as string

  if ((p === "linux" || p === "darwin") && (a === "x64" || a === "arm64")) {
    return { platform: p, arch: a }
  }
  return null
}

/**
 * Resolve latest version via GitHub redirect (lightweight — no large API response).
 * Uses curl HEAD to follow redirect and extract version from final URL.
 * Returns bare version string or null on failure.
 */
function resolveLatestVersionViaRedirect(): string | null {
  try {
    const url = execSync(
      'curl -fsSLI -o /dev/null -w "%{url_effective}" https://github.com/open-telemetry/opentelemetry-collector-releases/releases/latest',
      { encoding: "utf8", stdio: "pipe", timeout: 15000 }
    )
    return parseVersionFromRedirectUrl(url)
  } catch {
    return null
  }
}

/**
 * Resolve latest version from GitHub API (fallback).
 * Uses increased maxBuffer to handle large API responses with many assets.
 * Returns bare version string or null on failure.
 */
function resolveLatestVersionViaApi(): string | null {
  try {
    const response = execSync(
      "curl -fsSL https://api.github.com/repos/open-telemetry/opentelemetry-collector-releases/releases/latest",
      { encoding: "utf8", stdio: "pipe", timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    )
    return parseLatestVersion(response)
  } catch {
    return null
  }
}

/**
 * Resolve latest version: redirect method first (lightweight), then API fallback (maxBuffer).
 * Returns bare version string or null on failure.
 */
function resolveLatestVersion(): string | null {
  return resolveLatestVersionViaRedirect() ?? resolveLatestVersionViaApi()
}

/**
 * Build the download URL for otelcol-contrib.
 * Resolves latest version via GitHub API, then constructs versioned .tar.gz URL.
 * Backward-compatible wrapper — returns null on any failure.
 */
function getDownloadUrl(): { url: string; arch: string; version: string } | null {
  const info = getDownloadInfo()
  if (info.status !== "ok") return null
  return { url: info.url, arch: info.arch, version: info.version }
}

/**
 * Discriminated union result for download info.
 * Distinguishes unsupported platform from version resolution failure.
 */
export type DownloadInfo =
  | { status: "ok"; url: string; arch: string; version: string }
  | { status: "unsupported" }
  | { status: "version-unavailable" }

/**
 * Get download info with explicit platform/arch/version for testability.
 * When version is not provided, resolves latest via network.
 * Returns discriminated union to distinguish error cases.
 */
export function getDownloadInfo(
  platform?: string,
  arch?: string,
  version?: string | null
): DownloadInfo {
  const p = platform ?? process.platform
  const a = arch ?? process.arch

  if (!((p === "linux" || p === "darwin") && (a === "x64" || a === "arm64"))) {
    return { status: "unsupported" }
  }

  const typedPlatform = p as SupportedPlatform
  const typedArch = a as SupportedArch
  const goArch = ARCH_MAP[typedArch]

  // If version explicitly passed as null/empty → version unavailable
  // If version explicitly passed as string → use it
  // If version undefined → resolve from network
  let resolvedVersion: string | null
  if (version === undefined) {
    resolvedVersion = resolveLatestVersion()
  } else {
    resolvedVersion = version || null
  }

  if (!resolvedVersion) {
    return { status: "version-unavailable" }
  }

  const url = buildDownloadUrl(resolvedVersion, typedPlatform, typedArch)
  return { status: "ok", url, arch: goArch, version: resolvedVersion }
}

function downloadBinary(): { success: boolean; errorType?: "unsupported" | "version-unavailable" } {
  const downloadInfo = getDownloadInfo()
  if (downloadInfo.status === "unsupported") {
    return { success: false, errorType: "unsupported" }
  }
  if (downloadInfo.status === "version-unavailable") {
    return { success: false, errorType: "version-unavailable" }
  }

  try {
    const home = getHomeDirAuto()
    const localBin = join(home, ".local", "bin")
    mkdirSync(localBin, { recursive: true })

    // Validate tar is available
    if (!isCommandOnPath("tar")) {
      return { success: false }
    }

    // Create temp dir for extraction
    const tmpDir = join(home, ".local", "tmp", `otel-install-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    const archivePath = join(tmpDir, `otelcol-contrib_${downloadInfo.version}.tar.gz`)
    const targetPath = getPaths().localBinPath

    // Download .tar.gz
    execSync(
      `curl -fsSL -o "${archivePath}" "${downloadInfo.url}"`,
      { stdio: "pipe", timeout: 120000 }
    )

    if (!existsSync(archivePath)) return { success: false }

    // Extract
    execSync(buildExtractCommand(archivePath, tmpDir), { stdio: "pipe", timeout: 30000 })

    // Find and copy the binary
    const extractedBinary = join(tmpDir, BINARY_NAME)
    if (!existsSync(extractedBinary)) return { success: false }

    cpSync(extractedBinary, targetPath)
    execSync(`chmod +x "${targetPath}"`, { stdio: "pipe" })

    // Cleanup tmpdir
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* best effort */ }

    return { success: existsSync(targetPath) }
  } catch {
    return { success: false }
  }
}

function isSystemdAvailable(): boolean {
  try {
    execSync("systemctl --user status 2>/dev/null", { stdio: "pipe", timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function buildOtelCollectorConfig(outputPath: string): string {
  return `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 127.0.0.1:4317
      http:
        endpoint: 127.0.0.1:4318

exporters:
  file:
    path: ${outputPath}
    rotation:
      max_megabytes: 10
      max_backups: 3

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [file]
    metrics:
      receivers: [otlp]
      exporters: [file]
    logs:
      receivers: [otlp]
      exporters: [file]
`
}

function writeConfig(): boolean {
  const { configDir, configPath, stateDir } = getPaths()
  mkdirSync(configDir, { recursive: true })
  mkdirSync(stateDir, { recursive: true })

  const content = buildOtelCollectorConfig(TELEMETRY_OUTPUT_PATH)
  if (existsSync(configPath)) {
    const existing = readFileSync(configPath, "utf8")
    if (existing === content) return false
  }

  const tmpPath = configPath + ".tmp"
  writeFileSync(tmpPath, content, "utf8")
  const { renameSync } = require("fs") as typeof import("fs")
  renameSync(tmpPath, configPath)
  return true
}

function writeSystemdService(): { written: boolean; enabled?: boolean; enableError?: string } {
  const { systemdDir, servicePath, configPath } = getPaths()
  const home = getHomeDirAuto()
  mkdirSync(systemdDir, { recursive: true })

  const binaryPath = resolveCollectorBinaryPath(home)
  const content = buildSystemdServiceContent(binaryPath, configPath)

  let written = false
  if (existsSync(servicePath)) {
    const existing = readFileSync(servicePath, "utf8")
    if (existing === content) {
      // File unchanged, but still try to enable/start
      written = false
    } else {
      written = true
    }
  } else {
    written = true
  }

  if (written) {
    const tmpPath = servicePath + ".tmp"
    writeFileSync(tmpPath, content, "utf8")
    const { renameSync } = require("fs") as typeof import("fs")
    renameSync(tmpPath, servicePath)
  }

  // Post-write: daemon-reload → reset-failed → enable --now (best effort)
  const cmds = buildPostWriteCommands(SERVICE_NAME)
  let enabled = false
  let enableError: string | undefined

  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: "pipe", timeout: 3000 })
    } catch (err: any) {
      // daemon-reload may fail if user systemd not running — continue
      // reset-failed can fail if service never ran — that's OK
      // enable --now failure is reported but not fatal
      if (cmd.includes("enable --now")) {
        enableError = err?.message || String(err)
      }
    }
  }
  enabled = !enableError

  return { written, enabled, enableError }
}

function writeFallbackScript(): boolean {
  const { fallbackScriptPath, configPath } = getPaths()
  const home = getHomeDirAuto()
  const binaryPath = resolveCollectorBinaryPath(home)

  const content = `#!/bin/bash
# cyberpunk-otel-collector — start/stop/status for otelcol-contrib
case "$1" in
  start)
    if pgrep -f "${binaryPath}" > /dev/null 2>&1; then
      echo "otel-collector already running"
      exit 0
    fi
    nohup ${binaryPath} --config ${configPath} > /dev/null 2>&1 &
    echo "otel-collector started"
    ;;
  stop)
    pkill -f "${binaryPath}" 2>/dev/null
    echo "otel-collector stopped"
    ;;
  status)
    if pgrep -f "${binaryPath}" > /dev/null 2>&1; then
      echo "otel-collector running"
    else
      echo "otel-collector not running"
      exit 1
    fi
    ;;
  *)
    echo "Usage: ${SERVICE_NAME} {start|stop|status}"
    exit 1
    ;;
esac
`

  if (existsSync(fallbackScriptPath)) {
    const existing = readFileSync(fallbackScriptPath, "utf8")
    if (existing === content) return false
  }

  const tmpPath = fallbackScriptPath + ".tmp"
  writeFileSync(tmpPath, content, "utf8")
  const { renameSync, chmodSync } = require("fs") as typeof import("fs")
  renameSync(tmpPath, fallbackScriptPath)
  chmodSync(fallbackScriptPath, 0o755)
  return true
}

function removeConfig(): void {
  const { configPath } = getPaths()
  if (existsSync(configPath)) unlinkSync(configPath)
}

function removeService(): void {
  const { servicePath } = getPaths()
  if (existsSync(servicePath)) {
    unlinkSync(servicePath)
    try {
      execSync("systemctl --user daemon-reload", { stdio: "pipe", timeout: 5000 })
    } catch { /* best effort */ }
  }
}

function removeFallbackScript(): void {
  const { fallbackScriptPath } = getPaths()
  if (existsSync(fallbackScriptPath)) unlinkSync(fallbackScriptPath)
}

function isPortListening(port: number): boolean {
  try {
    const result = execSync(
      `ss -tlnp 2>/dev/null | grep ':${port}' || true`,
      { encoding: "utf8", stdio: "pipe", timeout: 3000 }
    )
    return result.includes(`:${port}`)
  } catch {
    return false
  }
}

export function getOtelCollectorComponent(): ComponentModule {
  return {
    id: "otel-collector",
    label: COMPONENT_LABELS["otel-collector"],

    async install(): Promise<InstallResult> {
      const { configPath } = getPaths()

      // Auto-download binary if missing
      let alreadyInstalled = isBinaryAvailable()
      if (!alreadyInstalled) {
        const downloadResult = downloadBinary()
        if (!downloadResult.success) {
          if (downloadResult.errorType === "unsupported") {
            return {
              component: "otel-collector",
              action: "install",
              status: "error",
              message: `Plataforma no soportada para descarga automática (${process.platform}/${process.arch}). Instalá otelcol-contrib manualmente de https://github.com/open-telemetry/opentelemetry-collector-releases`,
            }
          }
          if (downloadResult.errorType === "version-unavailable") {
            return {
              component: "otel-collector",
              action: "install",
              status: "error",
              message: `No se pudo resolver la última versión de otelcol-contrib. Revisá tu conexión a internet y el acceso a la API de GitHub (https://api.github.com). Podés instalar manualmente desde https://github.com/open-telemetry/opentelemetry-collector-releases`,
            }
          }
          // Generic download/extraction failure
          const hasTar = isCommandOnPath("tar")
          const hint = !hasTar
            ? "tar no encontrado — instalá tar (ej: sudo apt install tar) y reintentá"
            : "Error al descargar/extraer otelcol-contrib — descargá manualmente de https://github.com/open-telemetry/opentelemetry-collector-releases"
          return {
            component: "otel-collector",
            action: "install",
            status: "error",
            message: hint,
          }
        }
      }

      // Write config
      writeConfig()

      // Set up service
      if (isSystemdAvailable()) {
        writeSystemdService()
      } else {
        writeFallbackScript()
      }

      const config = loadConfig()
      config.components["otel-collector"] = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: configPath,
      }
      saveConfig(config)

      return {
        component: "otel-collector",
        action: "install",
        status: alreadyInstalled ? "skipped" : "success",
        message: alreadyInstalled
          ? "otelcol-contrib ya instalado, config actualizada"
          : "otelcol-contrib instalado y configurado",
        path: configPath,
      }
    },

    async uninstall(): Promise<InstallResult> {
      removeConfig()
      removeService()
      removeFallbackScript()

      const config = loadConfig()
      config.components["otel-collector"] = { installed: false }
      saveConfig(config)

      return {
        component: "otel-collector",
        action: "uninstall",
        status: "success",
      }
    },

    async status(): Promise<ComponentStatus> {
      const { configPath } = getPaths()
      const binaryOk = isBinaryAvailable()
      const configExists = existsSync(configPath)

      if (binaryOk && configExists) {
        return {
          id: "otel-collector",
          label: COMPONENT_LABELS["otel-collector"],
          status: "installed",
        }
      }

      if (!binaryOk && !isCommandOnPath("curl")) {
        return {
          id: "otel-collector",
          label: COMPONENT_LABELS["otel-collector"],
          status: "error",
          error: "curl no encontrado (necesario para instalar otelcol-contrib)",
        }
      }

      return {
        id: "otel-collector",
        label: COMPONENT_LABELS["otel-collector"],
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []
      const { configPath, servicePath, fallbackScriptPath } = getPaths()

      // Check 1: binary
      if (!isBinaryAvailable()) {
        checks.push({
          id: "otel-collector:binary",
          label: "otelcol-contrib binary",
          status: "fail",
          message: "otelcol-contrib no encontrado en PATH ni en ~/.local/bin",
          fixable: false,
        })
      } else {
        checks.push({
          id: "otel-collector:binary",
          label: "otelcol-contrib binary",
          status: "pass",
          message: "otelcol-contrib disponible",
          fixable: false,
        })
      }

      // Check 2: config file
      if (!existsSync(configPath)) {
        checks.push({
          id: "otel-collector:config",
          label: "Config OTEL Collector",
          status: "fail",
          message: "config.yaml no encontrado",
          fixable: true,
        })
      } else {
        const content = readFileSync(configPath, "utf8")
        const hasLocalBind = content.includes("127.0.0.1:4317")
        if (!hasLocalBind) {
          checks.push({
            id: "otel-collector:config",
            label: "Config OTEL Collector",
            status: "warn",
            message: "config.yaml existe pero no bindea a 127.0.0.1",
            fixable: true,
          })
        } else {
          checks.push({
            id: "otel-collector:config",
            label: "Config OTEL Collector",
            status: "pass",
            message: "config.yaml existe y bindea solo a localhost",
            fixable: false,
          })
        }
      }

      // Check 3: service or fallback script
      const hasService = existsSync(servicePath)
      const hasFallback = existsSync(fallbackScriptPath)
      if (!hasService && !hasFallback) {
        checks.push({
          id: "otel-collector:service",
          label: "Servicio/Script OTEL Collector",
          status: "fail",
          message: "No se encontró servicio systemd ni script fallback",
          fixable: true,
        })
      } else {
        const method = hasService ? "systemd --user" : "script fallback"
        checks.push({
          id: "otel-collector:service",
          label: "Servicio/Script OTEL Collector",
          status: "pass",
          message: `Configurado via ${method}`,
          fixable: false,
        })
      }

      // Check 4: port 4317 listening (warn, not fatal)
      const listening = isPortListening(4317)
      if (!listening) {
        checks.push({
          id: "otel-collector:port",
          label: "Puerto 4317",
          status: "warn",
          message: "Puerto 4317 no escuchando — el collector puede no estar corriendo",
          fixable: false,
        })
      } else {
        checks.push({
          id: "otel-collector:port",
          label: "Puerto 4317",
          status: "pass",
          message: "Puerto 4317 escuchando",
          fixable: false,
        })
      }

      return { component: "otel-collector", checks }
    },
  }
}

// Export helpers for testing
export { getDownloadUrl, buildOtelCollectorConfig, resolvePlatform }
