// src/index.ts — entry point: argv parse → command dispatch

import { parseArgs } from "./cli/parse-args"
import { formatHelp, formatStatus, formatInstallResults, formatUpgradeStatus, formatUpgradeResult } from "./cli/output"
import { runInstall, runUninstall } from "./commands/install"
import { collectStatus } from "./commands/status"
import { runConfigCommand, formatConfigOutput } from "./commands/config"
import { checkUpgrade, runUpgrade } from "./commands/upgrade"
import { runTUI } from "./tui/index"
import { CONFIG_PATH, ensureConfigExists } from "./config/load"
import { green, red, cyan } from "./tui/theme"

async function main() {
  // Ensure config directory and file exist on any command first-run
  ensureConfigExists()

  const args = parseArgs()

  try {
    switch (args.command) {
      case "help":
        console.log(formatHelp())
        process.exit(0)

      case "tui":
        await runTUI()
        break

      case "install": {
        const results = await runInstall(args.components, "install")
        console.log(formatInstallResults(results, args.flags.json))

        const hasErrors = results.some(r => r.status === "error")
        process.exit(hasErrors ? 1 : 0)
        break
      }

      case "uninstall": {
        const results = await runUninstall(args.components)
        console.log(formatInstallResults(results, args.flags.json))
        process.exit(0)
        break
      }

      case "status": {
        const statuses = await collectStatus(
          args.components.length > 0 ? args.components : undefined
        )
        console.log(formatStatus(statuses, args.flags.json))
        process.exit(0)
        break
      }

      case "upgrade": {
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
    }
  } catch (err) {
    console.error(red(`Error: ${err instanceof Error ? err.message : err}`))
    if (args.flags.verbose && err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  }
}

main()
