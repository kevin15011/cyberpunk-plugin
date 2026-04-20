// cyberpunk-plugin.ts — bundled slimmed plugin source (runtime only)
// The CLI plugin component copies this file to ~/.config/opencode/plugins/cyberpunk.ts

import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME!
const SOUNDS = join(HOME, ".config", "opencode", "sounds")
const IS_MAC = process.platform === "darwin"
const COMPLETION_THROTTLE_MS = 2000
let lastCompletionTime = 0

async function playSound($: any, file: string) {
  const path = join(SOUNDS, file)
  if (!existsSync(path)) return
  if (IS_MAC) {
    await $`afplay ${path}`.nothrow()
  } else {
    await $`paplay ${path}`.nothrow()
  }
}

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.error") {
        try { await playSound($, "error.wav") } catch {}
      }

      if (event.type === "session.compacted") {
        try { await playSound($, "compact.wav") } catch {}
      }

      if (event.type === "permission.asked") {
        try { await playSound($, "permission.wav") } catch {}
      }

      if (event.type === "message.updated") {
        const info = (event as any).properties?.info
        if (info?.finish) {
          const now = Date.now()
          if (now - lastCompletionTime > COMPLETION_THROTTLE_MS) {
            lastCompletionTime = now
            try { await playSound($, "idle.wav") } catch {}
          }
        }
      }
    },
  }
}
