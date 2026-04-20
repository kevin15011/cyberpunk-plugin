// cyberpunk-plugin.ts — bundled slimmed plugin source (runtime only)
// The CLI plugin component copies this file to ~/.config/opencode/plugins/cyberpunk.ts

import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME!
const SOUNDS = join(HOME, ".config", "opencode", "sounds")
const IS_MAC = process.platform === "darwin"

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
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        try { await playSound($, "idle.m4a") } catch {}
      }

      if (event.type === "session.error") {
        try { await playSound($, "error.m4a") } catch {}
      }

      if (event.type === "session.compacted") {
        try { await playSound($, "compact.m4a") } catch {}
      }

      if (event.type === "permission.asked") {
        try { await playSound($, "permission.m4a") } catch {}
      }
    },
  }
}
