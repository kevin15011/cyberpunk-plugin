# Delta for SDD Context Stats

## MODIFIED Requirements

### Requirement: SDD Integration Patches sdd-phase-common.md with Section E

During `install()`, the `sdd-integration` component SHALL read `~/.config/opencode/skills/_shared/sdd-phase-common.md`, check for cyberpunk markers wrapping Section E, and inject or replace the section if missing or mismatched. The section MUST be wrapped in `<!-- cyberpunk:start:section-e -->` / `<!-- cyberpunk:end:section-e -->` marker comments. The `opencode-event-sounds` component MUST NOT perform this patching.

(Previously: The `plugin` component performed Section E patching during its install.)

#### Scenario: Fresh install — Section E missing

- GIVEN `sdd-phase-common.md` has no cyberpunk marker for Section E
- WHEN `sdd-integration` install runs
- THEN Section E content is inserted wrapped in cyberpunk markers
- AND the file is written to disk

#### Scenario: Section E already present and identical

- GIVEN `sdd-phase-common.md` contains Section E wrapped in cyberpunk markers
- AND the content matches the template exactly
- WHEN `sdd-integration` install runs
- THEN the file is NOT modified

#### Scenario: Section E present but mismatched

- GIVEN `sdd-phase-common.md` contains Section E wrapped in cyberpunk markers
- AND the content differs from the template
- WHEN `sdd-integration` install runs
- THEN the marked region is replaced with the current template
- AND the file is written to disk

### Requirement: Marker-Based Idempotent Patching

The `sdd-integration` component MUST use start/end comment markers to identify the managed region. Only content between the markers MAY be modified. Content outside the markers MUST NOT be altered.

(Previously: Same behavior but owned by `plugin` component.)

#### Scenario: Markers exist but surrounding content changed

- GIVEN `sdd-phase-common.md` has cyberpunk markers for Section E
- AND other sections were modified by an upstream update
- WHEN `sdd-integration` install runs
- THEN only the content between the markers is checked and replaced if needed
- AND all other content remains unchanged

## REMOVED Requirements

### Requirement: Plugin Patches sdd-phase-common.md with Section E

(Reason: Patching ownership transferred to the new `sdd-integration` component.)
