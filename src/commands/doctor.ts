// src/commands/doctor.ts — aggregate doctor checks, run safe fixes, compute summary

import type { ComponentId, DoctorCheck, DoctorContext, DoctorFixResult, DoctorRunResult, DoctorResult } from "../components/types"
import { getPluginComponent } from "../components/plugin"
import { getSddIntegrationComponent } from "../components/sdd-integration"
import { getThemeComponent } from "../components/theme"
import { getSoundsComponent } from "../components/sounds"
import { getContextModeComponent } from "../components/context-mode"
import { getRtkComponent } from "../components/rtk"
import { getTmuxComponent } from "../components/tmux"
import { getTuiPluginsComponent } from "../components/tui-plugins"
import { getCodebaseMemoryComponent } from "../components/codebase-memory"
import { COMPONENT_IDS } from "../config/schema"
import type { ComponentModule } from "../components/types"
import { readConfigRaw } from "../config/load"
import { checkPlatformPrerequisites, getRuntimeDependencyChecks, isXattrAvailable, canCheckCodesign } from "../components/platform"
import { detectEnvironment } from "../platform/detect"
import { getHomeDirAuto } from "../platform/paths"
import { isCommandOnPath } from "../platform/shell"
import { checkConfigDoctor, repairConfigDefaults } from "../components/config-doctor"
import { repairThemeActivation } from "../components/theme-doctor"
import { delimiter, join } from "path"
import { accessSync, constants, existsSync } from "fs"
import { insertManagedBlock, BUNDLED_TMUX_CONF, cloneTpm, runTpmScript } from "../components/tmux"
import type { AgentTarget, PlatformInfo } from "../domain/environment"
import type { AgentDetectResult } from "../detection/types"
import { readUpdateCache } from "../updates/cache"
import { getCapabilities, getSupportedComponentIds, isComponentSupportedForTarget } from "../components/registry"
import { createUpdateManager } from "../updates/manager"
import type { UpdateTool } from "../updates/types"

const COMPONENT_FACTORIES: Record<ComponentId, () => ComponentModule> = {
  plugin: getPluginComponent,
  "sdd-integration": getSddIntegrationComponent,
  theme: getThemeComponent,
  sounds: getSoundsComponent,
  "context-mode": getContextModeComponent,
  rtk: getRtkComponent,
  tmux: getTmuxComponent,
  "tui-plugins": getTuiPluginsComponent,
  "codebase-memory": getCodebaseMemoryComponent,
}

/**
 * Build doctor checks for detected agents and the current platform.
 * Each agent in the detection record produces one check entry.
 * An additional check reports the detected platform kind.
 *
 * Exported for testability — the main runDoctor function calls this internally.
 */
export function buildAgentChecks(
  agents: Partial<Record<AgentTarget, AgentDetectResult>>,
  platform: PlatformInfo
): DoctorCheck[] {
  const checks: DoctorCheck[] = []

  // Platform detection check
  const platformLabel = detectEnvironment()
  checks.push({
    id: "agent:platform",
    label: "Platform",
    status: "pass",
    message: `Detected platform: ${platformLabel} (${platform.kind}/${platform.arch})`,
    fixable: false,
  })

  // Per-agent checks
  const agentEntries = Object.entries(agents) as [AgentTarget, AgentDetectResult][]
  for (const [target, result] of agentEntries) {
    if (result.installed) {
      const versionInfo = result.version ? ` v${result.version}` : ""
      const pathInfo = result.configPath ? ` — config: ${result.configPath}` : ""
      checks.push({
        id: `agent:${target}`,
        label: `Agent: ${target}`,
        status: "pass",
        message: `${target}${versionInfo} is installed${pathInfo}`,
        fixable: false,
      })
    } else if (result.status === "unknown") {
      const rationale = result.rationale
        ? ` — ${result.rationale}`
        : " — detection inconclusive"
      checks.push({
        id: `agent:${target}`,
        label: `Agent: ${target}`,
        status: "warn",
        message: `${target} detection inconclusive${rationale}`,
        fixable: false,
      })
    } else if (result.status === "unsupported") {
      checks.push({
        id: `agent:${target}`,
        label: `Agent: ${target}`,
        status: "warn",
        message: `${target} is not installed or not detected`,
        fixable: false,
      })
    } else {
      checks.push({
        id: `agent:${target}`,
        label: `Agent: ${target}`,
        status: "warn",
        message: `${target} is not installed or not detected`,
        fixable: false,
      })
    }
  }

  return checks
}

/**
 * Run doctor: collect checks from all components, optionally apply fixes.
 */
export async function runDoctor(
  options: {
    fix: boolean
    verbose: boolean
    components?: ComponentId[]
    /** Agent target for filtered diagnostics */
    target?: AgentTarget
  }
): Promise<DoctorRunResult> {
  const configRaw = readConfigRaw()
  const cyberpunkConfig = configRaw.error === null
    ? configRaw.parsed as any  // eslint-disable-line @typescript-eslint/no-explicit-any
    : null

  // Build shared context
  const prerequisites = checkPlatformPrerequisites()
  const ctx: DoctorContext = {
    cyberpunkConfig,
    verbose: options.verbose,
    target: options.target ?? "opencode",
    prerequisites,
  }

  const allChecks: DoctorCheck[] = []
  const allResults: DoctorResult[] = []

  // --- Platform checks (not a component module, handled directly) ---
  const platformChecks = collectPlatformChecks(prerequisites)
  allChecks.push(...platformChecks)
  allResults.push({ component: "platform", checks: platformChecks })

  // --- Agent detection checks (environment-first) ---
  try {
    const detectedEnv = detectEnvironment()
    const platform: PlatformInfo = {
      kind: detectedEnv,
      arch: process.arch as PlatformInfo["arch"],
      configRoot: getHomeDirAuto(),
    }
    // Run detection registry with OpenCode, Claude, and Codex detectors
    const { detectAgents } = await import("../detection/registry")
    const { createOpenCodeDetector } = await import("../detection/agents/opencode")
    const { createClaudeDetector } = await import("../detection/agents/claude")
    const { createCodexDetector } = await import("../detection/agents/codex")
    const detectors = [createOpenCodeDetector(), createClaudeDetector(), createCodexDetector()]
    const agentResults = detectAgents(detectors, platform)
    const agentChecks = buildAgentChecks(agentResults, platform)
    allChecks.push(...agentChecks)
    allResults.push({ component: "agent-detection", checks: agentChecks })
  } catch {
    // Agent detection failure is non-fatal for doctor
  }

  // --- Config checks (not a component module, handled directly) ---
  const configChecks = checkConfigDoctor(configRaw)
  allChecks.push(...configChecks)
  allResults.push({ component: "config", checks: configChecks })

  const updateChecks = collectUpdateChecks()
  allChecks.push(...updateChecks)
  allResults.push({ component: "updates", checks: updateChecks })

  const supportBoundaryChecks = collectSupportBoundaryChecks(ctx.target ?? "opencode")
  if (supportBoundaryChecks.length > 0) {
    allChecks.push(...supportBoundaryChecks)
    allResults.push({ component: "support-boundary", checks: supportBoundaryChecks })
  }

  // Determine which components to check
  const target = ctx.target ?? "opencode"
  const filterIds = options.components && options.components.length > 0
    ? options.components.filter(id => isComponentSupportedForTarget(id, target))
    : COMPONENT_IDS.filter(id => isComponentSupportedForTarget(id, target))

  // --- Component checks via ComponentModule.doctor() ---
  for (const compId of filterIds) {
    const factory = COMPONENT_FACTORIES[compId]
    if (!factory) continue
    const mod = factory()
    if (mod.doctor) {
      try {
        const result: DoctorResult = await mod.doctor(ctx)
        allChecks.push(...result.checks)
        allResults.push(result)
      } catch (err) {
        // Component doctor failure is report-only, does not crash the command
        const errorCheck: DoctorCheck = {
          id: `${compId}:error`,
          label: mod.label,
          status: "fail",
          message: `Doctor check failed: ${err instanceof Error ? err.message : String(err)}`,
          fixable: false,
        }
        allChecks.push(errorCheck)
        allResults.push({ component: compId, checks: [errorCheck] })
      }
    } else {
      // Modules without doctor() produce empty DoctorResult per spec contract
      // (zero checks, component still listed in output)
      allResults.push({ component: compId, checks: [] })
    }
  }

  // --- Run fixes if --fix ---
  const fixes: DoctorFixResult[] = []
  if (options.fix) {
    const fixable = allChecks.filter(c => c.status !== "pass" && c.fixable)

    // Repair order per design: config → plugin registration → sdd-integration patching → theme → sounds → context-mode → rtk → tmux → tui-plugins → codebase-memory
    // 1. Config shape defaults
    for (const check of fixable.filter(c => c.id.startsWith("config:"))) {
      fixes.push(await applyConfigFix(check))
    }

    // 2. Plugin fixes (file, source-drift, registration — NO patching)
    const pluginFixable = fixable.filter(c => c.id.startsWith("plugin:"))
    // Explicit ordering: source-drift before registration
    const PLUGIN_FIX_PRIORITY: Record<string, number> = {
      "plugin:source-drift": 0,
      "plugin:registration": 1,
    }
    pluginFixable.sort((a, b) => (PLUGIN_FIX_PRIORITY[a.id] ?? 99) - (PLUGIN_FIX_PRIORITY[b.id] ?? 99))
    for (const check of pluginFixable) {
      fixes.push(await applyPluginFix(check))
    }

    // 3. SDD integration patching
    for (const check of fixable.filter(c => c.id.startsWith("sdd-integration:"))) {
      fixes.push(await applySddIntegrationFix(check))
    }

    // 4. Theme activation
    for (const check of fixable.filter(c => c.id.startsWith("theme:"))) {
      fixes.push(await applyThemeFix(check))
    }

    // 4. Sounds regeneration (only if ffmpeg available)
    for (const check of fixable.filter(c => c.id.startsWith("sounds:"))) {
      fixes.push(await applySoundsFix(check, prerequisites))
    }

    // 5. Context-mode routing + MCP (only if context-mode binary on PATH)
    for (const check of fixable.filter(c => c.id.startsWith("context-mode:"))) {
      fixes.push(await applyContextModeFix(check, prerequisites))
    }

    // 6. RTK routing + registration (only if rtk binary on PATH)
    for (const check of fixable.filter(c => c.id.startsWith("rtk:"))) {
      fixes.push(await applyRtkFix(check, prerequisites))
    }

    // 7. Tmux config/block/bootstrap repair
    for (const check of fixable.filter(c => c.id === "tmux:config")) {
      fixes.push(await applyTmuxFix(check, prerequisites))
    }

    let tmuxTpmRepairSucceeded: boolean | undefined
    for (const check of fixable.filter(c => c.id === "tmux:tpm")) {
      const fix = await applyTmuxFix(check, prerequisites)
      fixes.push(fix)
      tmuxTpmRepairSucceeded = fix.status === "fixed"
    }

    for (const check of fixable.filter(c => c.id === "tmux:plugins")) {
      fixes.push(await applyTmuxFix(check, prerequisites, tmuxTpmRepairSucceeded))
    }

    // 8. TUI plugins registration repair
    for (const check of fixable.filter(c => c.id.startsWith("tui-plugins:"))) {
      fixes.push(await applyTuiPluginsFix(check))
    }

    // 9. Codebase-memory routing + MCP repair
    for (const check of fixable.filter(c => c.id.startsWith("codebase-memory:"))) {
      fixes.push(await applyCodebaseMemoryFix(check))
    }

    // 10. Explicit tool updates surfaced by doctor cache
    for (const check of fixable.filter(c => c.id.startsWith("updates:"))) {
      fixes.push(await applyUpdateFix(check))
    }

    // Mark fixed checks
    for (const fix of fixes) {
      if (fix.status === "fixed") {
        const check = allChecks.find(c => c.id === fix.checkId)
        if (check) check.fixed = true
      }
    }
  }

  // --- Compute summary ---
  const summary = {
    healthy: allChecks.filter(c => c.status === "pass").length,
    warnings: allChecks.filter(c => c.status === "warn").length,
    failures: allChecks.filter(c => c.status === "fail" && !c.fixed).length,
    fixed: fixes.filter(f => f.status === "fixed").length,
    remainingFailures: allChecks.filter(c => c.status === "fail" && !c.fixed).length,
  }

  return { checks: allChecks, results: allResults, fixes, summary }
}

function collectSupportBoundaryChecks(target: AgentTarget): DoctorCheck[] {
  if (target === "opencode") return []

  const supported = getSupportedComponentIds(target)
  const unavailable = getCapabilities()
    .filter(cap => !cap.targets.includes(target))
    .map(cap => cap.component)

  return [{
    id: `${target}:support-boundary`,
    label: `${target} support boundary`,
    status: "pass",
    message: `${target} supports token tools: ${supported.join(", ") || "none"}; unavailable full ecosystem features: ${unavailable.join(", ") || "none"}`,
    fixable: false,
  }]
}

function collectUpdateChecks(): DoctorCheck[] {
  const cache = readUpdateCache()
  if (!cache) {
    return [{ id: "updates:cache", label: "Update cache", status: "warn", message: "No update cache available yet", fixable: false }]
  }
  const ageMs = Date.now() - Date.parse(cache.checkedAt)
  const ageMin = Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : -1
  const checks: DoctorCheck[] = [{
    id: "updates:cache",
    label: "Update cache",
    status: "pass",
    message: `Cache age: ${ageMin >= 0 ? `${ageMin}m` : "unknown"}; checked tools: ${cache.tools.map(t => t.tool).join(", ")}`,
    fixable: false,
  }]
  for (const tool of cache.tools) {
    const currentUnknown = !tool.error && tool.latest && !tool.current
    checks.push({
      id: `updates:${tool.tool}`,
      label: `Update: ${tool.tool}`,
      status: tool.error ? "warn" : tool.available || currentUnknown ? "warn" : "pass",
      message: tool.error
        ? tool.error
        : currentUnknown
          ? `Installed version unknown; latest is ${tool.latest}`
        : tool.available
          ? `Update available: ${tool.current ?? "unknown"} → ${tool.latest ?? "latest"}`
          : `Up to date${tool.current ? ` (${tool.current})` : ""}`,
      fixable: !tool.error && (tool.available || !!currentUnknown),
    })
  }
  return checks
}

async function applyUpdateFix(check: DoctorCheck): Promise<DoctorFixResult> {
  const tool = check.id.replace(/^updates:/, "") as UpdateTool
  if (!["cyberpunk", "context-mode", "rtk", "codebase-memory"].includes(tool)) {
    return { checkId: check.id, status: "skipped", message: "No update handler for this check" }
  }

  const [result] = await createUpdateManager(true).apply([tool])
  if (!result) return { checkId: check.id, status: "failed", message: "No update result returned" }
  if (result.status === "updated") return { checkId: check.id, status: "fixed", message: result.message ?? `${tool} actualizado` }
  if (result.status === "up-to-date") return { checkId: check.id, status: "unchanged", message: result.message ?? `${tool} ya estaba actualizado` }
  return { checkId: check.id, status: "failed", message: result.message ?? `Error actualizando ${tool}` }
}

function collectPlatformChecks(prerequisites: ReturnType<typeof checkPlatformPrerequisites>): DoctorCheck[] {
  const checks: DoctorCheck[] = []

  checks.push({
    id: "platform:ffmpeg",
    label: "ffmpeg",
    status: prerequisites.ffmpeg ? "pass" : "warn",
    message: prerequisites.ffmpeg ? "ffmpeg disponible en PATH" : "ffmpeg no encontrado — sonidos no disponibles",
    fixable: false,
  })

  checks.push({
    id: "platform:npm",
    label: "npm/bun",
    status: (prerequisites.npm || prerequisites.bun) ? "pass" : "warn",
    message: (prerequisites.npm || prerequisites.bun)
      ? `${prerequisites.npm ? "npm" : "bun"} disponible en PATH`
      : "npm/bun no encontrado — algunos componentes no disponibles",
    fixable: false,
  })

  checks.push({
    id: "platform:curl",
    label: "curl",
    status: prerequisites.curl ? "pass" : "warn",
    message: prerequisites.curl ? "curl disponible en PATH" : "curl no encontrado",
    fixable: false,
  })

  checks.push({
    id: "platform:git",
    label: "git",
    status: prerequisites.git ? "pass" : "warn",
    message: prerequisites.git ? "git disponible en PATH" : "git no encontrado — TPM no podrá instalarse automáticamente",
    fixable: false,
  })

  checks.push(...getRuntimeDependencyChecks())

  // macOS readiness checks — gated on darwin
  if (detectEnvironment() === "darwin") {
    const xattrOk = isXattrAvailable()
    const codesignOk = canCheckCodesign()
    const home = getHomeDirAuto()
    const binDir = join(home, ".local", "bin")
    const binaryPath = join(binDir, "cyberpunk")
    const binaryExecutable = isExecutableFile(binaryPath)
    const binaryOnPath = isCommandOnPath("cyberpunk")
    const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean)
    const binDirOnPath = pathEntries.includes(binDir)

    checks.push({
      id: "mac:release-asset",
      label: "macOS installed binary",
      status: binaryExecutable ? "pass" : "warn",
      message: binaryExecutable
        ? "Installed binary exists and is executable at ~/.local/bin/cyberpunk"
        : existsSync(binDir)
          ? "Installed binary not found or not executable at ~/.local/bin/cyberpunk"
          : "Binary install directory (~/.local/bin) not found — run the installer or create it and add it to PATH",
      fixable: false,
    })

    checks.push({
      id: "mac:path",
      label: "macOS cyberpunk command",
      status: binaryOnPath ? "pass" : "warn",
      message: binaryOnPath
        ? "cyberpunk command available on PATH"
        : binaryExecutable
          ? binDirOnPath
            ? "~/.local/bin is on PATH, but cyberpunk is still not resolvable — restart the shell or run ~/.local/bin/cyberpunk help"
            : "cyberpunk is installed at ~/.local/bin/cyberpunk but ~/.local/bin is not on PATH — add export PATH=\"$HOME/.local/bin:$PATH\" to your shell profile and reload it"
          : "cyberpunk command not found on PATH and no executable was found at ~/.local/bin/cyberpunk",
      fixable: false,
    })

    checks.push({
      id: "mac:quarantine",
      label: "macOS quarantine handling",
      status: xattrOk ? "pass" : "warn",
      message: xattrOk
        ? "xattr available for quarantine attribute handling"
        : "xattr not found — cannot automatically remove quarantine attributes from downloaded binaries",
      fixable: false,
    })

    checks.push({
      id: "mac:codesign",
      label: "macOS codesign verification",
      status: codesignOk ? "pass" : "warn",
      message: codesignOk
        ? "codesign available for binary signature inspection"
        : "codesign not found — cannot inspect binary signatures",
      fixable: false,
    })

    checks.push({
      id: "mac:unsigned-binary",
      label: "macOS binary signing status",
      status: "warn",
      message: "macOS binaries are currently unsigned. Gatekeeper may block first launch. Use Finder → right-click → Open to bypass.",
      fixable: false,
    })

    checks.push({
      id: "mac:signing",
      label: "macOS code signing",
      status: "warn",
      message: "Code signing is not yet implemented — deferred to a future release.",
      fixable: false,
    })

    checks.push({
      id: "mac:notarization",
      label: "macOS notarization",
      status: "warn",
      message: "Apple notarization is not yet implemented — deferred to a future release.",
      fixable: false,
    })
  }

  return checks
}

function isExecutableFile(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function applyConfigFix(check: DoctorCheck): Promise<DoctorFixResult> {
  try {
    const repaired = repairConfigDefaults()
    if (repaired) {
      return { checkId: check.id, status: "fixed", message: "Config reparado con valores por defecto" }
    }
    return { checkId: check.id, status: "unchanged", message: "Config sin cambios necesarios" }
  } catch (err) {
    return {
      checkId: check.id,
      status: "failed",
      message: `Error reparando config: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function applyPluginFix(check: DoctorCheck): Promise<DoctorFixResult> {
  if (check.id === "plugin:registration") {
    try {
      const { registerCyberpunkPlugin } = await import("../opencode-config")
      const result = registerCyberpunkPlugin()
      if (result.registered) {
        return { checkId: check.id, status: "fixed", message: "Plugin registrado en OpenCode config" }
      }
      return { checkId: check.id, status: "unchanged", message: result.warning || "Plugin ya registrado" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error registrando plugin: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  if (check.id === "plugin:source-drift") {
    return applyPluginDriftFix(check)
  }

  return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
}

async function applyPluginDriftFix(check: DoctorCheck): Promise<DoctorFixResult> {
  if (!check.fixable) {
    return { checkId: check.id, status: "skipped", message: "La ruta del plugin no es gestionada por cyberpunk" }
  }

  try {
    const { restoreBundledPluginSource } = await import("../components/plugin")
    restoreBundledPluginSource()
    return { checkId: check.id, status: "fixed", message: "Plugin gestionado reescrito desde el bundle actual" }
  } catch (err) {
    return {
      checkId: check.id,
      status: "failed",
      message: `Error reinstalando plugin gestionado: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function applySddIntegrationFix(check: DoctorCheck): Promise<DoctorFixResult> {
  if (check.id === "sdd-integration:patching") {
    try {
      const { patchSddPhaseCommon, patchSddReviewSkill, patchOpenCodeSddOrchestrator } = await import("../components/sdd-integration")
      const phasePatched = patchSddPhaseCommon()
      const reviewPatched = patchSddReviewSkill()
      const orchestratorPatched = patchOpenCodeSddOrchestrator()
      const patched = phasePatched || reviewPatched || orchestratorPatched
      if (patched) {
        return { checkId: check.id, status: "fixed", message: "SDD Integration re-aplicada" }
      }
      return { checkId: check.id, status: "unchanged", message: "Patching sin cambios" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error aplicando patch SDD: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
  return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
}

async function applyThemeFix(check: DoctorCheck): Promise<DoctorFixResult> {
  if (check.id === "theme:activation" || check.id === "theme:file") {
    try {
      const repaired = repairThemeActivation()
      if (repaired) {
        return { checkId: check.id, status: "fixed", message: "Tema activado/reparado" }
      }
      return { checkId: check.id, status: "unchanged", message: "Tema sin cambios necesarios" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error reparando tema: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
}

async function applySoundsFix(check: DoctorCheck, prerequisites: ReturnType<typeof checkPlatformPrerequisites>): Promise<DoctorFixResult> {
  if (check.id === "sounds:invalid") {
    return applySoundValidityFix(check, prerequisites)
  }

  if (check.id !== "sounds:files") {
    return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
  }

  if (!prerequisites.ffmpeg) {
    return { checkId: check.id, status: "skipped", message: "ffmpeg no disponible — no se pueden regenerar sonidos" }
  }

  try {
    const { existsSync, mkdirSync } = await import("fs")
    const { join } = await import("path")
    const { execSync } = await import("child_process")
    const HOME = getHomeDirAuto()
    const SOUNDS_DIR = join(HOME, ".config", "opencode", "sounds")

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

    mkdirSync(SOUNDS_DIR, { recursive: true })

    const missing = SOUND_FILES.filter(f => !existsSync(join(SOUNDS_DIR, f)))
    if (missing.length === 0) {
      return { checkId: check.id, status: "unchanged", message: "Todos los sonidos ya existen" }
    }

    let regenerated = 0
    let failed = 0
    for (const file of missing) {
      const args = SOUND_GENERATORS[file]
      if (!args) { failed++; continue }
      const outputPath = join(SOUNDS_DIR, file)
      const command = `ffmpeg -loglevel error -nostats ${args} ${JSON.stringify(outputPath)} >/dev/null 2>&1`
      try {
        execSync(command, { stdio: "pipe" })
        if (existsSync(outputPath)) {
          regenerated++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    if (failed === 0) {
      return { checkId: check.id, status: "fixed", message: `${regenerated} archivo(s) de sonido regenerados` }
    }
    return { checkId: check.id, status: "failed", message: `${regenerated} regenerados, ${failed} fallaron` }
  } catch (err) {
    return {
      checkId: check.id,
      status: "failed",
      message: `Error regenerando sonidos: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function applySoundValidityFix(check: DoctorCheck, prerequisites: ReturnType<typeof checkPlatformPrerequisites>): Promise<DoctorFixResult> {
  if (!prerequisites.ffmpeg) {
    return { checkId: check.id, status: "skipped", message: "ffmpeg no disponible — no se pueden regenerar sonidos inválidos" }
  }

  try {
    const { existsSync, readFileSync } = await import("fs")
    const { join } = await import("path")
    const { SOUND_FILES, regenerateSoundFiles } = await import("../components/sounds")
    const HOME = getHomeDirAuto()
    const SOUNDS_DIR = join(HOME, ".config", "opencode", "sounds")
    const invalid = SOUND_FILES.filter(file => {
      const filePath = join(SOUNDS_DIR, file)
      if (!existsSync(filePath)) {
        return false
      }

      return readFileSync(filePath).subarray(0, 4).toString("utf8") !== "RIFF"
    })

    if (invalid.length === 0) {
      return { checkId: check.id, status: "unchanged", message: "No hay sonidos inválidos para regenerar" }
    }

    const { regenerated, failed } = regenerateSoundFiles(invalid, SOUNDS_DIR)
    if (failed === 0) {
      return { checkId: check.id, status: "fixed", message: `${regenerated} archivo(s) inválidos regenerados` }
    }

    return { checkId: check.id, status: "failed", message: `${regenerated} regenerados, ${failed} fallaron` }
  } catch (err) {
    return {
      checkId: check.id,
      status: "failed",
      message: `Error regenerando sonidos inválidos: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function applyContextModeFix(check: DoctorCheck, prerequisites: ReturnType<typeof checkPlatformPrerequisites>): Promise<DoctorFixResult> {
  // Guard: context-mode repairs only run when the binary is on PATH
  const cmOnPath = isCommandOnPath("context-mode")

  if (!cmOnPath) {
    return { checkId: check.id, status: "skipped", message: "context-mode binary no disponible — reparación omitida" }
  }

  if (check.id === "context-mode:routing") {
    try {
      const { existsSync, writeFileSync, mkdirSync, renameSync } = await import("fs")
      const { join } = await import("path")
      const HOME = getHomeDirAuto()
      const INSTRUCTIONS_DIR = join(HOME, ".config", "opencode", "instructions")
      const ROUTING_PATH = join(INSTRUCTIONS_DIR, "context-mode-routing.md")

      const routingContent = `<!-- cyberpunk-managed:context-mode-routing -->
# Context-Mode Routing

This file adds routing awareness for \`context-mode\`. It complements the global \`AGENTS.md\` memory rules; it does not replace them.

## Purpose

Use \`context-mode\` when a normal tool call would likely dump too much raw data into the chat context. The goal is token reduction, not changing how code edits are made.

## Escalate to \`context-mode\` only for genuinely heavy-output work

- Use \`ctx_batch_execute\` only when the output is genuinely large, you need to inspect multiple noisy commands together, or you want indexed follow-up queries.
- Use \`ctx_execute\` when you need sandboxed code to analyze, parse, transform, or summarize data before returning the result.
- Use \`ctx_execute_file\` for large files, logs, generated output, or any source file you need to inspect without loading into chat.
- Use \`ctx_fetch_and_index\` followed by \`ctx_search\` for arbitrary web pages or large remote documents.
- Use \`ctx_search\` for follow-up questions on content that was already indexed by \`context-mode\`.

## Keep normal OpenCode tools for focused work

- Use \`read\` when you need the actual contents of 1-3 files in order to edit them.
- Use \`edit\` and \`write\` normally for code changes.
- Use \`glob\` and \`grep\` for targeted discovery when the result set is expected to stay small.
- Use short shell commands normally for repo state or file operations.
- Prefer \`rtk\` when the main problem is verbose CLI output and a compact CLI proxy is enough.

## Tool boundaries in this stack

- \`Engram\` is the persistent memory layer for decisions, discoveries, and session summaries.
- \`context-mode\` is the context-protection and sandbox-routing layer.
- \`Context7\` remains the preferred source for library and framework documentation.
- \`Supermemory\` remains user-memory and preference recall.

## Conflict handling

- If a raw tool call is denied or redirected by \`context-mode\`, switch to the matching \`ctx_*\` tool instead of retrying the same path.
- Do not duplicate memory behavior in \`context-mode\` instructions; follow the existing global \`AGENTS.md\` for \`Engram\` persistence rules.
- Keep sandbox output intentionally small: print the answer or summary, not the whole dataset.
`
      mkdirSync(INSTRUCTIONS_DIR, { recursive: true })
      const tmpPath = ROUTING_PATH + ".tmp"
      writeFileSync(tmpPath, routingContent, "utf8")
      renameSync(tmpPath, ROUTING_PATH)
      return { checkId: check.id, status: "fixed", message: "Archivo routing context-mode creado" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error reparando routing: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  if (check.id === "context-mode:mcp") {
    try {
      const { readOpenCodeConfig, writeOpenCodeConfig } = await import("../opencode-config")

      const config = readOpenCodeConfig()
      if (!config) {
        return { checkId: check.id, status: "failed", message: "opencode.json no existe o no parseable" }
      }

      const mcp = config.mcp as Record<string, any> | undefined // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!mcp) {
        (config as any).mcp = {} // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      const mcpObj = (config as any).mcp as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      if (mcpObj["context-mode"]?.type === "local") {
        return { checkId: check.id, status: "unchanged", message: "MCP ya configurado" }
      }

      mcpObj["context-mode"] = {
        command: ["context-mode"],
        type: "local",
        enabled: true,
      }
      writeOpenCodeConfig(config)
      return { checkId: check.id, status: "fixed", message: "context-mode MCP configurado en opencode.json" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error configurando MCP: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
}

async function applyRtkFix(check: DoctorCheck, prerequisites: ReturnType<typeof checkPlatformPrerequisites>): Promise<DoctorFixResult> {
  // Guard: rtk repairs only run when the binary is on PATH
  const rtkOnPath = isCommandOnPath("rtk")

  if (!rtkOnPath) {
    return { checkId: check.id, status: "skipped", message: "rtk binary no disponible — reparación omitida" }
  }

  if (check.id === "rtk:routing") {
    try {
      const { existsSync, writeFileSync, mkdirSync, renameSync } = await import("fs")
      const { join } = await import("path")
      const HOME = getHomeDirAuto()
      const INSTRUCTIONS_DIR = join(HOME, ".config", "opencode", "instructions")
      const RTK_ROUTING_PATH = join(INSTRUCTIONS_DIR, "rtk-routing.md")

      const routingContent = `<!-- cyberpunk-managed:rtk-routing -->
# RTK — Token-Optimized Command Proxy

This file adds awareness for \`rtk\`, a high-performance CLI proxy that filters and summarizes command outputs before they reach your LLM context.

## Purpose

Use \`rtk\` commands as drop-in replacements for common CLI tools to reduce token waste from verbose outputs (ls, tree, git, gh, docker, etc.).

## Prefer RTK for verbose CLI output

- Use \`rtk ls\` instead of \`ls\` for directory listings.
- Use \`rtk tree\` instead of \`tree\` for directory trees.
- Use \`rtk read\` instead of \`cat\` for file inspection.
- Use \`rtk git\` instead of raw \`git\` commands when output is large.
- Use \`rtk gh\` instead of raw \`gh\` commands for GitHub operations.
- Use \`rtk test\` instead of raw test runners to show only failures.
- Use \`rtk grep\` instead of \`grep\` for compact, grouped results.
- Use \`rtk diff\` for ultra-condensed diffs.
- Use \`rtk summary\` to run a command and show a heuristic summary.

## When NOT to use RTK

- When you need the full, unfiltered output (e.g., exact bytes, precise formatting).
- When the output is already small and targeted.
- When a command is not supported by RTK.

## Relationship to other tools

- \`context-mode\` provides sandbox execution and indexing (\`ctx_*\` tools). RTK provides compact CLI proxies.
- \`Engram\` is the persistent memory layer. RTK is not a memory tool.
- RTK and context-mode are complementary: use RTK for compact CLI output, context-mode for heavy processing.
`
      mkdirSync(INSTRUCTIONS_DIR, { recursive: true })
      const tmpPath = RTK_ROUTING_PATH + ".tmp"
      writeFileSync(tmpPath, routingContent, "utf8")
      renameSync(tmpPath, RTK_ROUTING_PATH)
      return { checkId: check.id, status: "fixed", message: "Archivo routing RTK creado" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error reparando routing RTK: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
}

async function applyTmuxFix(
  check: DoctorCheck,
  prerequisites: ReturnType<typeof checkPlatformPrerequisites>,
  tmuxTpmRepairSucceeded?: boolean
): Promise<DoctorFixResult> {
  if (!["tmux:config", "tmux:tpm", "tmux:plugins"].includes(check.id)) {
    return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
  }

  try {
    const HOME = getHomeDirAuto()
    const TMUX_CONF_PATH = join(HOME, ".tmux.conf")

    const { readFileSync, existsSync, writeFileSync, renameSync } = await import("fs")

    if (check.id === "tmux:tpm") {
      if (!prerequisites.git) {
        return { checkId: check.id, status: "failed", message: "git no disponible — TPM no pudo repararse automáticamente" }
      }

      return cloneTpm(HOME)
        ? { checkId: check.id, status: "fixed", message: "TPM clonado en ~/.tmux/plugins/tpm" }
        : { checkId: check.id, status: "failed", message: "TPM no pudo clonarse automáticamente" }
    }

    if (check.id === "tmux:plugins") {
      const tpmPath = join(HOME, ".tmux", "plugins", "tpm", "tpm")
      const hasTpm = existsSync(tpmPath)

      if (!hasTpm) {
        if (tmuxTpmRepairSucceeded === false) {
          return { checkId: check.id, status: "failed", message: "TPM sigue faltando; la instalación de plugins queda como advertencia" }
        }

        if (!prerequisites.git) {
          return { checkId: check.id, status: "failed", message: "TPM no está instalado y git no está disponible" }
        }

        if (!cloneTpm(HOME)) {
          return { checkId: check.id, status: "failed", message: "TPM no pudo clonarse automáticamente antes de instalar plugins" }
        }
      }

      const result = runTpmScript(HOME, "install_plugins")
      if (result === "ok") {
        return { checkId: check.id, status: "fixed", message: "Plugins tmux instalados mediante TPM" }
      }

      if (result === "script-missing") {
        return { checkId: check.id, status: "failed", message: "TPM está presente pero no se encontró el script install_plugins" }
      }

      return { checkId: check.id, status: "failed", message: "TPM ejecutó install_plugins pero la instalación falló" }
    }

    let existingContent = ""
    if (existsSync(TMUX_CONF_PATH)) {
      existingContent = readFileSync(TMUX_CONF_PATH, "utf8")
      // Backup
      writeFileSync(TMUX_CONF_PATH + ".bak", existingContent, "utf8")
    }

    const newContent = insertManagedBlock(existingContent, BUNDLED_TMUX_CONF)
    const tmpPath = TMUX_CONF_PATH + ".tmp"
    writeFileSync(tmpPath, newContent, "utf8")
    renameSync(tmpPath, TMUX_CONF_PATH)

    return { checkId: check.id, status: "fixed", message: "Bloque cyberpunk restaurado en ~/.tmux.conf" }
  } catch (err) {
    return {
      checkId: check.id,
      status: "failed",
      message: `Error reparando config tmux: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function applyTuiPluginsFix(check: DoctorCheck): Promise<DoctorFixResult> {
  // Registration checks — call the component's ensure logic via install
  if (check.id.startsWith("tui-plugins:registration:")) {
    try {
      const mod = getTuiPluginsComponent()
      const result = await mod.install()
      if (result.status === "success") {
        return { checkId: check.id, status: "fixed", message: "TUI plugins registrados en tui.json" }
      }
      return { checkId: check.id, status: "unchanged", message: result.message || "TUI plugins sin cambios" }
    } catch (err) {
      return {
        checkId: check.id,
        status: "failed",
        message: `Error registrando TUI plugin: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
  return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
}

async function applyCodebaseMemoryFix(check: DoctorCheck): Promise<DoctorFixResult> {
  try {
    if (check.id === "codebase-memory:routing" || check.id === "codebase-memory:mcp") {
      const mod = getCodebaseMemoryComponent()
      const result = await mod.install()
      return { checkId: check.id, status: result.status === "success" ? "fixed" : "unchanged", message: result.message || "codebase-memory reparado" }
    }

    if (check.id === "codebase-memory:mcp-path") {
      const { resolveCodebaseMemoryExecutable } = await import("../components/codebase-memory")
      const absolutePath = resolveCodebaseMemoryExecutable()
      if (!absolutePath) {
        return { checkId: check.id, status: "failed", message: "codebase-memory-mcp binary no encontrado — no se puede resolver path absoluto" }
      }

      const { readOpenCodeConfig, writeOpenCodeConfig } = await import("../opencode-config")
      const config = readOpenCodeConfig()
      if (!config) {
        return { checkId: check.id, status: "failed", message: "opencode.json no encontrado o no parseable" }
      }

      const mcpObj = (config as Record<string, unknown>).mcp as Record<string, Record<string, unknown>> | undefined
      if (!mcpObj?.["codebase-memory"]) {
        return { checkId: check.id, status: "failed", message: "codebase-memory MCP entry no encontrado en opencode.json" }
      }

      mcpObj["codebase-memory"].command = [absolutePath]
      delete mcpObj["codebase-memory-mcp"]
      writeOpenCodeConfig(config)
      return { checkId: check.id, status: "fixed", message: `MCP command actualizado a path absoluto: ${absolutePath}` }
    }

    return { checkId: check.id, status: "skipped", message: "No fix handler for this check" }
  } catch (err) {
    return {
      checkId: check.id,
      status: "failed",
      message: `Error reparando codebase-memory: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
