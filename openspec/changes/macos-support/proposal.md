# Proposal: macOS Support

## Intent

Ship first-class macOS binary installation without changing the repo’s distribution model. The same **binary file** cannot be reused because Linux releases are ELF and macOS requires Mach-O, but the same **source**, naming convention, and release URL pattern can be reused.

## Scope

### In Scope
- Add `darwin-arm64` and `darwin-x64` release assets from existing Linux CI via Bun cross-compilation.
- Update `install.sh` to allow macOS downloads from the existing `releases/latest/download/cyberpunk-{os}-{arch}` pattern.
- Update README install docs and requirements to advertise macOS binary support and macOS ffmpeg guidance.

### Out of Scope
- Code signing / notarization / Gatekeeper removal.
- macOS-native CI runners or end-to-end runtime validation on macOS.
- Windows support or installer UX redesign.

## Capabilities

### New Capabilities
- `binary-distribution`: Release asset production and curl-based binary bootstrap across supported OS/arch targets.

### Modified Capabilities
- `cyberpunk-upgrade`: Clarify binary-upgrade behavior for darwin asset selection and parity with Linux asset naming.

## Approach

Use the current GitHub Releases contract and add two CI jobs targeting `bun-darwin-arm64` and `bun-darwin-x64`. Keep asset names as `cyberpunk-{os}-{arch}` so both `install.sh` and upgrade logic reuse the same URL structure. MVP ships unsigned binaries; signing is deferred.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/workflows/release.yml` | Modified | Add macOS build/publish jobs |
| `install.sh` | Modified | Permit darwin downloads; keep current URL contract |
| `README.md` | Modified | Document macOS binary install + ffmpeg note |
| `src/commands/upgrade.ts` | Modified | Spec/test parity for darwin asset selection |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unsigned macOS binaries trigger Gatekeeper warnings | High | Document workaround; defer signing follow-up |
| Cross-compiled binaries differ from runtime expectations | Medium | Verify artifact naming and smoke-test manually before release |

## Rollback Plan

Remove darwin assets from release workflow, restore README/source-build guidance, and revert `install.sh` macOS path if smoke testing fails.

## Dependencies

- Bun cross-compilation targets for `bun-darwin-arm64` and `bun-darwin-x64`
- GitHub Releases as the single distribution channel

## Success Criteria

- [ ] Release workflow publishes `cyberpunk-darwin-arm64` and `cyberpunk-darwin-x64` assets.
- [ ] macOS install script reuses the existing release URL pattern successfully.
- [ ] Proposal scope stays MVP-only: binary distribution now, signing/testing infrastructure later.
