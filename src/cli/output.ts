// src/cli/output.ts — format results as text or --json

import type { ComponentStatus } from "../components/types"
import type { InstallResult } from "../components/types"
import type { UpgradeResult, UpgradeStatus } from "../commands/upgrade"
import { COMPONENT_LABELS } from "../config/schema"
import { cyan, green, red, yellow, gray, bold } from "../tui/theme"

export function formatStatus(components: ComponentStatus[], asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(components, null, 2)
  }

  const lines: string[] = []
  for (const c of components) {
    const label = COMPONENT_LABELS[c.id] || c.id
    switch (c.status) {
      case "installed":
        lines.push(`  ${green("✓")} ${label}  ${green("✓ instalado")}`)
        break
      case "available":
        lines.push(`  ${cyan("○")} ${label}  ${gray("— disponible")}`)
        break
      case "error":
        lines.push(`  ${red("✗")} ${label}  ${red("✗ error")}: ${c.error || "unknown"}`)
        break
    }
  }
  return lines.join("\n")
}

export function formatInstallResults(results: InstallResult[], asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(results, null, 2)
  }

  const lines: string[] = []
  for (const r of results) {
    const label = COMPONENT_LABELS[r.component] || r.component
    const action = r.action === "install" ? "Instalando" : "Desinstalando"
    switch (r.status) {
      case "success":
        lines.push(`  ${green("✓")} ${label} — ${action} correctamente`)
        break
      case "skipped":
        lines.push(`  ${yellow("○")} ${label} — sin cambios`)
        break
      case "error":
        lines.push(`  ${red("✗")} ${label} — error: ${r.message || "unknown"}`)
        break
    }
  }
  return lines.join("\n")
}

export function formatUpgradeStatus(status: UpgradeStatus, asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(status, null, 2)
  }

  if (status.upToDate) {
    return green("✓ Sistema actualizado — última versión instalada")
  }

  const lines: string[] = []
  lines.push(yellow("↻ Actualización disponible"))
  lines.push(`  Actual: ${gray(status.currentVersion)}`)
  lines.push(`  Remoto:  ${cyan(status.latestVersion)}`)
  if (status.changedFiles.length > 0) {
    lines.push(`  Archivos modificados:`)
    for (const f of status.changedFiles) {
      lines.push(`    - ${f}`)
    }
  }
  return lines.join("\n")
}

export function formatUpgradeResult(result: UpgradeResult, asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(result, null, 2)
  }

  switch (result.status) {
    case "up-to-date":
      return green("✓ Ya está en la última versión")
    case "upgraded":
      return [
        green("✓ Actualización completada"),
        `  ${gray(result.fromVersion ?? "unknown")} → ${cyan(result.toVersion ?? "unknown")}`,
        ...(result.filesUpdated?.map(f => `  - ${f}`) || []),
      ].join("\n")
    case "error":
      return red(`✗ Error: ${result.error}`)
  }
}

export function formatHelp(): string {
  return `
${bold(cyan("CYBERPUNK"))} — gestor de entorno cyberpunk

${bold("USO")}
  cyberpunk [command] [flags]

${bold("COMANDOS")}
  (sin args)    Abre el TUI interactivo
  install  (i)  Instalar componentes
  uninstall (u)  Desinstalar componentes
  status   (s)  Ver estado de componentes
  upgrade (up)  Actualizar a la última versión
  config   (c)  Leer/escribir configuración
  help     (h)  Mostrar esta ayuda

${bold("FLAGS")}
  --plugin        Componente: plugin
  --theme         Componente: tema
  --sounds        Componente: sonidos
  --context-mode  Componente: context-mode
  --rtk           Componente: RTK (token proxy)
  --all           Todos los componentes
  --json          Salida en JSON
  --verbose       Log detallado
  --check         Solo verificar (upgrade)
  --list          Listar config
  --init          Crear config por defecto

${bold("EJEMPLOS")}
  cyberpunk                    # Abre TUI interactivo
  cyberpunk install --all      # Instalar todo
  cyberpunk status --json      # Estado en JSON
  cyberpunk upgrade --check    # Verificar actualizaciones
  cyberpunk config --list      # Ver configuración
  cyberpunk config repoUrl "https://github.com/user/repo"
`.trim()
}
