# Tasks: macOS Support

## Phase 1: Release Workflow

- [x] 1.1 Modify `.github/workflows/release.yml`: add `build-darwin-x64` job (Bun cross-compile, upload to release as `cyberpunk-darwin-x64`)
- [x] 1.2 Modify `.github/workflows/release.yml`: add `build-darwin-arm64` job (Bun cross-compile, upload to release as `cyberpunk-darwin-arm64`)
- [x] 1.3 Verify jobs follow same `needs: [resolve-tag]` pattern as existing linux jobs and use `allowUpdates: true` for the upload action

## Phase 2: Installer Support

- [x] 2.1 Modify `install.sh`: extend OS detection (`uname -s` → `darwin`) and arch detection (`uname -m` → `x64`/`arm64`) to build darwin asset name
- [x] 2.2 Modify `install.sh`: allow downloads from `releases/latest/download/cyberpunk-darwin-{arch}` (same URL template as linux)
- [x] 2.3 Add ffmpeg guidance output for darwin: print `brew install ffmpeg` note when darwin detected
- [x] 2.4 Keep Alpine special-case for linux only (no changes to linux path)

## Phase 3: Upgrade Logic + Tests

- [x] 3.1 RED: Add test in `tests/upgrade-mode.test.ts` for darwin asset naming regex `/^cyberpunk-(linux|darwin)-(x64|arm64)$/`
- [x] 3.2 RED: Add scenario tests for darwin binary upgrade: `installMode: "binary"` on darwin downloads `cyberpunk-darwin-{arch}` asset from `releases/download/{tag}/`
- [x] 3.3 GREEN: Modify `src/commands/upgrade.ts`: add clarifying comment that `getPlatformAsset()` returns `cyberpunk-{os}-{arch}` matching the release contract
- [x] 3.4 GREEN: Verify `getPlatformAsset()` already handles darwin; confirm no logic change needed
- [x] 3.5 REFACTOR: Ensure upgrade tests only tighten parity assertions, no rewrite of `runUpgrade()` split

## Phase 4: Documentation

- [x] 4.1 Modify `README.md`: add macOS binary availability (darwin x64 + arm64)
- [x] 4.2 Add Gatekeeper caveat: unsigned binaries require right-click → Open workaround
- [x] 4.3 Add macOS ffmpeg requirement note with `brew install ffmpeg` guidance
- [x] 4.4 Explicitly state signing, notarization, and macOS CI validation are deferred (out of scope)

## Phase 5: Validation / Smoke Checks

- [ ] 5.1 Manual: run `install.sh` on a darwin machine (or simulate curl download) to verify asset URL resolves
- [ ] 5.2 Manual: run `cyberpunk upgrade` on darwin to verify `getPlatformAsset()` returns darwin-named asset and downloads correctly
- [ ] 5.3 Confirm release page shows all four assets: linux-x64, linux-arm64, darwin-x64, darwin-arm64

## Deferred Follow-up (out of scope for this change)

- [ ] Signing/notarization: choose ad-hoc signing, Developer ID, or full notarization
- [ ] macOS CI validation: add `macos-latest` runner or manual verification contract per release
