// src/index.ts — entry point: argv parse → command dispatch

import { parseArgs } from "./cli/parse-args"
import { formatHelp, formatStatus, formatInstallResults, formatUpgradeStatus, formatUpgradeResult, formatDoctorText, formatDoctorJson, formatPresetPreflight, formatToolUpdateResults, formatToolUpdateStatuses } from "./cli/output"
import { runInstall, runUninstall } from "./commands/install"
import { collectStatus } from "./commands/status"
import { buildPresetPreflight } from "./commands/preflight"
import { runConfigCommand, formatConfigOutput } from "./commands/config"
import { checkUpgrade, runUpgrade } from "./commands/upgrade"
import { runDoctor } from "./commands/doctor"
import { runTUI } from "./tui/index"
import { ensureConfigExists, loadConfig } from "./config/load"
import { existsSync } from "fs"
import { getConfigPath } from "./config/load"
import { resolvePreset } from "./presets"
import { red } from "./tui/theme"
import { createUpdateManager, formatUpdateNotice } from "./updates/manager"
import { UPDATE_TOOLS } from "./updates/types"
import { isUpdateCacheFresh, readUpdateCache, removeUpdateCache } from "./updates/cache"

export async function main() {
  // Parse args first — doctor command must be read-only, so we skip config auto-creation
  const args = parseArgs()

  // Ensure config directory and file exist on any command EXCEPT doctor
  // Doctor needs to observe the raw state without side effects
  if (args.command !== "doctor") {
    ensureConfigExists()
  }

  try {
    // Print parse errors and exit if any
    if (args.parseErrors.length > 0) {
      for (const err of args.parseErrors) {
        console.error(red(`Error: ${err}`))
      }
      process.exit(1)
    }

    switch (args.command) {
      case "help":
        console.log(formatHelp())
        process.exit(0)

      case "tui":
        await runTUI()
        break

      case "install": {
        // Reject unsupported non-OpenCode targets; Codex supports token-saving tools only.
        if (args.target === "claude") {
          console.error(red(`Error: "${args.target}" no está implementado. Solo "opencode" es soportado actualmente. Claude y Codex estarán disponibles próximamente.`))
          process.exit(1)
        }

        let componentIds = args.components

        if (args.preset) {
          try {
            const resolved = resolvePreset(args.preset, { target: args.target })
            const preflight = await buildPresetPreflight(resolved)
            console.log(formatPresetPreflight(preflight))
            componentIds = resolved.components
          } catch (err) {
            console.error(red(`Error: ${err instanceof Error ? err.message : err}`))
            process.exit(1)
          }
        }

        const results = await runInstall(componentIds, "install", {
          target: args.target,
          check: args.flags.check,
        })
        console.log(formatInstallResults(results, args.flags.json))
        await maybePrintUpdateNotice(args.flags.json)

        const hasErrors = results.some(r => r.status === "error")
        process.exit(hasErrors ? 1 : 0)
        break
      }

      case "uninstall": {
        const results = await runUninstall(args.components, { target: args.target })
        removeUpdateCache()
        console.log(formatInstallResults(results, args.flags.json))
        await maybePrintUpdateNotice(args.flags.json)
        process.exit(0)
        break
      }

      case "status": {
        const statuses = await collectStatus(
          args.components.length > 0 ? args.components : undefined,
          { target: args.target }
        )
        console.log(formatStatus(statuses, args.flags.json))
        await maybePrintUpdateNotice(args.flags.json)
        process.exit(0)
        break
      }

      case "upgrade": {
        if (args.updateTool) {
          const tools = args.updateTool === "all" ? UPDATE_TOOLS : [args.updateTool]
          if (args.flags.check) {
            const status = await createUpdateManager(true).checkAll()
            const selected = args.updateTool === "all" ? status : status.filter(s => s.tool === args.updateTool)
            console.log(formatToolUpdateStatuses(selected, args.flags.json))
            process.exit(0)
          }
          const result = await createUpdateManager(true).apply(tools)
          console.log(formatToolUpdateResults(result, args.flags.json))
          process.exit(result.some(r => r.status === "error") ? 1 : 0)
        }
        if (args.flags.check) {
          try {
            const status = await checkUpgrade()
            console.log(formatUpgradeStatus(status, args.flags.json))
            process.exit(0)
          } catch (err) {
            console.error(red(`Error: ${err instanceof Error ? err.message : err}`))
            process.exit(1)
          }
        } else {
          const result = await runUpgrade()
          console.log(formatUpgradeResult(result, args.flags.json))
          process.exit(result.status === "error" ? 1 : 0)
        }
        break
      }

      case "config": {
        const result = await runConfigCommand({
          list: args.flags.list,
          init: args.flags.init,
          key: args.configKey,
          value: args.configValue,
          json: args.flags.json,
        })
        console.log(formatConfigOutput(result, args.flags.json))
        process.exit(result.success ? 0 : 1)
        break
      }

      case "doctor": {
        const result = await runDoctor({
          fix: args.flags.fix,
          verbose: args.flags.verbose,
          components: args.components.length > 0 ? args.components : undefined,
          target: args.target,
        })
        console.log(
          args.flags.json
            ? formatDoctorJson(result)
            : formatDoctorText(result, args.flags.verbose)
        )
        await maybePrintUpdateNotice(args.flags.json)
        // Exit 0 if no remaining failures, 1 otherwise
        process.exit(result.summary.remainingFailures > 0 ? 1 : 0)
        break
      }
    }
  } catch (err) {
    console.error(red(`Error: ${err instanceof Error ? err.message : err}`))
    if (args.flags.verbose && err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  }
}

async function maybePrintUpdateNotice(json: boolean): Promise<void> {
  if (json) return
  if (!existsSync(getConfigPath())) return
  try {
    const config = loadConfig()
    if (config.updates?.enabled === false) return
    const cached = readUpdateCache()
    if (!cached || !isUpdateCacheFresh(cached, config.updates?.ttlMs ?? 24 * 60 * 60 * 1000)) return
    const statuses = cached.tools
    const notice = formatUpdateNotice(statuses)
    if (notice) console.error(notice)
  } catch {
    // Update notices are best-effort and must never block command execution.
  }
}

if (import.meta.main) {
  main()
}
