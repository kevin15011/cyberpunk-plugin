// src/commands/upgrade.ts — git fetch, compare versions, replace files preserving config

import { existsSync, copyFileSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"

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

function getRepoDir(): string {
  // If run from the repo, use current dir
  if (existsSync(join(process.cwd(), ".git"))) {
    return process.cwd()
  }
  // Otherwise can't upgrade
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

export async function checkUpgrade(): Promise<UpgradeStatus> {
  const repoDir = getRepoDir()
  if (!repoDir) {
    throw new Error("No se pudo determinar el directorio del repositorio")
  }

  // Get current version from git
  let currentVersion: string
  try {
    currentVersion = gitCommand("rev-parse HEAD", repoDir)
  } catch {
    currentVersion = "unknown"
  }

  // Fetch remote
  try {
    gitCommand("fetch origin main", repoDir)
  } catch (err) {
    throw new Error(`No se pudo conectar al repositorio remoto: ${err}`)
  }

  // Get latest remote version
  let latestVersion: string
  try {
    latestVersion = gitCommand("rev-parse origin/main", repoDir)
  } catch {
    throw new Error("No se pudo obtener la versión remota")
  }

  const upToDate = currentVersion === latestVersion

  // Get changed files
  let changedFiles: string[] = []
  if (!upToDate) {
    try {
      const diff = gitCommand(`diff --name-only ${currentVersion}..${latestVersion}`, repoDir)
      changedFiles = diff.split("\n").filter(Boolean)
    } catch {
      changedFiles = []
    }
  }

  // DO NOT write config in check-only mode — spec says --check MUST NOT modify files

  return {
    currentVersion,
    latestVersion,
    upToDate,
    changedFiles,
  }
}

export async function runUpgrade(): Promise<UpgradeResult> {
  const repoDir = getRepoDir()
  if (!repoDir) {
    return {
      status: "error",
      error: "No se pudo determinar el directorio del repositorio",
    }
  }

  // First check
  let status: UpgradeStatus
  try {
    status = await checkUpgrade()
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

  // Pull the update
  try {
    gitCommand("pull origin main", repoDir)
  } catch (err) {
    // Restore backups on failure
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

  // Verify config is preserved (should be since config.json is in .gitignore)
  // Config at ~/.config/cyberpunk/config.json is separate from repo

  // Update lastUpgradeCheck timestamp only when actually upgrading
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
