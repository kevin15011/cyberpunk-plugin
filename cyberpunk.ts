import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

const HOME = process.env.HOME!
const CONFIG = join(HOME, ".config", "opencode")
const COMMANDS = join(CONFIG, "commands")
const PROMPTS = join(CONFIG, "prompts", "sdd")
const SKILLS = join(CONFIG, "skills")
const SOUNDS = join(CONFIG, "sounds")
const THEMES = join(CONFIG, "themes")
const OPENCODE_JSON = join(CONFIG, "opencode.json")
const IS_MAC = process.platform === "darwin"
const SHOW_INSTALL_NOTICES = process.env.OPENCODE_CYBERPUNK_INSTALL_NOTICES === "1"
const SDD_REVIEW_PROMPT_PATH = join(PROMPTS, "sdd-review.md")
const SDD_CLAUDE_REVIEW_PROMPT_PATH = join(PROMPTS, "sdd-claude-review.md")
const SDD_REVIEW_SKILL_PATH = join(SKILLS, "sdd-review", "SKILL.md")
const SDD_CLAUDE_REVIEW_SKILL_PATH = join(SKILLS, "sdd-claude-review", "SKILL.md")

function fileRef(path: string) {
  return `{file:${path}}`
}

function logInstallNotice(message: string) {
  if (!SHOW_INSTALL_NOTICES) return
  console.log(message)
}

async function ensureSound($: any, file: string, args: string) {
  const path = join(SOUNDS, file)
  if (existsSync(path)) return

  const command = `ffmpeg -loglevel error -nostats ${args} ${JSON.stringify(path)} >/dev/null 2>&1`

  try {
    await $`bash -lc ${command}`.nothrow()
  } catch {}
}

const SDD_REVIEW_PROMPT = `You are an SDD executor for the review phase, not the orchestrator. Do this phase's work yourself. Do NOT delegate, Do NOT call task/delegate, and Do NOT launch sub-agents. Read your skill file at ${SDD_REVIEW_SKILL_PATH} and follow it exactly.
`

const SDD_CLAUDE_REVIEW_PROMPT = `You are an SDD executor for the claude-review phase, not the orchestrator. Do this phase's work yourself. Do NOT delegate, Do NOT call task/delegate, and Do NOT launch sub-agents. Read your skill file at ${SDD_CLAUDE_REVIEW_SKILL_PATH} and follow it exactly.
`

const SDD_REVIEW_COMMAND = `---
description: Code review against specs and design decisions after implementation
agent: sdd-orchestrator
subtask: true
---

You are an SDD sub-agent. Read the skill file at ${SDD_REVIEW_SKILL_PATH} FIRST, then follow its instructions exactly.

CONTEXT:
- Working directory: !\`echo -n "$(pwd)"\`
- Current project: !\`echo -n "$(basename $(pwd))"\`
- Artifact store mode: engram

TASK:
Review the active SDD change implementation. Read the specs, design, tasks, and apply-progress artifacts. Then build a structured review report with CRITICAL, WARNING, SUGGESTION, spec alignment, design coherence, and verdict. Persist the artifact as sdd/{change-name}/review-report.
`

const SDD_CLAUDE_REVIEW_COMMAND = `---
description: AI code review using Claude Code Opus after implementation (external CLI)
agent: sdd-orchestrator
subtask: true
---

You are an SDD sub-agent. Read the skill file at ${SDD_CLAUDE_REVIEW_SKILL_PATH} FIRST, then follow its instructions exactly.

CONTEXT:
- Working directory: !\`echo -n "$(pwd)"\`
- Current project: !\`echo -n "$(basename $(pwd))"\`
- Artifact store mode: engram

TASK:
Review the active SDD change implementation using Claude Code Opus as an independent reviewer. Read the spec, design, tasks, and apply-progress artifacts. Persist the artifact as sdd/{change-name}/claude-review-report.
`

const SDD_REVIEW_SKILL = `---
name: sdd-review
description: >
  Code review using the assigned model. Reads specs, design, tasks, apply-progress and changed files,
  then performs a structured review checking correctness, coherence, and code quality.
  Runs after sdd-apply and before sdd-verify.
license: MIT
metadata:
  author: cyberpunk-plugin
  version: "1.0"
---

## Purpose

You are a sub-agent responsible for code review. Review the implementation against specs and design using your own model. Do not modify code.

## What You Receive

- Change name
- Artifact store mode (engram | openspec | hybrid | none)

## Execution and Persistence Contract

Follow Section B and Section C from skills/_shared/sdd-phase-common.md.

- engram: read sdd/{change-name}/spec, design, tasks, apply-progress. Save sdd/{change-name}/review-report.
- openspec: save openspec/changes/{change-name}/review-report.md.
- hybrid: do both.
- none: return inline only.

## What to Do

### Step 1: Load Skills

Follow Section A from skills/_shared/sdd-phase-common.md.

### Step 2: Retrieve Artifacts

Retrieve spec, design, tasks, and apply-progress. All are required.

### Step 3: Read Changed Files

Extract changed file paths from apply-progress and read each file.

### Step 4: Review

- Check spec alignment for each changed behavior.
- Check design coherence against design decisions.
- Check code quality: security, complexity, dead code, naming, accessibility, missing error handling.

### Step 5: Build Report

Write a structured review report with:

- CRITICAL
- WARNING
- SUGGESTION
- Spec Alignment
- Design Coherence
- Per-File Summary
- Verdict

### Step 6: Persist

Persist artifact review-report using Section C from skills/_shared/sdd-phase-common.md.

### Step 7: Return Summary

Return envelope per Section D from skills/_shared/sdd-phase-common.md.

## Rules

- Always read the actual changed files.
- Never modify code.
- Compare against specs first, design second.
- Critical issues must be fixed before sdd-verify.
`

const SDD_CLAUDE_REVIEW_SKILL = `---
name: sdd-claude-review
description: >
  AI code review using Claude Code Opus CLI as second opinion.
  Runs after sdd-apply and before sdd-verify.
license: MIT
metadata:
  author: cyberpunk-plugin
  version: "1.0"
---

## Purpose

You are a sub-agent responsible for code review. Use Claude Code CLI (Opus) as an external reviewer against specs and design. Do not modify code.

## What You Receive

- Change name
- Artifact store mode (engram | openspec | hybrid | none)

## Execution and Persistence Contract

Follow Section B and Section C from skills/_shared/sdd-phase-common.md.

- engram: read sdd/{change-name}/spec, design, tasks, apply-progress. Save sdd/{change-name}/claude-review-report.
- openspec: save openspec/changes/{change-name}/claude-review-report.md.
- hybrid: do both.
- none: return inline only.

## What to Do

### Step 1: Load Skills

Follow Section A from skills/_shared/sdd-phase-common.md.

### Step 2: Retrieve Artifacts

Retrieve spec, design, tasks, and apply-progress. All are required.

### Step 3: Extract Changed Files

Extract changed file paths from apply-progress. Do not read file contents yourself.

### Step 4: Build Claude Prompt

Create a concise prompt summarizing specs and design decisions plus file paths.

### Step 5: Invoke Claude CLI

Run claude -p with:

- --model opus
- --effort high
- --allowedTools "Read"
- --output-format text

Claude should read the changed files itself and return CRITICAL, WARNING, SUGGESTION, SPEC ALIGNMENT, and VERDICT.

### Step 6: Persist

Persist artifact claude-review-report using Section C from skills/_shared/sdd-phase-common.md.

### Step 7: Return Summary

Return envelope per Section D from skills/_shared/sdd-phase-common.md.

## Rules

- Never pass full file contents in the prompt.
- Always include --allowedTools "Read".
- Do not use --bare because OAuth auth breaks.
- If Claude CLI is unavailable, return blocked.
`

const SDD_MANAGED_AGENTS = {
  "sdd-review": {
    description: "Code review using assigned model against specs and design decisions",
    hidden: true,
    mode: "subagent",
    model: "zai-coding-plan/glm-5.1",
    prompt: fileRef(SDD_REVIEW_PROMPT_PATH),
    tools: { bash: true, read: true, write: true },
  },
  "sdd-review-intranet": {
    description: "Code review using assigned model against specs and design decisions",
    hidden: true,
    mode: "subagent",
    model: "zai-coding-plan/glm-5-turbo",
    prompt: fileRef(SDD_REVIEW_PROMPT_PATH),
    tools: { bash: true, read: true, write: true },
  },
  "sdd-claude-review": {
    description: "AI code review using Claude Code Opus CLI as second opinion",
    hidden: true,
    mode: "subagent",
    model: "alibaba-coding-plan/glm-5",
    prompt: fileRef(SDD_CLAUDE_REVIEW_PROMPT_PATH),
    tools: { bash: true, read: true, write: true },
  },
  "sdd-claude-review-intranet": {
    description: "AI code review using Claude Code Opus CLI as second opinion",
    hidden: true,
    mode: "subagent",
    model: "alibaba-coding-plan/glm-5",
    prompt: fileRef(SDD_CLAUDE_REVIEW_PROMPT_PATH),
    tools: { bash: true, read: true, write: true },
  },
} as const

const CYBERPUNK_THEME = JSON.stringify({
  "$schema": "https://opencode.ai/theme.json",
  "defs": {
    "neonPink": "#ff00ff",
    "neonCyan": "#00ffff",
    "neonGreen": "#00ff41",
    "neonRed": "#ff0055",
    "neonYellow": "#fffc00",
    "neonOrange": "#ff6600",
    "neonPurple": "#b400ff",
    "darkBg0": "#05050f",
    "darkBg1": "#0a0a1a",
    "darkBg2": "#0f0f2a",
    "darkBg3": "#1a1a3e",
    "grayMid": "#3a3a6a",
    "grayLight": "#7a7aaa",
    "grayBright": "#b0b0d0",
    "white": "#e0e0ff"
  },
  "theme": {
    "primary": "neonCyan",
    "secondary": "neonPink",
    "accent": "neonGreen",
    "error": "neonRed",
    "warning": "neonYellow",
    "success": "neonGreen",
    "info": "neonCyan",
    "text": "white",
    "textMuted": "grayLight",
    "background": "darkBg0",
    "backgroundPanel": "darkBg1",
    "backgroundElement": "darkBg2",
    "border": "darkBg3",
    "borderActive": "neonPink",
    "borderSubtle": "grayMid",
    "diffAdded": "neonGreen",
    "diffRemoved": "neonRed",
    "diffContext": "grayMid",
    "diffHunkHeader": "neonCyan",
    "diffHighlightAdded": "#39ff14",
    "diffHighlightRemoved": "#ff0040",
    "diffAddedBg": "#0a1a0a",
    "diffRemovedBg": "#1a0a0a",
    "diffContextBg": "darkBg1",
    "diffLineNumber": "grayMid",
    "diffAddedLineNumberBg": "#0a1a0a",
    "diffRemovedLineNumberBg": "#1a0a0a",
    "markdownText": "grayBright",
    "markdownHeading": "neonPink",
    "markdownLink": "neonCyan",
    "markdownLinkText": "neonGreen",
    "markdownCode": "neonYellow",
    "markdownBlockQuote": "grayMid",
    "markdownEmph": "neonOrange",
    "markdownStrong": "neonPink",
    "markdownHorizontalRule": "darkBg3",
    "markdownListItem": "neonCyan",
    "markdownListEnumeration": "neonPink",
    "markdownImage": "neonCyan",
    "markdownImageText": "neonGreen",
    "markdownCodeBlock": "white",
    "syntaxComment": "grayMid",
    "syntaxKeyword": "neonPink",
    "syntaxFunction": "neonCyan",
    "syntaxVariable": "neonGreen",
    "syntaxString": "neonYellow",
    "syntaxNumber": "neonPurple",
    "syntaxType": "neonOrange",
    "syntaxOperator": "neonCyan",
    "syntaxPunctuation": "grayLight"
  }
}, null, 2)

const SOUND_GENERATORS: Record<string, string> = {
  "idle.m4a": [
    "-y -f lavfi -i sine=frequency=350:duration=0.12",
    "-f lavfi -i sine=frequency=250:duration=0.1",
    "-f lavfi -i sine=frequency=500:duration=0.15",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=100|100,volume=2.5[b];[2:a]adelay=180|180,volume=2.0[c];[a][b][c]amix=inputs=3:duration=longest,volume=4.0,lowpass=f=1500,aecho=0.6:0.4:30:0.3,bass=g=6" -t 0.5`
  ].join(" "),
  "error.m4a": [
    "-y -f lavfi -i sine=frequency=200:duration=0.2",
    "-f lavfi -i sine=frequency=150:duration=0.2",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=180|180,volume=2.5[b];[a][b]amix=inputs=2:duration=longest,volume=4.0,lowpass=f=600" -t 0.5`
  ].join(" "),
  "compact.m4a": [
    "-y -f lavfi -i sine=frequency=400:duration=0.1",
    "-f lavfi -i sine=frequency=300:duration=0.1",
    "-f lavfi -i sine=frequency=200:duration=0.15",
    "-f lavfi -i sine=frequency=350:duration=0.15",
    `-filter_complex "[0:a]adelay=0|0,volume=1.5[a];[1:a]adelay=80|80,volume=1.8[b];[2:a]adelay=160|160,volume=2.0[c];[3:a]adelay=260|260,volume=1.5[d];[a][b][c][d]amix=inputs=4:duration=longest,volume=3.0,lowpass=f=1200,aecho=0.5:0.4:25:0.2" -t 0.6`
  ].join(" "),
  "permission.m4a": [
    "-y -f lavfi -i sine=frequency=700:duration=0.06",
    "-f lavfi -i sine=frequency=900:duration=0.06",
    "-f lavfi -i sine=frequency=500:duration=0.1",
    `-filter_complex "[0:a]adelay=0|0,volume=2.0[a];[1:a]adelay=50|50,volume=2.0[b];[2:a]adelay=100|100,volume=2.0[c];[a][b][c]amix=inputs=3:duration=longest,volume=3.5,lowpass=f=2000" -t 0.3`
  ].join(" "),
}

let installed = false

function ensureFile(path: string, content: string) {
  if (existsSync(path)) return false
  writeFileSync(path, content)
  return true
}

function installSddAssets() {
  mkdirSync(COMMANDS, { recursive: true })
  mkdirSync(PROMPTS, { recursive: true })
  mkdirSync(join(SKILLS, "sdd-review"), { recursive: true })
  mkdirSync(join(SKILLS, "sdd-claude-review"), { recursive: true })

  const changed = [
    ensureFile(join(COMMANDS, "sdd-review.md"), SDD_REVIEW_COMMAND),
    ensureFile(join(COMMANDS, "sdd-claude-review.md"), SDD_CLAUDE_REVIEW_COMMAND),
    ensureFile(join(PROMPTS, "sdd-review.md"), SDD_REVIEW_PROMPT),
    ensureFile(join(PROMPTS, "sdd-claude-review.md"), SDD_CLAUDE_REVIEW_PROMPT),
    ensureFile(join(SKILLS, "sdd-review", "SKILL.md"), SDD_REVIEW_SKILL),
    ensureFile(join(SKILLS, "sdd-claude-review", "SKILL.md"), SDD_CLAUDE_REVIEW_SKILL),
  ].some(Boolean)

  if (changed) {
    logInstallNotice("\x1b[38;5;45m>> SDD REVIEW PHASES INSTALLED // restart opencode to load agents\x1b[0m")
    return
  }

  logInstallNotice("\x1b[38;5;39m>> SDD REVIEW PHASES DETECTED // sdd-review + sdd-claude-review already installed\x1b[0m")
}

function patchSddContinueCommand() {
  const path = join(COMMANDS, "sdd-continue.md")
  if (!existsSync(path)) return

  const current = readFileSync(path, "utf8")
  if (current.includes("apply → review → verify → archive")) return

  const next = current.replace(
    "proposal → [specs ∥ design] → tasks → apply → verify → archive",
    "proposal → [specs ∥ design] → tasks → apply → review → verify → archive",
  )

  if (next !== current) {
    writeFileSync(path, next)
    logInstallNotice("\x1b[38;5;45m>> SDD FLOW PATCHED // apply -> review -> verify\x1b[0m")
  }
}

function patchOpencodeConfig() {
  if (!existsSync(OPENCODE_JSON)) return

  const current = readFileSync(OPENCODE_JSON, "utf8")
  const data = JSON.parse(current)
  const agents = data.agent ?? {}
  let changed = false

  for (const [name, desired] of Object.entries(SDD_MANAGED_AGENTS)) {
    const existing = agents[name]
    if (!existing) {
      agents[name] = desired
      changed = true
      continue
    }

    const merged = {
      ...existing,
      ...desired,
      model: existing.model ?? desired.model,
    }

    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      agents[name] = merged
      changed = true
    }
  }

  if (changed) {
    data.agent = agents
    writeFileSync(OPENCODE_JSON, JSON.stringify(data, null, 2) + "\n")
    logInstallNotice("\x1b[38;5;45m>> AGENTS PATCHED // sdd-review + sdd-claude-review registered\x1b[0m")
  }
}

async function install($: any) {
  if (installed) return
  installed = true

  mkdirSync(THEMES, { recursive: true })
  mkdirSync(SOUNDS, { recursive: true })

  const themePath = join(THEMES, "cyberpunk.json")
  if (!existsSync(themePath)) {
    writeFileSync(themePath, CYBERPUNK_THEME)
    logInstallNotice("\x1b[38;5;201m>> CYBERPUNK THEME INSTALLED // Reboot to apply\x1b[0m")
  }

  const tuiPath = join(CONFIG, "tui.json")
  if (existsSync(tuiPath)) {
    const tui = JSON.parse(await Bun.file(tuiPath).text())
    if (tui.theme !== "cyberpunk") {
      tui.theme = "cyberpunk"
      writeFileSync(tuiPath, JSON.stringify(tui, null, 2))
      logInstallNotice("\x1b[38;5;45m>> THEME ACTIVATED // cyberpunk\x1b[0m")
    }
  } else {
    writeFileSync(tuiPath, JSON.stringify({ "$schema": "https://opencode.ai/tui.json", theme: "cyberpunk" }, null, 2))
  }

  for (const [file, args] of Object.entries(SOUND_GENERATORS)) {
    await ensureSound($, file, args)
  }

  installSddAssets()
  patchSddContinueCommand()
  patchOpencodeConfig()
}

async function playSound($: any, file: string) {
  const path = join(SOUNDS, file)
  if (!existsSync(path)) return
  if (IS_MAC) {
    await $`afplay ${path}`.nothrow()
  } else {
    await $`ffplay -nodisp -autoexit -v quiet ${path}`.nothrow()
  }
}

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  await install($)

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        try { await playSound($, "idle.m4a") } catch {}
      }

      if (event.type === "session.error") {
        try { await playSound($, "error.m4a") } catch {}
      }

      if (event.type === "session.compacted") {
        try { await playSound($, "compact.m4a") } catch {}
      }

      if (event.type === "permission.asked") {
        try { await playSound($, "permission.m4a") } catch {}
      }
    },
  }
}
