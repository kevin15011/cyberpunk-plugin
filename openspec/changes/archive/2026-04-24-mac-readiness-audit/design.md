# Design: macOS Readiness Audit

## Technical Approach

Keep this slice evidence-first, but not audit-only. Reuse the existing binary release/install contract and harden only the macOS paths that would make the audit misleading if left unchanged: binary upgrade integrity, quarantine-safe replacement guidance, and explicit doctor surfacing of mac-specific limitations. Everything else stays documented as deferred work.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Audit scope | Full mac readiness; docs-only audit; audit + minimum hardening | Audit + minimum hardening | Proposal allows smallest blocker fixes; checksum/quarantine gaps are too material to leave unresolved in a “ready” audit. |
| Upgrade verification source | Ad hoc release-page parsing; existing `checksums.txt` contract | Reuse `checksums.txt` | Release workflow already publishes SHA256 data; reusing it avoids a new manifest format. |
| mac diagnostics | Deep system inspection; focused advisory checks | Focused advisory checks in `doctor` | Fits current doctor pattern (`warn`/`fail`, no invasive repair) and keeps scope finishable. |
| Deferred mac work | Fold signing/notarization into this slice; document deferral | Explicitly defer signing, notarization, broader CI, preset redesign | These require external setup or broader product decisions and would blow up the slice. |

## Data Flow

### Audit / hardening flow

User runs `cyberpunk upgrade`
→ `runUpgrade()` dispatches by `installMode`
→ binary mode downloads release asset + `checksums.txt`
→ verify SHA256 match
→ run lightweight smoke check on temp binary (`help`)
→ on macOS attempt quarantine removal / emit fallback guidance
→ atomic replace existing binary
→ persist `lastUpgradeCheck`

### Doctor reporting flow

`cyberpunk doctor`
→ existing platform checks
→ macOS-only readiness checks when `detectEnvironment() === "darwin"`
→ report advisory findings for unsigned binary / missing `xattr` capability / upgrade fallback guidance
→ no auto-fix beyond current safe repair model

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/commands/upgrade.ts` | Modify | Add checksum fetch/parse, temp-binary smoke verification, mac quarantine handling, and failure-safe cleanup before rename. |
| `src/commands/doctor.ts` | Modify | Add darwin-only readiness checks to the platform section without changing non-mac behavior. |
| `src/components/platform.ts` | Modify | Add small mac helper probes (`xattr`, optional codesign visibility) for doctor input. |
| `README.md` | Modify | Publish audited mac support statement, hardening behavior, and explicit deferrals/limitations. |
| `openspec/changes/mac-readiness-audit/design.md` | Create | Records design and scope boundaries for this slice. |
| `tests/upgrade-mode.test.ts` | Modify | Cover checksum mismatch, smoke-test rejection, darwin quarantine branch, and cleanup behavior. |
| `tests/doctor.test.ts` / `tests/doctor-scenarios.test.ts` | Modify | Cover darwin-only readiness reporting and non-darwin no-op behavior. |
| `tests/readme-release-install.test.ts` | Modify | Lock the audited mac docs and deferred-limitations language. |

## Interfaces / Contracts

```text
GET /releases/download/{tag}/{asset}
GET /releases/download/{tag}/checksums.txt

checksums.txt line format:
<sha256><space><space>cyberpunk-darwin-arm64
```

```ts
type BinaryVerification = {
  expectedSha256: string
  actualSha256: string
  smokeOk: boolean
  quarantineAttempted: boolean
}
```

No config schema or CLI flag changes are planned.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Checksum parsing, hash compare, smoke-check decisioning | Extend `bun:test` coverage in `tests/upgrade-mode.test.ts` with fetch and exec doubles. |
| Integration | mac binary upgrade safety | Temp HOME/bin fixture verifies `.tmp` handling, no replace on checksum/smoke failure, config preserved. |
| Integration | Doctor darwin reporting | Mock platform detection/tools to verify mac checks appear only on darwin and remain advisory. |
| Docs | Audited support statement | Update README assertions so mac limitations and deferrals stay explicit. |

## Migration / Rollout

No migration required. Roll out in the next binary release; the audit result should describe the supported mac path as: released darwin binaries + verified upgrade integrity + documented unsigned-binary limitations.

## Open Questions

- [ ] Should unsigned-binary reporting in `doctor` be `warn` or `fail` for macOS readiness messaging?
- [ ] Should smoke verification use only `help`, or `help` plus a temp-HOME `config` probe like release CI?
