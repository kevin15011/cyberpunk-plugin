## Change Archived

**Change**: wsl-mac-presets
**Archived to**: `openspec/changes/archive/2026-04-23-wsl-mac-presets/`

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `cyberpunk-install` | Updated | 0 added, 1 modified, 0 removed requirements |
| `cyberpunk-tui` | Updated | 0 added, 2 modified, 0 removed requirements |

### Archive Contents

- proposal.md ✅
- specs/cyberpunk-install/spec.md ✅
- specs/cyberpunk-tui/spec.md ✅
- design.md ✅
- tasks.md ✅ (8/9 complete)
- verify-report.md ✅
- exploration.md ✅

### Source of Truth Updated

- `openspec/specs/cyberpunk-install/spec.md`
- `openspec/specs/cyberpunk-tui/spec.md`

### Verification Outcome

- Verification Artifact: `engram://sdd/wsl-mac-presets/verify-report` (`#675`)
- Verdict: PASS WITH WARNINGS
- Change-specific status: all 6 spec scenarios have runtime evidence; TDD criteria are sufficient for this slice.

### Artifact Traceability

- Proposal: `#650`
- Spec: `#655`
- Design: `#658`
- Tasks: `#661`
- Verify-report: `#675`

### Notes

- The unresolved task (`4.4`) in this change’s tasks artifact is a full-test-suite execution goal and remains uncompleted.
- Repository-wide failures remain outside this change scope (19 failing tests in unrelated suites).

### Decision

Archive completed. Final state aligns with updated main specs and moved this change to the archive.
