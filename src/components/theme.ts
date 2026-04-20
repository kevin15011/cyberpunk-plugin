// src/components/theme.ts — write theme JSON + activate in tui.json

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"

const HOME = process.env.HOME || process.env.USERPROFILE || "~"
const CONFIG_DIR = join(HOME, ".config", "opencode")
const THEMES_DIR = join(CONFIG_DIR, "themes")
const THEME_PATH = join(THEMES_DIR, "cyberpunk.json")
const TUI_PATH = join(CONFIG_DIR, "tui.json")

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
  if (existsSync(TUI_PATH)) {
    const tui = JSON.parse(readFileSync(TUI_PATH, "utf8"))
    if (tui.theme !== "cyberpunk") {
      tui.theme = "cyberpunk"
      writeFileSync(TUI_PATH, JSON.stringify(tui, null, 2))
    }
  } else {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(TUI_PATH, JSON.stringify({
      "$schema": "https://opencode.ai/tui.json",
      theme: "cyberpunk",
    }, null, 2))
  }
}

function deactivateTheme(): void {
  if (existsSync(TUI_PATH)) {
    const tui = JSON.parse(readFileSync(TUI_PATH, "utf8"))
    if (tui.theme === "cyberpunk") {
      tui.theme = undefined
      writeFileSync(TUI_PATH, JSON.stringify(tui, null, 2))
    }
  }
}

export function getThemeComponent(): ComponentModule {
  return {
    id: "theme",
    label: COMPONENT_LABELS.theme,

    async install(): Promise<InstallResult> {
      mkdirSync(THEMES_DIR, { recursive: true })

      // Back up existing theme if it differs
      if (existsSync(THEME_PATH)) {
        const existing = readFileSync(THEME_PATH, "utf8")
        if (existing === CYBERPUNK_THEME) {
          // Activate even if file is already there
          activateTheme()

          const config = loadConfig()
          config.components.theme = {
            installed: true,
            version: "bundled",
            installedAt: new Date().toISOString(),
            path: THEME_PATH,
          }
          saveConfig(config)

          return {
            component: "theme",
            action: "install",
            status: "skipped",
            message: "Tema ya instalado y actualizado",
            path: THEME_PATH,
          }
        }
        // Back up the existing file
        writeFileSync(THEME_PATH + ".bak", existing, "utf8")
      }

      writeFileSync(THEME_PATH, CYBERPUNK_THEME, "utf8")
      activateTheme()

      const config = loadConfig()
      config.components.theme = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: THEME_PATH,
      }
      saveConfig(config)

      return {
        component: "theme",
        action: "install",
        status: "success",
        path: THEME_PATH,
      }
    },

    async uninstall(): Promise<InstallResult> {
      if (!existsSync(THEME_PATH)) {
        return {
          component: "theme",
          action: "uninstall",
          status: "skipped",
          message: "Tema no instalado",
        }
      }

      unlinkSync(THEME_PATH)
      deactivateTheme()

      const config = loadConfig()
      config.components.theme = { installed: false }
      saveConfig(config)

      return {
        component: "theme",
        action: "uninstall",
        status: "success",
        path: THEME_PATH,
      }
    },

    async status(): Promise<ComponentStatus> {
      if (!existsSync(THEME_PATH)) {
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
  }
}
