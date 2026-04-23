// src/cli/output.ts — format results as text or --json

import type { ComponentStatus } from "../components/types"
import type { InstallResult } from "../components/types"
import type { UpgradeResult, UpgradeStatus } from "../commands/upgrade"
import type { DoctorRunResult, DoctorResult, DoctorCheck } from "../components/types"
import type { ResolvedPreset } from "../presets/definitions"
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
  lines.push(yellow("Actualización disponible"))
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

export function formatDoctorJson(results: DoctorRunResult): string {
  // Spec contract: --json outputs DoctorResult[] (array of {component, checks})
  // Uses the structured results array directly — includes empty entries for modules without doctor()
  return JSON.stringify(results.results, null, 2)
}

export function formatDoctorText(results: DoctorRunResult, verbose: boolean): string {
  const lines: string[] = []
  const { checks, fixes, summary } = results

  // Column widths (minimum)
  const colCheck = 30
  const colStatus = 8
  const colFixable = 9
  const colFixed = 7

  // Header
  if (verbose) {
    lines.push(
      bold("CHECK".padEnd(colCheck)) + "  " +
      bold("STATUS".padEnd(colStatus)) + "  " +
      bold("FIXABLE".padEnd(colFixable)) + "  " +
      bold("FIXED".padEnd(colFixed)) + "  " +
      bold("MESSAGE")
    )
  } else {
    lines.push(
      bold("CHECK".padEnd(colCheck)) + "  " +
      bold("STATUS".padEnd(colStatus)) + "  " +
      bold("MESSAGE")
    )
  }

  // Separator line
  const sep = "─".repeat(verbose ? colCheck + colStatus + colFixable + colFixed + 60 : colCheck + colStatus + 60)
  lines.push(gray(sep))

  // Data rows
  for (const c of checks) {
    const statusStr = c.status === "pass" ? green("pass".padEnd(colStatus))
      : c.status === "warn" ? yellow("warn".padEnd(colStatus))
      : c.fixed ? green("fixed".padEnd(colStatus))
      : red("fail".padEnd(colStatus))

    const checkStr = c.id.padEnd(colCheck)

    if (verbose) {
      const fixableStr = String(c.fixable).padEnd(colFixable)
      const fixedStr = (c.fixed != null ? String(c.fixed) : "-").padEnd(colFixed)
      lines.push(`${checkStr}  ${statusStr}  ${fixableStr}  ${fixedStr}  ${c.message}`)
    } else {
      lines.push(`${checkStr}  ${statusStr}  ${c.message}`)
    }
  }

  // Show fix results if any fixes were applied
  if (fixes.length > 0) {
    lines.push("")
    lines.push(bold("REPARACIONES"))
    const fixSep = "─".repeat(60)
    lines.push(gray(fixSep))
    for (const fix of fixes) {
      const icon = fix.status === "fixed" ? green("✓")
        : fix.status === "failed" ? red("✗")
        : yellow("○")
      lines.push(`  ${icon} ${fix.checkId}: ${fix.message}`)
    }
  }

  // Summary line
  lines.push("")
  const parts: string[] = []
  if (summary.healthy > 0) parts.push(green(`${summary.healthy} OK`))
  if (summary.warnings > 0) parts.push(yellow(`${summary.warnings} warnings`))
  if (summary.remainingFailures > 0) parts.push(red(`${summary.remainingFailures} failures`))
  if (summary.fixed > 0) parts.push(green(`${summary.fixed} repaired`))
  lines.push(`Resumen: ${parts.join(" | ")}`)

  return lines.join("\n")
}

export function formatPresetSummary(resolved: ResolvedPreset): string {
  const lines: string[] = []
  lines.push(bold(cyan(`Preset: ${resolved.label}`)))
  lines.push(`  Componentes: ${resolved.components.map(id => COMPONENT_LABELS[id] || id).join(", ")}`)
  if (resolved.warnings.length > 0) {
    lines.push("")
    lines.push(yellow("Avisos:"))
    for (const w of resolved.warnings) {
      lines.push("  - " + w)
    }
  }
  return lines.join("\n")
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
  doctor   (d)  Diagnóstico y reparación
  config   (c)  Leer/escribir configuración
  help     (h)  Mostrar esta ayuda

 ${bold("FLAGS")}
  --plugin        Componente: plugin
  --theme         Componente: tema
  --sounds        Componente: sonidos
  --context-mode  Componente: context-mode
  --rtk           Componente: RTK (token proxy)
  --tmux          Componente: tmux config
  --all           Todos los componentes
  --preset <name> Instalar desde preset (minimal, full)
  --json          Salida en JSON
  --verbose       Log detallado
  --fix           Aplicar reparaciones (doctor)
  --check         Solo verificar (upgrade)
  --list          Listar config
  --init          Crear config por defecto

 ${bold("EJEMPLOS")}
  cyberpunk                         # Abre TUI interactivo
  cyberpunk install --all           # Instalar todo
  cyberpunk install --preset minimal  # Instalar preset mínimo
  cyberpunk install --preset full   # Instalar preset completo
  cyberpunk status --json           # Estado en JSON
  cyberpunk upgrade --check         # Verificar actualizaciones
  cyberpunk config --list           # Ver configuración
  cyberpunk config repoUrl "https://github.com/user/repo"
`.trim()
}
