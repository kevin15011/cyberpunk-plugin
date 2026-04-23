// src/components/theme-doctor.ts — theme diagnostics and repair for doctor

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs"
import { join } from "path"
import type { DoctorCheck, DoctorContext } from "./types"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const CONFIG_DIR = join(HOME, ".config", "opencode")
const THEMES_DIR = join(CONFIG_DIR, "themes")
const THEME_PATH = join(THEMES_DIR, "cyberpunk.json")
const TUI_PATH = join(CONFIG_DIR, "tui.json")

/**
 * Check theme component: theme JSON file exists and tui.json has theme: "cyberpunk".
 */
export async function checkThemeDoctor(_ctx: DoctorContext): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []

  // Check 1: theme file exists
  if (!existsSync(THEME_PATH)) {
    checks.push({
      id: "theme:file",
      label: "Tema cyberpunk",
      status: "fail",
      message: "Archivo cyberpunk.json no encontrado",
      fixable: true,
    })
    return checks
  }

  checks.push({
    id: "theme:file",
    label: "Tema cyberpunk",
    status: "pass",
    message: "Archivo cyberpunk.json existe",
    fixable: false,
  })

  // Check 2: tui.json has theme: "cyberpunk"
  if (!existsSync(TUI_PATH)) {
    checks.push({
      id: "theme:activation",
      label: "Activación de tema",
      status: "fail",
      message: "tui.json no encontrado — tema no activado",
      fixable: true,
    })
  } else {
    try {
      const tui = JSON.parse(readFileSync(TUI_PATH, "utf8"))
      if (tui.theme === "cyberpunk") {
        checks.push({
          id: "theme:activation",
          label: "Activación de tema",
          status: "pass",
          message: "Tema cyberpunk activado en tui.json",
          fixable: false,
        })
      } else {
        checks.push({
          id: "theme:activation",
          label: "Activación de tema",
          status: "fail",
          message: `tui.json tiene tema "${tui.theme || "(ninguno)"}" en lugar de "cyberpunk"`,
          fixable: true,
        })
      }
    } catch {
      checks.push({
        id: "theme:activation",
        label: "Activación de tema",
        status: "fail",
        message: "tui.json no es JSON válido",
        fixable: false,
      })
    }
  }

  return checks
}

/**
 * Repair theme: write theme file if missing, activate in tui.json.
 * Returns true if any repair was applied.
 */
export function repairThemeActivation(): boolean {
  let repaired = false

  // Repair 1: write theme file if missing
  if (!existsSync(THEME_PATH)) {
    mkdirSync(THEMES_DIR, { recursive: true })
    const theme = {
      "$schema": "https://opencode.ai/theme.json",
      "defs": {
        "neonPink": "#ff00ff",
        "neonCyan": "#00ffff",
        "neonGreen": "#00ff41",
        "neonRed": "#ff0055",
        "neonYellow": "#fffc00",
        "neonOrange": "#ff6600",
        "neonPurple": "#b400ff",
        "darkBg0": "#05050f",
        "darkBg1": "#0a0a1a",
        "darkBg2": "#0f0f2a",
        "darkBg3": "#1a1a3e",
        "grayMid": "#3a3a6a",
        "grayLight": "#7a7aaa",
        "grayBright": "#b0b0d0",
        "white": "#e0e0ff",
      },
      "theme": {
        "primary": "neonCyan",
        "secondary": "neonPink",
        "accent": "neonGreen",
        "error": "neonRed",
        "warning": "neonYellow",
        "success": "neonGreen",
        "info": "neonCyan",
        "text": "white",
        "textMuted": "grayLight",
        "background": "darkBg0",
        "backgroundPanel": "darkBg1",
        "backgroundElement": "darkBg2",
        "border": "darkBg3",
        "borderActive": "neonPink",
        "borderSubtle": "grayMid",
      },
    }
    const tmpPath = THEME_PATH + ".tmp"
    writeFileSync(tmpPath, JSON.stringify(theme, null, 2), "utf8")
    renameSync(tmpPath, THEME_PATH)
    repaired = true
  }

  // Repair 2: activate in tui.json
  if (!existsSync(TUI_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
    const tmpPath = TUI_PATH + ".tmp"
    writeFileSync(tmpPath, JSON.stringify({
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
    }, null, 2), "utf8")
    renameSync(tmpPath, TUI_PATH)
    repaired = true
  } else {
    try {
      const tui = JSON.parse(readFileSync(TUI_PATH, "utf8"))
      if (tui.theme !== "cyberpunk") {
        tui.theme = "cyberpunk"
        const tmpPath = TUI_PATH + ".tmp"
        writeFileSync(tmpPath, JSON.stringify(tui, null, 2), "utf8")
        renameSync(tmpPath, TUI_PATH)
        repaired = true
      }
    } catch {
      // Malformed tui.json — report-only in slice 1
    }
  }

  return repaired
}
