# Technical Design: sdd-ctx-stats

## Goal

Make every SDD phase sub-agent call `ctx_stats` automatically before returning, by injecting a managed Section E directive into `sdd-phase-common.md` during `cyberpunk install --plugin`.

## Architecture Overview

The change extends the existing **plugin component** (`src/components/plugin.ts`) to patch a second target file (`sdd-phase-common.md`) using a marker-based idempotent pattern adapted from `context-mode.ts`. The patching runs inside the plugin's existing `install()` function — no new component is needed.

```
install() runs
  ├─ 1. Write runtime plugin to ~/.config/opencode/plugins/cyberpunk.ts  (existing)
  └─ 2. Patch sdd-phase-common.md with Section E                         (NEW)
         └─ patchSddPhaseCommon()
              ├─ no markers → locate heading "## E." → replace with marked section (or append if no heading)
              ├─ markers + match → skip (no-op)
              └─ markers + mismatch → replace marked region
```

## Decision 1: Patching Lives in plugin.ts, Not a New Component

**Why**: The Section E directive is a behavioral extension of the cyberpunk plugin itself — not a standalone concern like sounds or theme. Adding a new component (e.g. `sdd-patch`) would require changes to `ComponentId`, `schema.ts`, `install.ts`, and the CLI parser. This is a single well-scoped patch that belongs alongside the plugin that makes SDD agents work differently.

**Trade-off**: The `plugin.ts` file grows by ~80 lines. Acceptable because the patching logic is self-contained in one helper function with its own constant.

## Decision 2: Start/End Markers for In-File Patching

Unlike `context-mode.ts` which **replaces an entire file** (single marker suffices), this change patches **a section inside a shared file** that Gentle AI may update. We need start/end delimiters to precisely scope the managed region.

```
<!-- cyberpunk:start:sdd-ctx-stats -->
... managed Section E content ...
<!-- cyberpunk:end:sdd-ctx-stats -->
```

**Why two markers**: Content outside the markers (Sections A–D) is owned by Gentle AI and must never be touched. A single marker can't define both boundaries.

## Decision 3: Section E Template Content

The exact markdown to inject:

```markdown
## E. Session Stats — Always Report at the End

Before returning to the orchestrator, call `ctx_stats` and include the result in your `detailed_report` or as a separate line in the envelope.

\`\`\`
ctx_stats
\`\`\`

**Why**: Every SDD phase processes files, runs commands, and indexes content. Reporting the session savings makes the token cost visible and encourages consistent use of `ctx_*` tools.

**Format**: Add this at the end of your return:

\`\`\`
-- Session Stats --
$ ctx_stats output here
\`\`\`

If `ctx_stats` is unavailable (e.g., not installed), skip silently.
```

This matches the Section E content currently in `sdd-phase-common.md` (lines 92–109), ensuring a seamless transition when markers are added.

## Decision 4: Three-Way Patching Logic

The `patchSddPhaseCommon()` function handles three states:

### State 1: Fresh install — No markers, heading may or may not exist

```typescript
// Pseudocode
const content = readFile(SDD_PHASE_COMMON_PATH)

if (!content.includes(START_MARKER)) {
  // Look for existing "## E." heading
  const headingIndex = content.indexOf("\n## E.")
  if (headingIndex !== -1) {
    // Replace from heading to EOF with marked section
    newContent = content.slice(0, headingIndex) + "\n" + MARKED_SECTION_E + "\n"
  } else {
    // Append at end
    newContent = content.trimEnd() + "\n\n" + MARKED_SECTION_E + "\n"
  }
  writeFile(SDD_PHASE_COMMON_PATH, newContent)
}
```

**Why heading detection**: The current `sdd-phase-common.md` already has Section E without markers (manually placed). On first plugin install with this feature, we replace the unmanaged section with our managed version rather than duplicating it.

### State 2: Markers present, content matches — No-op

```typescript
// Extract content between markers
const betweenMarkers = extractMarkedContent(content)
if (betweenMarkers === SECTION_E_TEMPLATE) {
  return // no-op, file unchanged
}
```

### State 3: Markers present, content mismatched — Replace marked region

```typescript
// This handles Gentle AI updates that modified our section
const before = content.slice(0, startIndex)
const after = content.slice(endIndex + END_MARKER.length)
const newContent = before + START_MARKER + "\n" + SECTION_E_TEMPLATE + "\n" + END_MARKER + after
writeFile(SDD_PHASE_COMMON_PATH, newContent)
```

## Decision 5: Marker Extraction Helper

A shared helper `extractBetweenMarkers(content, startMarker, endMarker)` returns `{ before, managed, after }` or `null` if markers aren't found. This keeps the patching logic clean and testable.

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
    before: content.slice(0, startIdx),
    managed: content.slice(afterStart, endIdx),
    after: content.slice(endIdx + endMarker.length),
  }
}
```

## Decision 6: File Path Resolution

```typescript
const SDD_PHASE_COMMON_PATH = join(HOME, ".config", "opencode", "skills", "_shared", "sdd-phase-common.md")
```

**Guard**: If the file doesn't exist at all (Gentle AI not installed), skip silently rather than error. The Section E directive is only useful when SDD phases are actually running.

## Decision 7: Return Value from install()

The `patchSddPhaseCommon()` function returns a boolean (`true` if file was written, `false` if skipped). The plugin's `install()` uses this to enrich its `InstallResult.message`:

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

## Decision 8: No Uninstall Cleanup

The plugin's `uninstall()` does **not** remove Section E. Rationale:

- Removing markers would leave the file with Section E content but no managed region — confusing state
- Removing the entire section breaks agents that came to rely on it
- The section is harmless — it just asks agents to call `ctx_stats`, which degrades gracefully if unavailable
- Re-running `install()` re-applies the correct version anyway

## What the Agent Sees

After installation, any SDD phase agent loading `sdd-phase-common.md` sees:

```markdown
... Sections A–D (unchanged) ...

<!-- cyberpunk:start:sdd-ctx-stats -->
## E. Session Stats — Always Report at the End

Before returning to the orchestrator, call `ctx_stats` and include the result
in your `detailed_report` or as a separate line in the envelope.

`ctx_stats`

**Why**: Every SDD phase processes files, runs commands, and indexes content.
Reporting the session savings makes the token cost visible and encourages
consistent use of `ctx_*` tools.

**Format**: Add this at the end of your return:

-- Session Stats --
$ ctx_stats output here

If `ctx_stats` is unavailable (e.g., not installed), skip silently.
<!-- cyberpunk:end:sdd-ctx-stats -->
```

The agent follows Section E as part of the common protocol — no special skill loading required.

## Files Changed

| File | Change |
|------|--------|
| `src/components/plugin.ts` | Add `SECTION_E_TEMPLATE` constant, `START_MARKER`/`END_MARKER` constants, `extractBetweenMarkers()` helper, `patchSddPhaseCommon()` function. Call `patchSddPhaseCommon()` from `install()`. |

## Edge Cases

| Case | Behavior |
|------|----------|
| `sdd-phase-common.md` doesn't exist | Skip silently (return `false`) |
| File exists but has no Section E heading and no markers | Append marked section at end |
| File has Section E heading but no markers | Replace from heading to EOF with marked section |
| File has markers + matching content | No-op |
| File has markers + mismatched content | Replace marked region only |
| Gentle AI updates Sections A–D between markers | Unaffected — only managed region is touched |
| `ctx_stats` not available at runtime | Agent skips silently per Section E instructions |
