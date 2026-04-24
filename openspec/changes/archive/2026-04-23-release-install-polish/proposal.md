# Proposal: Release Install Polish

## Intent

Reduce first-run friction in the existing binary install and release flow without changing distribution strategy. Focus on additive fixes that help users complete install successfully and help maintainers catch broken release assets before publish.

## Scope

### In Scope
- Add shell-aware PATH help in `install.sh`, including restart guidance and a concise verification summary.
- Add clearer ffmpeg messaging, macOS quarantine removal, and post-install verification guidance in `install.sh`.
- Add release workflow smoke tests and SHA256 checksum generation in `.github/workflows/release.yml`.

### Out of Scope
- Binary signing, notarization, or Apple certificate management.
- New packaging/distribution channels (Homebrew, npm, apt, etc.).
- Broad install flow redesign or interactive packaging changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cyberpunk-install`: installer guidance and post-install verification behavior become more explicit for PATH, ffmpeg, and macOS first-run handling.
- `cyberpunk-upgrade`: release asset production gains smoke-test and checksum expectations for binary delivery reliability.

## Approach

Keep changes additive and localized. Extend `install.sh` to improve first-run messaging and macOS handling, then harden release CI with lightweight startup validation and published checksums. Reuse existing CLI verification surfaces instead of introducing new packaging logic.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `install.sh` | Modified | PATH help, ffmpeg messaging, quarantine removal, verification summary |
| `.github/workflows/release.yml` | Modified | smoke tests and checksum artifacts |
| `README.md` | Modified | document updated install/release behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PATH profile edits are incorrect | Low | shell-aware targeting, confirm before append, avoid duplicate lines |
| macOS quarantine command unavailable | Low | guard with `command -v xattr` and continue with guidance |
| CI smoke tests become flaky | Low | use startup/help-level checks only |

## Rollback Plan

Revert `install.sh`, workflow, and README changes; release behavior falls back to current manual guidance and unsigned asset flow.

## Dependencies

- Existing GitHub Actions release pipeline
- Platform tools already expected by target environments (`xattr`, `sha256sum`/equivalent)

## Success Criteria

- [ ] Binary install on macOS provides actionable first-run guidance and attempts quarantine removal automatically.
- [ ] Binary install clearly explains PATH and ffmpeg follow-up steps and ends with a verification-oriented summary.
- [ ] Release CI validates produced binaries can start and publishes checksums with release assets.
