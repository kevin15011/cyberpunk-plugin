# Tasks: sdd-ctx-stats

## Overview

Add idempotent marker-based Section E patching to `plugin.ts` so the cyberpunk plugin injects `ctx_stats` directives into `sdd-phase-common.md` during `install()`.

**File changed**: `src/components/plugin.ts` (~+80 lines)

---

## Task 1: Define `SECTION_E_TEMPLATE` Constant

**Deliverable**: A `const SECTION_E_TEMPLATE` string declared at module scope in `plugin.ts`, containing the exact markdown to inject (heading, instruction, rationale, format block, silent-fallback note).

**Location**: After existing constants, before `PLUGIN_SOURCE`.

**Content** (matches design.md §Decision 3):

```typescript
const SECTION_E_TEMPLATE = `
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
```

---

## Task 2: Define `START_MARKER` and `END_MARKER` Constants

**Deliverable**: Two constants declared alongside `SECTION_E_TEMPLATE`:

```typescript
const START_MARKER = "<!-- cyberpunk:start:sdd-ctx-stats -->"
const END_MARKER   = "<!-- cyberpunk:end:sdd-ctx-stats -->"
```

**Rule**: `START_MARKER` and `END_MARKER` are used both by the patching function and embedded in `PLUGIN_SOURCE` so the installed plugin can re-apply patching on re-install.

---

## Task 3: Add `extractBetweenMarkers()` Helper

**Deliverable**: A pure utility function in `plugin.ts` (outside `PLUGIN_SOURCE`):

```typescript
function extractBetweenMarkers(
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
```

**Location**: Before `getPluginComponent()`, at module scope.

**Tests required**: See Task 6.

---

## Task 4: Add `patchSddPhaseCommon()` Function

**Deliverable**: A function declared at module scope in `plugin.ts` that implements the three-way patching logic from design.md §Decision 4:

```typescript
function patchSddPhaseCommon(): boolean {
  const SDD_PHASE_COMMON_PATH = join(HOME, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")

  // Guard: file doesn't exist — skip silently
  if (!existsSync(SDD_PHASE_COMMON_PATH)) return false

  const content = readFileSync(SDD_PHASE_COMMON_PATH, "utf8")

  // State 1: No markers → heading detection or append
  if (!content.includes(START_MARKER)) {
    const headingIndex = content.indexOf("\n## E.")
    const markedSection = `\n${START_MARKER}\n${SECTION_E_TEMPLATE}\n${END_MARKER}\n`
    const newContent = headingIndex !== -1
      ? content.slice(0, headingIndex) + markedSection
      : content.trimEnd() + "\n\n" + markedSection
    writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
    return true
  }

  // State 2: Markers present, content matches → no-op
  const extracted = extractBetweenMarkers(content, START_MARKER, END_MARKER)
  if (!extracted) return false
  if (extracted.managed === SECTION_E_TEMPLATE) return false

  // State 3: Markers present, content mismatched → replace
  const newContent =
    extracted.before +
    START_MARKER + "\n" + SECTION_E_TEMPLATE + "\n" +
    END_MARKER +
    extracted.after
  writeFileSync(SDD_PHASE_COMMON_PATH, newContent, "utf8")
  return true
}
```

**Location**: After `extractBetweenMarkers()`, before `getPluginComponent()`.

---

## Task 5: Call `patchSddPhaseCommon()` from `install()`

**Deliverable**: Modify the `install()` function in `getPluginComponent()` to call `patchSddPhaseCommon()` after writing the plugin file and updating config. Use the return value to set `InstallResult.message`:

```typescript
const patched = patchSddPhaseCommon()
return {
  component: "plugin",
  action: "install",
  status: existingPluginMatch ? "skipped" : "success",
  message: patched
    ? "Plugin instalado, Section E (ctx_stats) inyectada"
    : existingPluginMatch ? "Plugin ya instalado y actualizado" : undefined,
  path: TARGET_PATH,
}
```

**Note**: The `existingPluginMatch` branch already returns a `skipped` result — the ternary above only enriches `message`. The `message: undefined` for the non-patched success case is acceptable (orchestrator can fall back to a default).

---

## Task 6: Add Unit Tests for Helper Functions

**Deliverable**: A test file `src/components/plugin.patch.test.ts` (or alongside existing test file) with the following cases:

### `extractBetweenMarkers` tests

| Input | Expected |
|-------|----------|
| Content with matching markers | `{ before, managed, after }` with correct slices |
| Content with only start marker | `null` |
| Content with only end marker | `null` |
| Content with no markers | `null` |
| Empty string | `null` |

### `patchSddPhaseCommon` tests

Use `vi.mock("fs")` / `jest.mock("fs")` with `readFileSync`/`writeFileSync` mocks. Test all three states:

1. **Fresh install**: File exists with no markers → file written, returns `true`
2. **No-op**: File with matching marked section → file unchanged, returns `false`
3. **Mismatch**: File with mismatched marked section → file written, returns `true`
4. **Missing file**: `sdd-phase-common.md` absent → returns `false`, no error

**Framework**: Vitest (project standard — verify by checking `package.json` devDependencies).

---

## Task 7: Update `PLUGIN_SOURCE` String with Patching Code

**Deliverable**: The `PLUGIN_SOURCE` template literal is updated to include the patching helpers (`extractBetweenMarkers`, `patchSddPhaseCommon`) and calls `patchSddPhaseCommon()` from the plugin's own `install()` hook.

**Changes to `PLUGIN_SOURCE`**:

1. Add `START_MARKER`, `END_MARKER`, and `SECTION_E_TEMPLATE` constants inside the plugin source (same values as module-level constants).
2. Add `extractBetweenMarkers()` function inside the plugin source.
3. Add `patchSddPhaseCommon()` function inside the plugin source.
4. In the plugin's `install()` hook (the exported `CyberpunkPlugin` async function — **not** the component's `install()`), call `patchSddPhaseCommon()` and log the result.

**Critical**: The `PLUGIN_SOURCE` string is what gets written to `~/.config/opencode/plugins/cyberpunk.ts` and runs at runtime. It must be self-contained — no imports from `plugin.ts` module scope.

**Resulting `PLUGIN_SOURCE` structure**:

```
// cyberpunk.ts — runtime plugin (installed by cyberpunk CLI)
import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

const HOME = ...
const SDD_PHASE_COMMON_PATH = join(HOME, ".config/opencode/skills/_shared/sdd-phase-common.md")
const START_MARKER = "<!-- cyberpunk:start:sdd-ctx-stats -->"
const END_MARKER   = "<!-- cyberpunk:end:sdd-ctx-stats -->"
const SECTION_E_TEMPLATE = `...` (trimmed)

function extractBetweenMarkers(...) { ... }
function patchSddPhaseCommon(): boolean { ... }

export const CyberpunkPlugin: Plugin = async ({ $ }) => {
  // Existing sound event handlers...

  return {
    event: async ({ event }) => { ... },

    // The installed plugin has no install() hook by design (Plugin interface only has event).
    // Patching runs at install time from the component's install(), not here.
  }
}
```

**Note**: The Plugin interface from `@opencode-ai/plugin` only exposes an `event` handler — it has no `install()` hook. Therefore `patchSddPhaseCommon()` is called from the **component's** `install()` function (Task 5), and `PLUGIN_SOURCE` is updated to include the helper constants/functions for completeness (so re-installs can re-patch), but the plugin's runtime `event` handler does not change.

**Validation**: After updating `PLUGIN_SOURCE`, confirm the template literal still produces valid TypeScript when written to disk (no unescaped template literal `${` that would conflict with template interpolation).

---

## Checklist

- [x] `SECTION_E_TEMPLATE` constant declared (Task 1)
- [x] `START_MARKER` and `END_MARKER` constants declared (Task 2)
- [x] `extractBetweenMarkers()` helper added (Task 3)
- [x] `patchSddPhaseCommon()` function added (Task 4)
- [x] `patchSddPhaseCommon()` called from `install()` with message enrichment (Task 5)
- [x] Unit tests added for helpers (Task 6)
- [x] `PLUGIN_SOURCE` updated with constants and helpers (Task 7)
- [x] All new code passes `tsc --noEmit`
- [x] All new tests pass (`bun test`)
