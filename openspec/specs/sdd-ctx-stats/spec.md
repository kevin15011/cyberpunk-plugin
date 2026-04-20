# sdd-ctx-stats Specification

## Purpose

Ensures every SDD phase sub-agent reports `ctx_stats` automatically by injecting a Section E directive into the shared `sdd-phase-common.md` file. The cyberpunk plugin manages this section via idempotent marker-based patching during `install()`.

## Requirements

### Requirement: Plugin Patches sdd-phase-common.md with Section E

During `install()`, the plugin SHALL read `~/.config/opencode/skills/_shared/sdd-phase-common.md`, check for a cyberpunk marker wrapping Section E, and inject or replace the section if missing or mismatched. The section MUST be wrapped in `<!-- cyberpunk:start:section-e -->` / `<!-- cyberpunk:end:section-e -->` marker comments.

#### Scenario: Fresh install — Section E missing

- GIVEN `sdd-phase-common.md` has no cyberpunk marker for Section E
- WHEN `cyberpunk install --plugin` is run
- THEN Section E content is inserted wrapped in cyberpunk markers
- AND the file is written to disk

#### Scenario: Section E already present and identical

- GIVEN `sdd-phase-common.md` contains Section E wrapped in cyberpunk markers
- AND the content matches the plugin's template exactly
- WHEN `cyberpunk install --plugin` is run
- THEN the file is NOT modified

#### Scenario: Section E present but mismatched (Gentle AI update)

- GIVEN `sdd-phase-common.md` contains Section E wrapped in cyberpunk markers
- AND the content differs from the plugin's template
- WHEN `cyberpunk install --plugin` is run
- THEN the marked region is replaced with the current template
- AND the file is written to disk

### Requirement: Marker-Based Idempotent Patching

The plugin MUST use start/end comment markers to identify the managed region. Only content between the markers MAY be modified. Content outside the markers MUST NOT be altered.

#### Scenario: Markers exist but surrounding content changed

- GIVEN `sdd-phase-common.md` has cyberpunk markers for Section E
- AND other sections (A–D) were modified by a Gentle AI update
- WHEN `cyberpunk install --plugin` is run
- THEN only the content between the markers is checked and replaced if needed
- AND all other content remains unchanged

### Requirement: Agent Reads and Follows Section E Directive

When an SDD phase agent loads `sdd-phase-common.md`, it SHALL follow Section E: call `ctx_stats` before returning to the orchestrator and include the output in the return envelope.

#### Scenario: Agent follows Section E and reports ctx_stats

- GIVEN an SDD phase agent has loaded `sdd-phase-common.md` containing Section E
- AND `ctx_stats` is available
- WHEN the agent completes its phase work and prepares its return envelope
- THEN the agent calls `ctx_stats`
- AND includes the output in the envelope under `-- Session Stats --`

#### Scenario: ctx_stats unavailable — agent skips silently

- GIVEN an SDD phase agent has loaded `sdd-phase-common.md` containing Section E
- AND `ctx_stats` is not available (context-mode not installed)
- WHEN the agent completes its phase work
- THEN the agent skips the `ctx_stats` call without error
- AND returns the envelope without session stats

### Requirement: Section E Content Template

Section E SHALL contain: a heading `## E. Session Stats — Always Report at the End`, an instruction to call `ctx_stats`, a rationale, a format example showing `-- Session Stats --`, and a fallback instruction to skip silently if unavailable.

#### Scenario: Injected section matches expected template

- GIVEN the plugin injects Section E into `sdd-phase-common.md`
- WHEN the file is read after injection
- THEN the section contains the heading, `ctx_stats` call instruction, rationale, format block, and silent-fallback note
