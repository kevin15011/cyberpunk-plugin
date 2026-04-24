# Design: Release Install Polish

## Technical Approach

Keep the slice additive. `install.sh` stays a thin binary bootstrapper, but gains shell-aware PATH guidance, clearer ffmpeg/macOS messaging, and a short verification block before launching the TUI. `.github/workflows/release.yml` keeps the current per-platform release flow, but adds native smoke checks where the runner can execute the built asset and uploads a single SHA256 manifest alongside binaries.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| PATH handling | Auto-edit profiles; print generic export; print shell-aware target | Print shell-aware guidance only | Avoids risky profile mutation while still telling users the likely file (`~/.zshrc`, `~/.bashrc`, config.fish) and restart command. |
| macOS first-run handling | Docs only; unconditional `xattr`; guarded `xattr` + fallback text | Guarded quarantine removal in `install.sh` | Keeps install non-fatal if `xattr` is absent and reduces Gatekeeper friction without expanding into signing/notarization. |
| Release validation | Build only; source-level test; binary startup smoke test | Run binary-level `help`/`config` smoke tests before asset upload | Validates the real release artifact with minimal runtime side effects and low flake risk. |
| Checksum publication | Per-file notes; separate assets; single manifest | Publish `checksums.txt` asset | Matches `sha256sum -c` usage, keeps README instructions simple, and avoids extra release management logic. |

## Data Flow

### Installer

User shell → `install.sh` → download `cyberpunk-{os}-{arch}`
→ `chmod +x` → `cyberpunk config init`
→ `cyberpunk config installMode binary`
→ optional `xattr -d com.apple.quarantine`
→ PATH/ffmpeg/verify summary → `cyberpunk tui`

### Release

GitHub Actions → build platform binary
→ native smoke check (`help`, `config --init`, `config installMode` readback only in temp HOME)
→ append SHA256 line to manifest
→ upload binary + `checksums.txt` to release

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `install.sh` | Modify | Add helper functions for shell/profile detection, ffmpeg hints, guarded macOS quarantine removal, and end-of-install verification summary. |
| `.github/workflows/release.yml` | Modify | Add per-job smoke checks, shared checksum generation, and release upload of `checksums.txt`; move jobs to native runners where execution is required. |
| `README.md` | Modify | Document new PATH guidance, macOS quarantine behavior, checksum verification, and release validation expectations. |

## Interfaces / Contracts

```text
Release assets:
- cyberpunk-linux-x64
- cyberpunk-linux-arm64
- cyberpunk-darwin-x64
- cyberpunk-darwin-arm64
- checksums.txt   # "<sha256>  <filename>" per line
```

```text
Installer summary contract:
- installed path
- PATH status / target profile hint
- ffmpeg status or install hint
- verification command: cyberpunk help
- macOS note if quarantine removal could not run
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | None added in this slice | Shell/workflow changes are better covered with smoke execution than isolated unit tests. |
| Integration | `install.sh` branches | Dry-run locally with injected `HOME`, mocked PATH/profile files, and missing/present `ffplay` / `xattr`. |
| E2E | Release artifacts start | In Actions, execute built binary with `help`; run config init/readback in an isolated temp HOME before publishing assets. |

## Migration / Rollout

No migration required. Roll out with the next release; existing installs continue working. New checksum instructions are additive.

## Open Questions

- [ ] Confirm target runners for native smoke tests: Linux arm64 may need an ARM runner or remain build-only in this slice.
- [ ] Confirm whether the verification summary should always launch the TUI afterward or skip auto-launch when smoke-style checks fail.
