// cyberpunk.ts — runtime plugin (installed by cyberpunk CLI)
// ONLY handles sound playback on events — no installations, no config, no bootstrap.
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
    await $`ffplay -nodisp -autoexit -v quiet ${path}`.nothrow()
  }
}

async function playCompletionSound($: any) {
  const now = Date.now()
  if (now - lastCompletionTime > COMPLETION_THROTTLE_MS) {
    lastCompletionTime = now
    try { await playSound($, "idle.wav") } catch {}
  }
}

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await playCompletionSound($)
      }

      if (event.type === "session.status") {
        const status = (event as any).properties?.status
        if (status?.type === "idle") {
          await playCompletionSound($)
        }
      }

      if (event.type === "session.error") {
        try { await playSound($, "error.wav") } catch {}
      }

      if (event.type === "session.compacted") {
        try { await playSound($, "compact.wav") } catch {}
      }

      if (event.type === "permission.asked") {
        try { await playSound($, "permission.wav") } catch {}
      }
    },
  }
}
