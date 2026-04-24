// src/components/sounds.ts — generate sound files via ffmpeg

import { existsSync, mkdirSync, unlinkSync } from "fs"
import { join } from "path"
import { execSync } from "child_process"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"

function getSoundsDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "~"
  return join(home, ".config", "opencode", "sounds")
}

const SOUND_FILES = ["idle.wav", "error.wav", "compact.wav", "permission.wav"]

const SOUND_GENERATORS: Record<string, string> = {
  "idle.wav": [
    "-y -f lavfi -i sine=frequency=350:duration=0.12",
    "-f lavfi -i sine=frequency=250:duration=0.1",
    "-f lavfi -i sine=frequency=500:duration=0.15",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=100|100,volume=2.5[b];[2:a]adelay=180|180,volume=2.0[c];[a][b][c]amix=inputs=3:duration=longest,volume=4.0,lowpass=f=1500,aecho=0.6:0.4:30:0.3,bass=g=6" -t 0.5`,
  ].join(" "),
  "error.wav": [
    "-y -f lavfi -i sine=frequency=200:duration=0.2",
    "-f lavfi -i sine=frequency=150:duration=0.2",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=180|180,volume=2.5[b];[a][b]amix=inputs=2:duration=longest,volume=4.0,lowpass=f=600" -t 0.5`,
  ].join(" "),
  "compact.wav": [
    "-y -f lavfi -i sine=frequency=400:duration=0.1",
    "-f lavfi -i sine=frequency=300:duration=0.1",
    "-f lavfi -i sine=frequency=200:duration=0.15",
    "-f lavfi -i sine=frequency=350:duration=0.15",
    `-filter_complex "[0:a]adelay=0|0,volume=1.5[a];[1:a]adelay=80|80,volume=1.8[b];[2:a]adelay=160|160,volume=2.0[c];[3:a]adelay=260|260,volume=1.5[d];[a][b][c][d]amix=inputs=4:duration=longest,volume=3.0,lowpass=f=1200,aecho=0.5:0.4:25:0.2" -t 0.6`,
  ].join(" "),
  "permission.wav": [
    "-y -f lavfi -i sine=frequency=700:duration=0.06",
    "-f lavfi -i sine=frequency=900:duration=0.06",
    "-f lavfi -i sine=frequency=500:duration=0.1",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=50|50,volume=2.0[b];[2:a]adelay=100|100,volume=2.0[c];[a][b][c]amix=inputs=3:duration=longest,volume=3.5,lowpass=f=2000" -t 0.3`,
  ].join(" "),
}

function isFfmpegAvailable(): boolean {
  try {
    execSync("which ffmpeg", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function generateSound(file: string, args: string, outputDir: string): boolean {
  const outputPath = join(outputDir, file)
  const command = `ffmpeg -loglevel error -nostats ${args} ${JSON.stringify(outputPath)} >/dev/null 2>&1`
  try {
    execSync(command, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

export function getSoundsComponent(): ComponentModule {
  return {
    id: "sounds",
    label: COMPONENT_LABELS.sounds,

    async install(): Promise<InstallResult> {
      const soundsDir = getSoundsDir()

      if (!isFfmpegAvailable()) {
        return {
          component: "sounds",
          action: "install",
          status: "error",
          message: "ffmpeg no encontrado — instalá ffmpeg para generar sonidos",
        }
      }

      mkdirSync(soundsDir, { recursive: true })

      let allExisted = true
      const generatedFiles: string[] = []

      for (const [file, args] of Object.entries(SOUND_GENERATORS)) {
        const outputPath = join(soundsDir, file)
        if (existsSync(outputPath)) {
          generatedFiles.push(outputPath)
          continue
        }

        allExisted = false
        const ok = generateSound(file, args, soundsDir)
        if (ok) {
          generatedFiles.push(outputPath)
        }
      }

      const config = loadConfig()
      config.components.sounds = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
        path: soundsDir,
      }
      saveConfig(config)

      if (allExisted) {
        return {
          component: "sounds",
          action: "install",
          status: "skipped",
          message: "Todos los sonidos ya existen",
          path: soundsDir,
        }
      }

      return {
        component: "sounds",
        action: "install",
        status: "success",
        path: soundsDir,
      }
    },

    async uninstall(): Promise<InstallResult> {
      const soundsDir = getSoundsDir()

      let removed = 0
      for (const file of SOUND_FILES) {
        const filePath = join(soundsDir, file)
        if (existsSync(filePath)) {
          unlinkSync(filePath)
          removed++
        }
      }

      const config = loadConfig()
      config.components.sounds = { installed: false }
      saveConfig(config)

      if (removed === 0) {
        return {
          component: "sounds",
          action: "uninstall",
          status: "skipped",
          message: "No se encontraron archivos de sonido",
        }
      }

      return {
        component: "sounds",
        action: "uninstall",
        status: "success",
          path: soundsDir,
      }
    },

    async status(): Promise<ComponentStatus> {
      const soundsDir = getSoundsDir()

      // Check if ffmpeg is available
      if (!isFfmpegAvailable()) {
        // Check if sounds exist anyway (might have been generated before)
        const anyExist = SOUND_FILES.some(f => existsSync(join(soundsDir, f)))
        if (anyExist) {
          return {
            id: "sounds",
            label: COMPONENT_LABELS.sounds,
            status: "installed",
          }
        }
        return {
          id: "sounds",
          label: COMPONENT_LABELS.sounds,
          status: "error",
          error: "ffmpeg no encontrado",
        }
      }

      const allExist = SOUND_FILES.every(f => existsSync(join(soundsDir, f)))
      if (allExist) {
        return {
          id: "sounds",
          label: COMPONENT_LABELS.sounds,
          status: "installed",
        }
      }

      return {
        id: "sounds",
        label: COMPONENT_LABELS.sounds,
        status: "available",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks: DoctorCheck[] = []
      const soundsDir = getSoundsDir()

      // Check 1: ffmpeg available
      if (!ctx.prerequisites.ffmpeg) {
        checks.push({
          id: "sounds:ffmpeg",
          label: "ffmpeg para sonidos",
          status: "warn",
          message: "ffmpeg no encontrado — sonidos no disponibles",
          fixable: false,
        })
      } else {
        checks.push({
          id: "sounds:ffmpeg",
          label: "ffmpeg para sonidos",
          status: "pass",
          message: "ffmpeg disponible",
          fixable: false,
        })
      }

      // Check 2: all 4 .wav files exist
      const missing = SOUND_FILES.filter(f => !existsSync(join(soundsDir, f)))
      const canRegenerate = ctx.prerequisites.ffmpeg
      if (missing.length === SOUND_FILES.length) {
        checks.push({
          id: "sounds:files",
          label: "Archivos de sonido",
          status: "fail",
          message: `Ningún archivo de sonido encontrado (esperados: ${SOUND_FILES.join(", ")})`,
          fixable: canRegenerate,
        })
      } else if (missing.length > 0) {
        checks.push({
          id: "sounds:files",
          label: "Archivos de sonido",
          status: "fail",
          message: `Archivos faltantes: ${missing.join(", ")}`,
          fixable: canRegenerate,
        })
      } else {
        const details = ctx.verbose ? ` (${soundsDir})` : ""
        checks.push({
          id: "sounds:files",
          label: "Archivos de sonido",
          status: "pass",
          message: `Todos los archivos .wav existen${details}`,
          fixable: false,
        })
      }

      return { component: "sounds", checks }
    },
  }
}
