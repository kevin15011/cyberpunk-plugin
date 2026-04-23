// src/components/config-doctor.ts — config integrity checks and repair for doctor

import type { DoctorCheck } from "./types"
import { readConfigRaw } from "../config/load"
import { existsSync, mkdirSync, writeFileSync, renameSync } from "fs"
import { createDefaultConfig } from "../config/schema"

/**
 * Check config integrity: exists, is valid JSON, has required fields.
 * Read-only — does NOT auto-create or normalize.
 */
export function checkConfigDoctor(
  configRaw: ReturnType<typeof readConfigRaw>
): DoctorCheck[] {
  const checks: DoctorCheck[] = []

  // Check 1: file exists
  if (!existsSync(configRaw.path)) {
    checks.push({
      id: "config:integrity",
      label: "Config",
      status: "fail",
      message: "Archivo de configuración no existe",
      fixable: true,
    })
    return checks
  }

  // Check 2: parseable JSON
  if (configRaw.error !== null) {
    checks.push({
      id: "config:integrity",
      label: "Config",
      status: "fail",
      message: `JSON inválido: ${configRaw.error}`,
      fixable: false,
    })
    return checks
  }

  // Check 3: required fields
  const parsed = configRaw.parsed!
  const missingFields: string[] = []
  if (parsed.version === undefined) missingFields.push("version")
  if (parsed.components === undefined) missingFields.push("components")

  if (missingFields.length > 0) {
    checks.push({
      id: "config:integrity",
      label: "Config",
      status: "fail",
      message: `Campos faltantes: ${missingFields.join(", ")}`,
      fixable: true,
    })
  } else {
    checks.push({
      id: "config:integrity",
      label: "Config",
      status: "pass",
      message: "Config JSON válido con campos requeridos",
      fixable: false,
    })
  }

  return checks
}

/**
 * Repair config: write default config if file is missing or missing required fields.
 * Returns true if a repair was written, false otherwise.
 * Malformed JSON is NOT repaired (report-only in slice 1).
 */
export function repairConfigDefaults(): boolean {
  const configRaw = readConfigRaw()

  // If file doesn't exist — write defaults
  if (!existsSync(configRaw.path)) {
    writeDefaultConfig(configRaw.path)
    return true
  }

  // If JSON is invalid — report-only, do not repair
  if (configRaw.error !== null) {
    return false
  }

  // If missing required fields — merge defaults
  const parsed = configRaw.parsed!
  const needsVersion = parsed.version === undefined
  const needsComponents = parsed.components === undefined

  if (needsVersion || needsComponents) {
    const defaults = createDefaultConfig()
    if (needsVersion) parsed.version = defaults.version
    if (needsComponents) parsed.components = defaults.components as any // eslint-disable-line @typescript-eslint/no-explicit-any

    // Atomic write
    const tmpPath = configRaw.path + ".tmp"
    writeFileSync(tmpPath, JSON.stringify(parsed, null, 2) + "\n", "utf8")
    renameSync(tmpPath, configRaw.path)
    return true
  }

  return false
}

function writeDefaultConfig(configPath: string): void {
  const configDir = configPath.substring(0, configPath.lastIndexOf("/"))
  mkdirSync(configDir, { recursive: true })
  const defaults = createDefaultConfig()
  const tmpPath = configPath + ".tmp"
  writeFileSync(tmpPath, JSON.stringify(defaults, null, 2) + "\n", "utf8")
  renameSync(tmpPath, configPath)
}
