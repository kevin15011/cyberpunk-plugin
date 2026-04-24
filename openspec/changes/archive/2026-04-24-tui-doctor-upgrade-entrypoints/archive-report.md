# Archive Report: TUI Doctor Upgrade Entrypoints

## Change Closure

- **Change**: `tui-doctor-upgrade-entrypoints`
- **Archived to**: `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/`
- **Status**: Completed and archived
- **Verifier verdict**: PASS WITH WARNINGS
- **Critical issues**: None

## Spec Sync

### Domain: `cyberpunk-tui`

- **Action**: Updated existing `openspec/specs/cyberpunk-tui/spec.md`
- **Changes applied**:
  - Added: `2`
    - `Doctor Workflow in TUI`
    - `Direct Doctor and Upgrade CLI Behavior`
  - Modified: `2`
    - `Interactive TUI Launch` (added doctor/upgrade navigation)
    - `Task Progress and Result Navigation` (included upgrade flow and scenario)
  - Removed: `0`

## Artifact Lineage

### Files in active change folder before archive

- `proposal.md` ✅
- `specs/cyberpunk-tui/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅
- `verify-report.md` ✅
- `exploration.md` (optional)

### Archived folder contains

- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/archive-report.md` (this report)
- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/proposal.md`
- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/specs/cyberpunk-tui/spec.md`
- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/design.md`
- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/tasks.md`
- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/verify-report.md`
- `openspec/changes/archive/2026-04-24-tui-doctor-upgrade-entrypoints/exploration.md`

## Engram Artifact IDs (hybrid lineage)

- proposal: `#849`
- spec: `#852`
- design: `#854`
- tasks: `#856`
- apply-progress: `#857`
- verify-report: `#858`

## Verification Snapshot

- Tasks complete: `21 / 21`
- Verification: `PASS WITH WARNINGS`
- Warning notes: Task runtime-loop coverage remains low in raw-mode; treated as non-blocking.
- Readiness: Ready for next phase (SDD cycle completion).

## Integrity Checks

- Main spec updated successfully.
- Active changes directory no longer contains `tui-doctor-upgrade-entrypoints`.
- Source-of-truth requirements remain preserved and only specified additions/modifications were applied.
