// src/tui/index.ts — Interactive TUI with @clack/prompts, keyboard nav, component toggles

import * as clack from "@clack/prompts"
import { BANNER, separator, cyan, green, red, yellow, pink, gray, bold } from "./theme"
import { collectStatus } from "../commands/status"
import { runInstall, runUninstall } from "../commands/install"
import { formatInstallResults } from "../cli/output"
import type { ComponentStatus, ComponentId } from "../components/types"

export async function runTUI(): Promise<void> {
  console.clear()
  console.log(BANNER)

  clack.intro(bold(cyan("cyberpunk environment")))

  // Gather current status
  const statuses = await collectStatus()

  // Build options for the multiselect
  const options: { value: ComponentId; label: string; hint: string }[] = statuses.map(s => {
    const icon = s.status === "installed" ? green("✓") : s.status === "error" ? red("✗") : cyan("○")
    const hint = s.status === "installed" ? "instalado" : s.status === "error" ? `error: ${s.error}` : "disponible"
    return {
      value: s.id,
      label: `${icon} ${s.label}`,
      hint,
    }
  })

  // Main menu loop
  let running = true
  while (running) {
    const action = await clack.select({
      message: "¿Qué querés hacer?",
      options: [
        { value: "install", label: "📦 Instalar componentes", hint: "Seleccioná qué instalar" },
        { value: "uninstall", label: "🗑️  Desinstalar componentes", hint: "Seleccioná qué remover" },
        { value: "status", label: "📊 Ver estado", hint: "Mostrar estado actual" },
        { value: "quit", label: "❌ Salir", hint: "" },
      ],
    })

    if (clack.isCancel(action)) {
      break
    }

    switch (action) {
      case "install":
        await handleInstall(statuses)
        // Refresh statuses
        const newStatusesInstall = await collectStatus()
        statuses.length = 0
        statuses.push(...newStatusesInstall)
        break

      case "uninstall":
        await handleUninstall(statuses)
        const newStatusesUninstall = await collectStatus()
        statuses.length = 0
        statuses.push(...newStatusesUninstall)
        break

      case "status": {
        const currentStatus = await collectStatus()
        console.log(separator())
        for (const s of currentStatus) {
          const icon = s.status === "installed" ? green("✓") : s.status === "error" ? red("✗") : cyan("○")
          const statusText = s.status === "installed"
            ? green("instalado")
            : s.status === "error"
              ? red(`error: ${s.error}`)
              : gray("disponible")
          console.log(`  ${icon} ${s.label}  ${statusText}`)
        }
        console.log(separator())
        break
      }

      case "quit":
        running = false
        break
    }
  }

  clack.outro(bold(pink("Hasta la próxima, choomer ⚡")))
  process.exit(0)
}

async function handleInstall(currentStatus: ComponentStatus[]): Promise<void> {
  const selected = await clack.multiselect({
    message: "Seleccioná componentes para instalar o reparar",
    options: currentStatus.map(s => ({
      value: s.id,
      label: s.label,
      hint: s.status === "installed"
        ? "instalado (reparar)"
        : s.status === "error"
          ? `error: ${s.error}`
          : "disponible",
    })),
    required: false,
  })

  if (clack.isCancel(selected) || (selected as ComponentId[]).length === 0) {
    clack.note(yellow("Ningún componente seleccionado"), "Cancelado")
    return
  }

  const ids = selected as ComponentId[]
  const s = clack.spinner()
  s.start("Instalando...")

  const results = await runInstall(ids)
  s.stop("Completado")

  console.log(separator())
  console.log(formatInstallResults(results, false))
  console.log(separator())

  // Show summary
  const successCount = results.filter(r => r.status === "success").length
  const failCount = results.filter(r => r.status === "error").length

  if (failCount > 0) {
    clack.note(
      `${successCount} instalados, ${failCount} errores`,
      failCount > 0 ? "⚠️ Parcial" : "✓ Completado"
    )
  } else {
    clack.note(`${successCount} componentes instalados correctamente`, "✓ Completado")
  }
}

async function handleUninstall(currentStatus: ComponentStatus[]): Promise<void> {
  const installed = currentStatus.filter(s => s.status === "installed")

  if (installed.length === 0) {
    clack.note(gray("No hay componentes instalados"), "Estado")
    return
  }

  const selected = await clack.multiselect({
    message: "Seleccioná componentes para desinstalar",
    options: installed.map(s => ({
      value: s.id,
      label: s.label,
      hint: "instalado",
    })),
    required: false,
  })

  if (clack.isCancel(selected) || (selected as ComponentId[]).length === 0) {
    clack.note(yellow("Ningún componente seleccionado"), "Cancelado")
    return
  }

  const ids = selected as ComponentId[]
  const s = clack.spinner()
  s.start("Desinstalando...")

  const results = await runUninstall(ids)
  s.stop("Completado")

  console.log(separator())
  console.log(formatInstallResults(results, false))
  console.log(separator())

  const successCount = results.filter(r => r.status === "success").length
  clack.note(`${successCount} componentes removidos`, "✓ Completado")
}
