import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME!
const CONFIG = join(HOME, ".config", "opencode")
const SOUNDS = join(CONFIG, "sounds")
const THEMES = join(CONFIG, "themes")
const IS_MAC = process.platform === "darwin"

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

const SOUND_GENERATORS: Record<string, string> = {
  "idle.m4a": [
    "-y -f lavfi -i sine=frequency=350:duration=0.12",
    "-f lavfi -i sine=frequency=250:duration=0.1",
    "-f lavfi -i sine=frequency=500:duration=0.15",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=100|100,volume=2.5[b];[2:a]adelay=180|180,volume=2.0[c];[a][b][c]amix=inputs=3:duration=longest,volume=4.0,lowpass=f=1500,aecho=0.6:0.4:30:0.3,bass=g=6" -t 0.5`
  ].join(" "),
  "error.m4a": [
    "-y -f lavfi -i sine=frequency=200:duration=0.2",
    "-f lavfi -i sine=frequency=150:duration=0.2",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=180|180,volume=2.5[b];[a][b]amix=inputs=2:duration=longest,volume=4.0,lowpass=f=600" -t 0.5`
  ].join(" "),
  "compact.m4a": [
    "-y -f lavfi -i sine=frequency=400:duration=0.1",
    "-f lavfi -i sine=frequency=300:duration=0.1",
    "-f lavfi -i sine=frequency=200:duration=0.15",
    "-f lavfi -i sine=frequency=350:duration=0.15",
    `-filter_complex "[0:a]adelay=0|0,volume=1.5[a];[1:a]adelay=80|80,volume=1.8[b];[2:a]adelay=160|160,volume=2.0[c];[3:a]adelay=260|260,volume=1.5[d];[a][b][c][d]amix=inputs=4:duration=longest,volume=3.0,lowpass=f=1200,aecho=0.5:0.4:25:0.2" -t 0.6`
  ].join(" "),
  "permission.m4a": [
    "-y -f lavfi -i sine=frequency=700:duration=0.06",
    "-f lavfi -i sine=frequency=900:duration=0.06",
    "-f lavfi -i sine=frequency=500:duration=0.1",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=50|50,volume=2.0[b];[2:a]adelay=100|100,volume=2.0[c];[a][b][c]amix=inputs=3:duration=longest,volume=3.5,lowpass=f=2000" -t 0.3`
  ].join(" "),
}

const stats = {
  tools: 0,
  edits: 0,
  bash: 0,
  errors: 0,
  startTime: 0,
}

let installed = false

async function install($: any) {
  if (installed) return
  installed = true

  mkdirSync(THEMES, { recursive: true })
  mkdirSync(SOUNDS, { recursive: true })

  const themePath = join(THEMES, "cyberpunk.json")
  if (!existsSync(themePath)) {
    writeFileSync(themePath, CYBERPUNK_THEME)
    console.log("\x1b[38;5;201m>> CYBERPUNK THEME INSTALLED // Reboot to apply\x1b[0m")
  }

  const tuiPath = join(CONFIG, "tui.json")
  if (existsSync(tuiPath)) {
    const tui = JSON.parse(await Bun.file(tuiPath).text())
    if (tui.theme !== "cyberpunk") {
      tui.theme = "cyberpunk"
      writeFileSync(tuiPath, JSON.stringify(tui, null, 2))
      console.log("\x1b[38;5;45m>> THEME ACTIVATED // cyberpunk\x1b[0m")
    }
  } else {
    writeFileSync(tuiPath, JSON.stringify({ "$schema": "https://opencode.ai/tui.json", theme: "cyberpunk" }, null, 2))
  }

  for (const [file, args] of Object.entries(SOUND_GENERATORS)) {
    const path = join(SOUNDS, file)
    if (!existsSync(path)) {
      try {
        await $`ffmpeg ${args.split(" ")} ${path} 2>/dev/null`.nothrow()
      } catch {}
    }
  }
}

async function playSound($: any, file: string) {
  const path = join(SOUNDS, file)
  if (!existsSync(path)) return
  if (IS_MAC) {
    await $`afplay ${path}`.nothrow()
  } else {
    await $`ffplay -nodisp -autoexit -v quiet ${path}`.nothrow()
  }
}

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  await install($)

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        stats.tools = 0
        stats.edits = 0
        stats.bash = 0
        stats.errors = 0
        stats.startTime = Date.now()
      }

      if (event.type === "session.idle") {
        try { await playSound($, "idle.m4a") } catch {}
      }

      if (event.type === "session.error") {
        stats.errors++
        try { await playSound($, "error.m4a") } catch {}
      }

      if (event.type === "session.compacted") {
        try { await playSound($, "compact.m4a") } catch {}
      }

      if (event.type === "permission.asked") {
        try { await playSound($, "permission.m4a") } catch {}
      }
    },

    "tool.execute.after": async (input) => {
      stats.tools++
      if (input.tool === "edit" || input.tool === "write") stats.edits++
      if (input.tool === "bash") stats.bash++
    },
  }
}
