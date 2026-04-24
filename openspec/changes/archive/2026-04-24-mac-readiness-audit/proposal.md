# Proposal: macOS Readiness Audit

## Intent

Verify real macOS readiness across install, upgrade, doctor, docs, and release paths, then close only the highest-risk gaps needed for a credible audit. Keep this slice focused on evidence and minimum hardening, not full macOS distribution polish.

## Scope

### In Scope
- Audit current macOS support end-to-end and document the supported path, gaps, and severity.
- Add minimum hardening for the binary upgrade path where missing verification would make the audit misleading.
- Update user/operator docs to reflect audited behavior, known limitations, and deferred work.

### Out of Scope
- Code signing, notarization, Gatekeeper elimination, or Apple Developer account setup.
- Broad macOS UX polish, new distribution channels, or full darwin integration test expansion.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cyberpunk-upgrade`: binary upgrades may need checksum, smoke-test, and quarantine-safe handling before replace.
- `doctor`: macOS readiness diagnostics may need explicit platform-specific checks/reporting.

## Approach

Use the exploration as the baseline audit. Confirm actual current behavior, record a prioritized readiness report, and implement only the smallest fixes required to ensure the audit reflects reality—primarily around upgrade integrity/safety and mac-specific diagnostics if those are confirmed blockers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/mac-readiness-audit/` | New | Proposal, follow-on specs, and audit artifacts |
| `src/commands/upgrade.ts` | Modified | Minimum binary-upgrade hardening if required |
| `src/commands/doctor.ts` | Modified | macOS-specific readiness checks/reporting if required |
| `README.md` / `install.sh` | Modified | Audited macOS guidance and limitation disclosure |
| `.github/workflows/release.yml` | Reviewed | Audit evidence source; deeper changes deferred |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope expands into full mac packaging work | Med | Enforce explicit deferrals for signing/notarization/distribution |
| Audit uncovers more breakage than expected | Med | Limit fixes to release-blocking verification gaps |

## Rollback Plan

Revert any audit-driven code/doc changes, restore prior upgrade/doctor behavior, and keep the audit report as the record of unresolved macOS gaps.

## Dependencies

- Existing exploration at `openspec/changes/mac-readiness-audit/exploration.md`
- Current mac release pipeline and darwin binaries as audit evidence

## Success Criteria

- [ ] macOS support status is documented with clear supported flow, blockers, and explicit deferrals.
- [ ] Any in-scope blocker fix is limited to the minimum hardening needed to make the audit trustworthy.
- [ ] Signing/notarization and broader distribution work remain explicitly deferred.
