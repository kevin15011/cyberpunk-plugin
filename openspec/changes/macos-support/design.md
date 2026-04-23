# Design: macOS Support

## Technical Approach

Ship macOS binaries by extending the existing GitHub Releases contract instead of inventing a new distribution path. The change keeps `cyberpunk-{os}-{arch}` naming, adds darwin build artifacts in `.github/workflows/release.yml`, lets `install.sh` download darwin assets with the same URL template, and documents macOS requirements. Runtime upgrade logic already uses the same asset contract, so implementation stays mostly in build/docs with a small parity pass around upgrade coverage.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Release workflow shape | Refactor to matrix; add standalone jobs | Add standalone darwin jobs mirroring existing Linux jobs | Follows the current workflow pattern, keeps `release-action` update semantics unchanged, and minimizes release-risky refactors. |
| Installer asset resolution | Add manifest/API lookup; keep deterministic filename | Keep deterministic `cyberpunk-{os}-{arch}` URL | `install.sh` and `src/commands/upgrade.ts` already share this contract; one naming scheme avoids drift. |
| Upgrade path changes | Rewrite upgrade selection; preserve existing helper | Preserve `getPlatformAsset()` and only tighten parity tests/docs | Root cause is missing release assets, not bad upgrade logic. Changing less reduces regression risk. |
| macOS trust story | Block until signing/notarization; ship unsigned MVP | Ship unsigned binaries now, defer signing/notarization | Matches proposal scope and avoids blocking distribution on Apple credential/runner setup. |

## Data Flow

### Release sequence

`resolve-tag` → `build` (`cyberpunk-linux-x64`) → parallel asset jobs (`linux-arm64`, `darwin-x64`, `darwin-arm64`) → each uploads to same GitHub Release.

### Install / upgrade sequence

User shell → `install.sh` detects `uname -s` / `uname -m` → normalizes to `darwin|linux` + `x64|arm64` → builds `cyberpunk-{os}-{arch}` → downloads `/releases/latest/download/{asset}` → runs `cyberpunk config init` + `config installMode binary` → later `runUpgrade()` reuses `getPlatformAsset()` and downloads `/releases/download/{tag}/{asset}`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/release.yml` | Modify | Add `build-darwin-x64` and `build-darwin-arm64` jobs using Bun cross-compilation and `allowUpdates` upload behavior. |
| `install.sh` | Modify | Keep current OS/arch detection, allow darwin downloads, retain Alpine special-case for Linux only, and print macOS ffmpeg guidance (`brew install ffmpeg`). |
| `src/commands/upgrade.ts` | Modify | Keep runtime logic stable; add comments or small guard cleanup only if needed for asset-contract clarity. |
| `tests/upgrade-mode.test.ts` | Modify | Lock regex/asset expectations and binary-upgrade behavior for darwin naming parity. |
| `README.md` | Modify | Advertise macOS binary availability, supported darwin x64/arm64 targets, Gatekeeper caveat, and macOS ffmpeg requirement. |

## Interfaces / Contracts

```text
Release asset names:
cyberpunk-linux-x64
cyberpunk-linux-arm64
cyberpunk-darwin-x64
cyberpunk-darwin-arm64

Installer URL:
https://github.com/kevin15011/cyberpunk-plugin/releases/latest/download/cyberpunk-{os}-{arch}

Upgrade URL:
https://github.com/kevin15011/cyberpunk-plugin/releases/download/{tag}/cyberpunk-{os}-{arch}
```

No config schema changes are required; binary installs continue to persist `installMode: "binary"` and upgrades dispatch through the existing `runUpgrade()` split.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Asset naming contract | Keep/add `bun:test` coverage for `/^cyberpunk-(linux|darwin)-(x64|arm64)$/` and current-platform expectations. |
| Integration | Installer URL construction + config persistence | Script smoke test on Linux shell plus manual macOS curl/install verification against a staged release asset. |
| Release validation | Cross-compiled artifacts | Confirm workflow uploads both darwin files, executable bit, and successful download URLs from the release page. |
| Manual macOS | TUI startup, ffmpeg warning, upgrade download | Run installed binary on Apple Silicon and Intel macOS where available; verify Gatekeeper workaround docs are sufficient. |

## Migration / Rollout

No migration required. Rollout is release-based: merge workflow/docs changes, publish a release containing darwin assets, then validate install and upgrade from released binaries before announcing support.

## Open Questions

- [ ] Signing/notarization: choose ad-hoc signing, Developer ID signing, or full notarization once Apple credentials are available.
- [ ] CI validation: decide whether a later change adds `macos-latest` smoke tests or keeps manual verification only.
- [ ] Intel macOS coverage: confirm whether `darwin-x64` can be manually validated each release or should become best-effort support.
