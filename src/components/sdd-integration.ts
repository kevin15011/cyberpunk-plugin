// src/components/sdd-integration.ts — Optional SDD patching component

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { dirname, join } from "path"
import type { ComponentModule, InstallResult, ComponentStatus, DoctorCheck, DoctorContext, DoctorResult } from "./types"
import { loadConfig } from "../config/load"
import { saveConfig } from "../config/save"
import { COMPONENT_LABELS } from "../config/schema"
import { getHomeDirAuto } from "../platform/paths"
import { ensureSddReviewAdversaryAgent, ensureSddReviewTaskPermission, readOpenCodeConfig, removePrimaryClaudeReviewAgent, writeOpenCodeConfig } from "../opencode-config"

// --- Patching constants for sdd-phase-common.md Section E ---
export const START_MARKER = "<!-- cyberpunk:start:section-e -->"
export const END_MARKER   = "<!-- cyberpunk:end:section-e -->"
export const SDD_REVIEW_START_MARKER = "<!-- cyberpunk:start:sdd-review-definition -->"
export const SDD_REVIEW_END_MARKER = "<!-- cyberpunk:end:sdd-review-definition -->"
export const JUDGMENT_DAY_START_MARKER = "<!-- cyberpunk:start:judgment-day-opencode-reviewers -->"
export const JUDGMENT_DAY_END_MARKER = "<!-- cyberpunk:end:judgment-day-opencode-reviewers -->"
export const ORCHESTRATOR_JUDGMENT_DAY_START_MARKER = "<!-- cyberpunk:start:orchestrator-judgment-day-selection -->"
export const ORCHESTRATOR_JUDGMENT_DAY_END_MARKER = "<!-- cyberpunk:end:orchestrator-judgment-day-selection -->"
export const ORCHESTRATOR_REVIEW_GATE_START_MARKER = "<!-- cyberpunk:start:sdd-review-gate -->"
export const ORCHESTRATOR_REVIEW_GATE_END_MARKER = "<!-- cyberpunk:end:sdd-review-gate -->"

export const SECTION_E_TEMPLATE = `
## E. Session Stats — Always Report at the End

Before returning to the orchestrator, call \`ctx_stats\` and include the result in your \`detailed_report\` or as a separate line in the envelope.

\`\`\`
ctx_stats
\`\`\`

**Why**: Every SDD phase processes files, runs commands, and indexes content. Reporting the session savings makes the token cost visible and encourages consistent use of \`ctx_*\` tools.

**Format**: Add this at the end of your return:

\`\`\`
-- Session Stats --
$ ctx_stats output here
\`\`\`

If \`ctx_stats\` is unavailable (e.g., not installed), skip silently.
`.trim()

export const SECTION_F_TEMPLATE = `
## F. RTK Routing

Prefer \`rtk\` for broad shell inspection and verbose command output when a compact CLI proxy is enough (for example: directory listings, trees, long git/gh output, or noisy test output).

- Keep using narrow file tools like \`Read\`, \`Grep\`, and \`Glob\` for targeted file/content inspection.
- Use \`context-mode\` / \`ctx_*\` tools only when you need heavy sandboxed processing, indexed follow-up questions, or the output would otherwise be genuinely large.
- If \`rtk\` is unavailable or a command is unsupported, fall back to the normal tool path.
`.trim()

export const MANAGED_SDD_TEMPLATE = `${SECTION_E_TEMPLATE}\n\n${SECTION_F_TEMPLATE}`

export const SDD_REVIEW_DEFINITION_TEMPLATE = `
## Cyberpunk SDD Review Definition

This skill supports two execution modes.

### Standard SDD Review Mode

Use when launched as the normal \`sdd-review\` phase.

- Read spec, design, tasks, and apply-progress for context and boundaries.
- Read the actual changed files.
- Persist \`review-report\` using the active artifact store.
- Focus on adversarial engineering code review: security, safe filesystem/config/process usage, error handling, maintainability, simplicity, local architecture boundaries, operational UX, and real edge cases.
- Do not perform full spec/test verification; that belongs to \`sdd-verify\`.

### Judgment Day Judge Mode

Use when the prompt says \`JUDGMENT DAY JUDGE\` or the orchestrator launches you as Judge A/B.

- Act as a blind adversarial judge.
- Do not persist \`review-report\`.
- Do not coordinate with another judge.
- Do not modify code.
- Return findings only. No praise.

Classify each finding:

- CRITICAL: must be fixed before verify.
- WARNING (real): normal intended use can trigger it.
- WARNING (theoretical): contrived, malicious, or impractical path only.
- SUGGESTION: non-blocking improvement.

Primary criteria:

1. Security and unsafe trust boundaries.
2. Filesystem, process execution, config mutation, and secrets safety.
3. Correctness risks and real edge cases.
4. Error handling, recovery, and actionable user feedback.
5. Maintainability, naming, duplication, and unnecessary complexity.
6. Local architecture boundaries and coupling.
7. Test risk as a signal only, not as formal verification.

Approved criteria: zero CRITICAL findings and zero WARNING (real) findings.
`.trim()

export const ORCHESTRATOR_REVIEW_GATE_TEMPLATE = `
### SDD Quality Phase — Verify + Judgment Day

After \`sdd-apply\` completes, do NOT treat \`sdd-apply.next_recommended: sdd-verify\` as permission to run a standalone verify step.

\`sdd-apply.next_recommended\` is advisory only. The orchestrator owns the phase order.

When the next phase is \`sdd-verify\`, run a composite Quality Phase:

1. Launch \`sdd-verify\` and Judgment Day in parallel.
2. For Judgment Day, launch two blind reviewers in parallel: Judge A with \`sdd-review\`, Judge B with \`sdd-review-adversary\`.
   If \`sdd-review-adversary\` is unavailable, fall back to two \`sdd-review\` judges.
3. Pass both judges the same target, changed files, apply-progress reference, and SDD Review criteria.
4. Wait for all three sub-agents: \`sdd-verify\`, Judge A, and Judge B.
5. Synthesize one Quality Phase result from:
   - verify CRITICAL/WARNING/SUGGESTION findings and final verdict;
   - Judgment Day confirmed/suspect/contradiction/INFO buckets;
   - confirmed CRITICAL or WARNING (real) review findings.
6. If verify passes and Judgment Day returns \`JUDGMENT: APPROVED\`, continue to archive/next phase.
7. If verify fails, Judgment Day escalates, or confirmed CRITICAL / WARNING (real) findings exist, do not archive. Send one consolidated fix packet to \`sdd-apply\`, then re-run the composite Quality Phase.

When no \`sdd-verify\` phase applies, Judgment Day may still run normally as an independent review workflow.
`.trim()

export const JUDGMENT_DAY_REVIEWER_SELECTION_TEMPLATE = `
## Cyberpunk OpenCode Reviewer Selection

When Judgment Day is invoked for code review in OpenCode, prefer model-diverse SDD reviewers:

- Judge A: launch \`sdd-review\`.
- Judge B: launch \`sdd-review-adversary\`.
- Pass both judges the same target, changed files, standards, and review criteria.
- Do not launch two identical \`sdd-review\` judges when \`sdd-review-adversary\` exists and is allowed.
- If \`sdd-review-adversary\` is unavailable, fall back to two \`sdd-review\` judges and report the fallback in Skill Resolution.

This rule applies to standalone Judgment Day reviews and to SDD composite quality phases.
`.trim()

export const ORCHESTRATOR_JUDGMENT_DAY_SELECTION_TEMPLATE = `
### Judgment Day Agent Selection

Whenever Judgment Day is invoked for code review, including standalone Judgment Day and SDD Quality Phase:

- Judge A MUST use \`sdd-review\`.
- Judge B MUST use \`sdd-review-adversary\`.
- Do not launch two \`sdd-review\` judges when \`sdd-review-adversary\` exists and is allowed.
- Before fallback, check \`opencode.json\` agent definitions and task permissions.
- Fall back to two \`sdd-review\` judges only if \`sdd-review-adversary\` is missing or not allowed.
- Report the selected judge agents in the Judgment Day summary.
`.trim()

const REQUIRED_OPENCODE_SDD_ASSETS = [
  ["skills", "_shared", "sdd-phase-common.md"],
  ["skills", "sdd-propose", "SKILL.md"],
  ["skills", "sdd-spec", "SKILL.md"],
  ["skills", "sdd-design", "SKILL.md"],
  ["skills", "sdd-tasks", "SKILL.md"],
  ["skills", "sdd-apply", "SKILL.md"],
  ["skills", "sdd-review", "SKILL.md"],
  ["skills", "sdd-verify", "SKILL.md"],
  ["skills", "sdd-archive", "SKILL.md"],
] as const

const OPTIONAL_OPENCODE_SDD_ASSETS = [
  ["skills", "sdd-init", "SKILL.md"],
  ["skills", "sdd-explore", "SKILL.md"],
  ["skills", "sdd-onboard", "SKILL.md"],
  ["skills", "judgment-day", "SKILL.md"],
] as const

export interface OpenCodeSddReadiness {
  ready: boolean
  required: string[]
  missingRequired: string[]
  optionalMissing: string[]
}

function getSddPhaseCommonPath(): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")
}

function getSddReviewSkillPath(): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode", "skills", "sdd-review", "SKILL.md")
}

function buildManagedSddReviewSkill(): string {
  return `# sdd-review

Code review using the assigned model against SDD specs, design decisions, tasks, and apply-progress.

${SDD_REVIEW_START_MARKER}
${SDD_REVIEW_DEFINITION_TEMPLATE}
${SDD_REVIEW_END_MARKER}
`
}

export function ensureOpenCodeSddAssets(readiness: OpenCodeSddReadiness = detectOpenCodeSddReadiness()): boolean {
  const reviewPath = getSddReviewSkillPath()
  if (existsSync(reviewPath)) return false

  // Only bootstrap assets owned by this project. External skills like
  // judgment-day are integrated when present, but never fabricated here.
  const missingWithoutReview = readiness.missingRequired.filter(path => path !== reviewPath)
  if (missingWithoutReview.length > 0) return false

  mkdirSync(dirname(reviewPath), { recursive: true })
  writeFileSync(reviewPath, buildManagedSddReviewSkill(), "utf8")
  return true
}

function getJudgmentDaySkillPath(): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode", "skills", "judgment-day", "SKILL.md")
}

function getOpenCodeSddAssetPath(parts: readonly string[]): string {
  const home = getHomeDirAuto()
  return join(home, ".config", "opencode", ...parts)
}

function formatHomePath(path: string): string {
  const home = getHomeDirAuto()
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

function missingList(paths: string[]): string {
  return paths.map(path => formatHomePath(path)).join(", ")
}

function isSddPatched(): boolean {
  const sddPhaseCommonPath = getSddPhaseCommonPath()
  if (!existsSync(sddPhaseCommonPath)) return false
  const content = readFileSync(sddPhaseCommonPath, "utf8")
  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  return extracted?.managed.trim() === MANAGED_SDD_TEMPLATE
}

function isSddReviewPatched(): boolean {
  const path = getSddReviewSkillPath()
  if (!existsSync(path)) return false
  const content = readFileSync(path, "utf8")
  const extracted = extractBetweenMarkers(content, SDD_REVIEW_START_MARKER, SDD_REVIEW_END_MARKER)
  return extracted?.managed.trim() === SDD_REVIEW_DEFINITION_TEMPLATE
}

function isJudgmentDayPatched(): boolean {
  const path = getJudgmentDaySkillPath()
  if (!existsSync(path)) return false
  const content = readFileSync(path, "utf8")
  const extracted = extractBetweenMarkers(content, JUDGMENT_DAY_START_MARKER, JUDGMENT_DAY_END_MARKER)
  return extracted?.managed.trim() === JUDGMENT_DAY_REVIEWER_SELECTION_TEMPLATE
}

function isOrchestratorReviewGatePatched(): boolean {
  const config = readOpenCodeConfig()
  const prompt = config?.agent?.["gentle-orchestrator"]?.prompt
  if (typeof prompt !== "string") return false
  const extracted = extractBetweenMarkers(prompt, ORCHESTRATOR_REVIEW_GATE_START_MARKER, ORCHESTRATOR_REVIEW_GATE_END_MARKER)
  return extracted?.managed.trim() === ORCHESTRATOR_REVIEW_GATE_TEMPLATE
}

function isOrchestratorJudgmentDaySelectionPatched(): boolean {
  const config = readOpenCodeConfig()
  const prompt = config?.agent?.["gentle-orchestrator"]?.prompt
  if (typeof prompt !== "string") return false
  const extracted = extractBetweenMarkers(prompt, ORCHESTRATOR_JUDGMENT_DAY_START_MARKER, ORCHESTRATOR_JUDGMENT_DAY_END_MARKER)
  return extracted?.managed.trim() === ORCHESTRATOR_JUDGMENT_DAY_SELECTION_TEMPLATE
}

export function detectOpenCodeSddReadiness(): OpenCodeSddReadiness {
  const required = REQUIRED_OPENCODE_SDD_ASSETS.map(parts => getOpenCodeSddAssetPath(parts))
  const optional = OPTIONAL_OPENCODE_SDD_ASSETS.map(parts => getOpenCodeSddAssetPath(parts))
  const missingRequired = required.filter(path => !existsSync(path))
  const optionalMissing = optional.filter(path => !existsSync(path))

  return {
    ready: missingRequired.length === 0,
    required,
    missingRequired,
    optionalMissing,
  }
}

export function extractBetweenMarkers(
  content: string,
  startMarker: string,
  endMarker: string
): { before: string; managed: string; after: string } | null {
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) return null
  const afterStart = startIdx + startMarker.length
  const endIdx = content.indexOf(endMarker, afterStart)
  if (endIdx === -1) return null
  return {
    before:  content.slice(0, startIdx),
    managed: content.slice(afterStart, endIdx),
    after:   content.slice(endIdx + endMarker.length),
  }
}

/**
 * Detect whether sdd-phase-common.md exists at the expected path.
 */
export function detectSddPhaseCommon(): boolean {
  return existsSync(getSddPhaseCommonPath())
}

/**
 * Patch sdd-phase-common.md with Section E/F content wrapped in markers.
 * Returns true if the file was modified, false otherwise.
 */
export function patchSddPhaseCommon(): boolean {
  const sddPhaseCommonPath = getSddPhaseCommonPath()

  // Guard: file doesn't exist — skip silently
  if (!existsSync(sddPhaseCommonPath)) return false

  const content = readFileSync(sddPhaseCommonPath, "utf8")

  // State 1: No markers → heading detection or append
  if (!content.includes(START_MARKER)) {
    const headingIndex = content.indexOf("\n## E.")
    const markedSection = `\n${START_MARKER}\n${MANAGED_SDD_TEMPLATE}\n${END_MARKER}\n`
    const newContent = headingIndex !== -1
      ? content.slice(0, headingIndex) + markedSection
      : content.trimEnd() + "\n\n" + markedSection
    const tmpPath = sddPhaseCommonPath + ".tmp"
    writeFileSync(tmpPath, newContent, "utf8")
    renameSync(tmpPath, sddPhaseCommonPath)
    return true
  }

  // State 2: Markers present, content matches → no-op
  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false
  if (extracted.managed.trim() === MANAGED_SDD_TEMPLATE) return false

  // State 3: Markers present, content mismatched → replace
  const newContent =
    extracted.before +
    START_MARKER + "\n" + MANAGED_SDD_TEMPLATE + "\n" +
    END_MARKER +
    extracted.after
  const tmpPath = sddPhaseCommonPath + ".tmp"
  writeFileSync(tmpPath, newContent, "utf8")
  renameSync(tmpPath, sddPhaseCommonPath)
  return true
}

function patchMarkdownFile(path: string, startMarker: string, endMarker: string, managedContent: string): boolean {
  if (!existsSync(path)) return false
  const content = readFileSync(path, "utf8")
  const markedSection = `\n${startMarker}\n${managedContent}\n${endMarker}\n`

  if (!content.includes(startMarker)) {
    const newContent = content.trimEnd() + "\n\n" + markedSection
    const tmpPath = path + ".tmp"
    writeFileSync(tmpPath, newContent, "utf8")
    renameSync(tmpPath, path)
    return true
  }

  const extracted = extractBetweenMarkers(content, startMarker, endMarker)
  if (!extracted) return false
  if (extracted.managed.trim() === managedContent) return false

  const newContent = extracted.before + startMarker + "\n" + managedContent + "\n" + endMarker + extracted.after
  const tmpPath = path + ".tmp"
  writeFileSync(tmpPath, newContent, "utf8")
  renameSync(tmpPath, path)
  return true
}

export function patchSddReviewSkill(): boolean {
  return patchMarkdownFile(getSddReviewSkillPath(), SDD_REVIEW_START_MARKER, SDD_REVIEW_END_MARKER, SDD_REVIEW_DEFINITION_TEMPLATE)
}

export function patchJudgmentDaySkill(): boolean {
  return patchMarkdownFile(getJudgmentDaySkillPath(), JUDGMENT_DAY_START_MARKER, JUDGMENT_DAY_END_MARKER, JUDGMENT_DAY_REVIEWER_SELECTION_TEMPLATE)
}

export function patchOpenCodeSddOrchestrator(): boolean {
  const config = readOpenCodeConfig()
  if (!config?.agent || typeof config.agent !== "object") return false
  const orchestrator = config.agent["gentle-orchestrator"]
  if (!orchestrator || typeof orchestrator.prompt !== "string") return false

  let nextPrompt = orchestrator.prompt
  let promptChanged = false

  const selectionMarkedSection = `\n${ORCHESTRATOR_JUDGMENT_DAY_START_MARKER}\n${ORCHESTRATOR_JUDGMENT_DAY_SELECTION_TEMPLATE}\n${ORCHESTRATOR_JUDGMENT_DAY_END_MARKER}\n`
  if (!nextPrompt.includes(ORCHESTRATOR_JUDGMENT_DAY_START_MARKER)) {
    const insertAfter = "### Dependency Graph"
    const idx = nextPrompt.indexOf(insertAfter)
    nextPrompt = idx === -1
      ? nextPrompt.trimEnd() + "\n\n" + selectionMarkedSection
      : nextPrompt.slice(0, idx) + selectionMarkedSection + "\n" + nextPrompt.slice(idx)
    promptChanged = true
  } else {
    const extracted = extractBetweenMarkers(nextPrompt, ORCHESTRATOR_JUDGMENT_DAY_START_MARKER, ORCHESTRATOR_JUDGMENT_DAY_END_MARKER)
    if (!extracted) return false
    if (extracted.managed.trim() !== ORCHESTRATOR_JUDGMENT_DAY_SELECTION_TEMPLATE) {
      nextPrompt = extracted.before + ORCHESTRATOR_JUDGMENT_DAY_START_MARKER + "\n" + ORCHESTRATOR_JUDGMENT_DAY_SELECTION_TEMPLATE + "\n" + ORCHESTRATOR_JUDGMENT_DAY_END_MARKER + extracted.after
      promptChanged = true
    }
  }

  const markedSection = `\n${ORCHESTRATOR_REVIEW_GATE_START_MARKER}\n${ORCHESTRATOR_REVIEW_GATE_TEMPLATE}\n${ORCHESTRATOR_REVIEW_GATE_END_MARKER}\n`
  if (!nextPrompt.includes(ORCHESTRATOR_REVIEW_GATE_START_MARKER)) {
    const insertAfter = "### Review Workload Guard (MANDATORY)"
    const idx = nextPrompt.indexOf(insertAfter)
    nextPrompt = idx === -1
      ? nextPrompt.trimEnd() + "\n\n" + markedSection
      : nextPrompt.slice(0, idx) + markedSection + "\n" + nextPrompt.slice(idx)
    promptChanged = true
  } else {
    const extracted = extractBetweenMarkers(nextPrompt, ORCHESTRATOR_REVIEW_GATE_START_MARKER, ORCHESTRATOR_REVIEW_GATE_END_MARKER)
    if (!extracted) return false
    if (extracted.managed.trim() !== ORCHESTRATOR_REVIEW_GATE_TEMPLATE) {
      nextPrompt = extracted.before + ORCHESTRATOR_REVIEW_GATE_START_MARKER + "\n" + ORCHESTRATOR_REVIEW_GATE_TEMPLATE + "\n" + ORCHESTRATOR_REVIEW_GATE_END_MARKER + extracted.after
      promptChanged = true
    }
  }

  config.agent["gentle-orchestrator"] = { ...orchestrator, prompt: nextPrompt }
  let changed = promptChanged
  changed = ensureSddReviewTaskPermission(config) || changed
  changed = ensureSddReviewAdversaryAgent(config) || changed
  changed = removePrimaryClaudeReviewAgent(config) || changed
  if (!changed) return false
  writeOpenCodeConfig(config)
  return changed
}

/**
 * Remove the managed marker block from sdd-phase-common.md, preserving surrounding content.
 * Returns true if content was removed, false if no markers found.
 */
export function unpatchSddPhaseCommon(): boolean {
  const sddPhaseCommonPath = getSddPhaseCommonPath()

  if (!existsSync(sddPhaseCommonPath)) return false

  const content = readFileSync(sddPhaseCommonPath, "utf8")
  if (!content.includes(START_MARKER)) return false

  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false

  const newContent = extracted.before + extracted.after
  const tmpPath = sddPhaseCommonPath + ".tmp"
  writeFileSync(tmpPath, newContent, "utf8")
  renameSync(tmpPath, sddPhaseCommonPath)
  return true
}

function unpatchMarkdownFile(path: string, startMarker: string, endMarker: string): boolean {
  if (!existsSync(path)) return false
  const content = readFileSync(path, "utf8")
  if (!content.includes(startMarker)) return false
  const extracted = extractBetweenMarkers(content, startMarker, endMarker)
  if (!extracted) return false
  const newContent = extracted.before + extracted.after
  const tmpPath = path + ".tmp"
  writeFileSync(tmpPath, newContent, "utf8")
  renameSync(tmpPath, path)
  return true
}

export function unpatchSddReviewSkill(): boolean {
  return unpatchMarkdownFile(getSddReviewSkillPath(), SDD_REVIEW_START_MARKER, SDD_REVIEW_END_MARKER)
}

export function unpatchJudgmentDaySkill(): boolean {
  return unpatchMarkdownFile(getJudgmentDaySkillPath(), JUDGMENT_DAY_START_MARKER, JUDGMENT_DAY_END_MARKER)
}

export function unpatchOpenCodeSddOrchestrator(): boolean {
  const config = readOpenCodeConfig()
  if (!config?.agent || typeof config.agent !== "object") return false
  const orchestrator = config.agent["gentle-orchestrator"]
  if (!orchestrator || typeof orchestrator.prompt !== "string") return false
  let nextPrompt = orchestrator.prompt
  let changed = false
  const gateExtracted = extractBetweenMarkers(nextPrompt, ORCHESTRATOR_REVIEW_GATE_START_MARKER, ORCHESTRATOR_REVIEW_GATE_END_MARKER)
  if (gateExtracted) {
    nextPrompt = gateExtracted.before + gateExtracted.after
    changed = true
  }
  const selectionExtracted = extractBetweenMarkers(nextPrompt, ORCHESTRATOR_JUDGMENT_DAY_START_MARKER, ORCHESTRATOR_JUDGMENT_DAY_END_MARKER)
  if (selectionExtracted) {
    nextPrompt = selectionExtracted.before + selectionExtracted.after
    changed = true
  }
  if (!changed) return false
  config.agent["gentle-orchestrator"] = { ...orchestrator, prompt: nextPrompt }
  writeOpenCodeConfig(config)
  return true
}

/**
 * Doctor check for SDD integration patching.
 * Returns empty checks when the component is not installed, per spec.
 */
export function checkSddIntegrationDoctor(ctx: DoctorContext): DoctorCheck[] {
  const isInstalled = (ctx.cyberpunkConfig as any)?.components?.["sdd-integration"]?.installed === true // eslint-disable-line @typescript-eslint/no-explicit-any
  const checks: DoctorCheck[] = []
  const readiness = detectOpenCodeSddReadiness()

  if (!readiness.ready) {
    checks.push({
      id: "sdd-integration:readiness",
      label: "OpenCode SDD assets",
      status: isInstalled ? "fail" : "warn",
      message: `SDD Integration unavailable — missing required OpenCode SDD assets: ${missingList(readiness.missingRequired)}`,
      fixable: false,
      detail: {
        nextStep: "Install the missing OpenCode SDD skill files, then rerun cyberpunk install --component sdd-integration or doctor --fix.",
      },
    })
    return checks
  }

  checks.push({
    id: "sdd-integration:readiness",
    label: "OpenCode SDD assets",
    status: "pass",
    message: readiness.optionalMissing.length > 0
      ? `Required OpenCode SDD assets present; optional missing: ${missingList(readiness.optionalMissing)}`
      : "Required OpenCode SDD assets present",
    fixable: false,
  })

  if (!isInstalled) return checks

  const sddPhaseCommonPath = getSddPhaseCommonPath()

  if (!existsSync(sddPhaseCommonPath)) {
    checks.push({
      id: "sdd-integration:patching",
      label: "Patching sdd-phase-common.md",
      status: "warn",
      message: "sdd-phase-common.md no encontrado — patching no aplicable",
      fixable: false,
    })
  } else {
    const content = readFileSync(sddPhaseCommonPath, "utf8")
    if (!content.includes(START_MARKER)) {
      checks.push({
        id: "sdd-integration:patching",
        label: "Patching sdd-phase-common.md",
        status: "fail",
        message: "Marcadores Section E/F ausentes en sdd-phase-common.md",
        fixable: true,
      })
    } else {
      // Check if content matches expected
      const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
      const judgmentDayOk = !existsSync(getJudgmentDaySkillPath()) || isJudgmentDayPatched()
      if (extracted && extracted.managed.trim() === MANAGED_SDD_TEMPLATE && isSddReviewPatched() && isOrchestratorReviewGatePatched() && isOrchestratorJudgmentDaySelectionPatched() && judgmentDayOk) {
        checks.push({
          id: "sdd-integration:patching",
          label: "Patching sdd-phase-common.md",
          status: "pass",
          message: "Section E/F, sdd-review, Judgment Day y orchestrator review gate correctamente aplicados",
          fixable: false,
        })
      } else {
        checks.push({
          id: "sdd-integration:patching",
          label: "Patching sdd-phase-common.md",
          status: "fail",
          message: "Contenido SDD Integration no coincide con el esperado (drift detectado)",
          fixable: true,
        })
      }
    }
  }

  return checks
}

/**
 * Component factory for sdd-integration.
 */
export function getSddIntegrationComponent(): ComponentModule {
  return {
    id: "sdd-integration",
    label: COMPONENT_LABELS["sdd-integration"],

    async install(): Promise<InstallResult> {
      let readiness = detectOpenCodeSddReadiness()
      const bootstrappedOwnedAssets = ensureOpenCodeSddAssets(readiness)
      if (bootstrappedOwnedAssets) {
        readiness = detectOpenCodeSddReadiness()
      }

      if (!readiness.ready) {
        return {
          component: "sdd-integration",
          action: "install",
          status: "skipped",
          message: `SDD Integration no disponible — faltan assets OpenCode SDD requeridos: ${missingList(readiness.missingRequired)}`,
        }
      }

      const patched = patchSddPhaseCommon()
      const reviewPatched = patchSddReviewSkill()
      const judgmentDayPatched = patchJudgmentDaySkill()
      const orchestratorPatched = patchOpenCodeSddOrchestrator()

      // Update config
      const config = loadConfig()
      config.components["sdd-integration"] = {
        installed: true,
        version: "bundled",
        installedAt: new Date().toISOString(),
      }
      saveConfig(config)

      return {
        component: "sdd-integration",
        action: "install",
        status: bootstrappedOwnedAssets || patched || reviewPatched || judgmentDayPatched || orchestratorPatched ? "success" : "skipped",
        message: bootstrappedOwnedAssets || patched || reviewPatched || judgmentDayPatched || orchestratorPatched
          ? "SDD Integration instalada, review gate, Judgment Day y sdd-review actualizados"
          : "SDD Integration ya instalada y actualizada",
      }
    },

    async uninstall(): Promise<InstallResult> {
      const removed = unpatchSddPhaseCommon()
      const reviewRemoved = unpatchSddReviewSkill()
      const judgmentDayRemoved = unpatchJudgmentDaySkill()
      const orchestratorRemoved = unpatchOpenCodeSddOrchestrator()

      // Update config
      const config = loadConfig()
      config.components["sdd-integration"] = { installed: false }
      saveConfig(config)

      return {
        component: "sdd-integration",
        action: "uninstall",
        status: "success",
        message: removed || reviewRemoved || judgmentDayRemoved || orchestratorRemoved
          ? "SDD Integration desinstalada, marcadores removidos"
          : "SDD Integration desinstalada (sin marcadores para remover)",
      }
    },

    async status(): Promise<ComponentStatus> {
      const readiness = detectOpenCodeSddReadiness()
      if (!readiness.ready) {
        return {
          id: "sdd-integration",
          label: COMPONENT_LABELS["sdd-integration"],
          status: "error",
          error: `SDD Integration unavailable — missing required OpenCode SDD assets: ${missingList(readiness.missingRequired)}`,
        }
      }

      const judgmentDayOk = !existsSync(getJudgmentDaySkillPath()) || isJudgmentDayPatched()
      const patched = isSddPatched() && isSddReviewPatched() && isOrchestratorReviewGatePatched() && isOrchestratorJudgmentDaySelectionPatched() && judgmentDayOk
      return {
        id: "sdd-integration",
        label: COMPONENT_LABELS["sdd-integration"],
        status: patched ? "installed" : "available",
        error: patched ? undefined : "OpenCode SDD assets ready; Section E/F patch pending",
      }
    },

    async doctor(ctx: DoctorContext): Promise<DoctorResult> {
      const checks = checkSddIntegrationDoctor(ctx)
      return { component: "sdd-integration", checks }
    },
  }
}
