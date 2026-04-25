// src/components/theme.ts — write theme JSON + activate in tui.json

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"

function getThemePaths() {
  const home = getHomeDirAuto()
  const configDir = join(home, ".config", "opencode")
  const themesDir = join(configDir, "themes")

  return {
    configDir,
    themesDir,
    themePath: join(themesDir, "cyberpunk.json"),
    tuiPath: join(configDir, "tui.json"),
  }
}

const CYBERPUNK_THEME = JSON.stringify({
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
    "white": "#e0e0ff"
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
    "diffAdded": "neonGreen",
    "diffRemoved": "neonRed",
    "diffContext": "grayMid",
    "diffHunkHeader": "neonCyan",
    "diffHighlightAdded": "#39ff14",
    "diffHighlightRemoved": "#ff0040",
    "diffAddedBg": "#0a1a0a",
    "diffRemovedBg": "#1a0a0a",
    "diffContextBg": "darkBg1",
    "diffLineNumber": "grayMid",
    "diffAddedLineNumberBg": "#0a1a0a",
    "diffRemovedLineNumberBg": "#1a0a0a",
    "markdownText": "grayBright",
    "markdownHeading": "neonPink",
    "markdownLink": "neonCyan",
    "markdownLinkText": "neonGreen",
    "markdownCode": "neonYellow",
    "markdownBlockQuote": "grayMid",
    "markdownEmph": "neonOrange",
    "markdownStrong": "neonPink",
    "markdownHorizontalRule": "darkBg3",
    "markdownListItem": "neonCyan",
    "markdownListEnumeration": "neonPink",
    "markdownImage": "neonCyan",
    "markdownImageText": "neonGreen",
    "markdownCodeBlock": "white",
    "syntaxComment": "grayMid",
    "syntaxKeyword": "neonPink",
    "syntaxFunction": "neonCyan",
    "syntaxVariable": "neonGreen",
    "syntaxString": "neonYellow",
    "syntaxNumber": "neonPurple",
    "syntaxType": "neonOrange",
    "syntaxOperator": "neonCyan",
    "syntaxPunctuation": "grayLight"
  }
}, null, 2)

function activateTheme(): void {
  const { configDir, tuiPath } = getThemePaths()

  if (existsSync(tuiPath)) {
    const tui = JSON.parse(readFileSync(tuiPath, "utf8"))
    if (tui.theme !== "cyberpunk") {
      tui.theme = "cyberpunk"
      writeFileSync(tuiPath, JSON.stringify(tui, null, 2))
    }
  } else {
    mkdirSync(configDir, { recursive: true })
    writeFileSync(tuiPath, JSON.stringify({
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
    }, null, 2))
  }
}

function deactivateTheme(): void {
  const { tuiPath } = getThemePaths()

  if (existsSync(tuiPath)) {
    const tui = JSON.parse(readFileSync(tuiPath, "utf8"))
    if (tui.theme === "cyberpunk") {
      tui.theme = undefined
      writeFileSync(tuiPath, JSON.stringify(tui, null, 2))
    }
  }
}

export function getThemeComponent(): ComponentModule {
  return {
    id: "theme",
    label: COMPONENT_LABELS.theme,

    async install(): Promise<InstallResult> {
      const { themesDir, themePath } = getThemePaths()
      mkdirSync(themesDir, { recursive: true })

      // Back up existing theme if it differs
      if (existsSync(themePath)) {
        const existing = readFileSync(themePath, "utf8")
        if (existing === CYBERPUNK_THEME) {
          // Activate even if file is already there
          activateTheme()

          const config = loadConfig()
          config.components.theme = {
            installed: true,
            version: "bundled",
            installedAt: new Date().toISOString(),
            path: themePath,
          }
          saveConfig(config)

          return {
            component: "theme",
            action: "install",
            status: "skipped",
            message: "Tema ya instalado y actualizado",
            path: themePath,
          }
        }
        // Back up the existing file
        writeFileSync(themePath + ".bak", existing, "utf8")
      }

      writeFileSync(themePath, CYBERPUNK_THEME, "utf8")
      activateTheme()

      const config = loadConfig()
      config.components.theme = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: themePath,
      }
      saveConfig(config)

      return {
        component: "theme",
        action: "install",
        status: "success",
        path: themePath,
      }
    },

    async uninstall(): Promise<InstallResult> {
      const { themePath } = getThemePaths()

      if (!existsSync(themePath)) {
        return {
          component: "theme",
          action: "uninstall",
          status: "skipped",
          message: "Tema no instalado",
        }
      }

      unlinkSync(themePath)
      deactivateTheme()

      const config = loadConfig()
      config.components.theme = { installed: false }
      saveConfig(config)

      return {
        component: "theme",
        action: "uninstall",
        status: "success",
        path: themePath,
      }
    },

    async status(): Promise<ComponentStatus> {
      const { themePath } = getThemePaths()

      if (!existsSync(themePath)) {
        return {
          id: "theme",
          label: COMPONENT_LABELS.theme,
          status: "available",
        }
      }

      return {
        id: "theme",
        label: COMPONENT_LABELS.theme,
        status: "installed",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const { checkThemeDoctor } = await import("./theme-doctor")
      const checks = await checkThemeDoctor(ctx)
      return { component: "theme", checks }
    },
  }
}
