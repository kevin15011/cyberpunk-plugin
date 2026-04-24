# Tasks: Release Install Polish

## Phase 1: install.sh — Helper Functions

- [x] 1.1 Add `detect_shell_profile()` to `install.sh` — returns the likely profile file (`~/.zshrc`, `~/.bashrc`, `config.fish`) and shell name based on `$SHELL`.
- [x] 1.2 Add `path_already_exported()` to `install.sh` — grep-checks the target profile for the exact `export PATH=…${INSTALL_DIR}…` line to prevent duplicates (spec: *No duplicate PATH export*).
- [x] 1.3 Add `print_path_guidance()` to `install.sh` — prints shell-aware PATH hint with profile target and reload command (`source ~/.zshrc` / `exec fish` etc.).
- [x] 1.4 Add `print_ffmpeg_guidance()` to `install.sh` — structured follow-up that marks ffmpeg as a remaining user action, not a failure. Replaces the existing inline warning.
- [x] 1.5 Add `attempt_quarantine_removal()` to `install.sh` — guarded `xattr -d com.apple.quarantine` with `command -v xattr` check; prints manual fallback text if unavailable (macOS only).
- [x] 1.6 Add `print_install_summary()` to `install.sh` — concise end block covering installed path, PATH status/profile hint, ffmpeg status, and verification command (`cyberpunk help`).

## Phase 2: install.sh — Wire into Main Flow

- [x] 2.1 Replace the current inline ffmpeg warning (lines 24-37) with a call to `print_ffmpeg_guidance`, preserving OS-specific install hints.
- [x] 2.2 Replace the current PATH check block (lines 83-91) with `path_already_exported` + `print_path_guidance` — uses detected shell profile instead of generic export line.
- [x] 2.3 Insert `attempt_quarantine_removal` call after `chmod +x` on macOS, before config init.
- [x] 2.4 Insert `print_install_summary` call after config persistence verification, before TUI launch — passes install path, PATH status, and ffmpeg presence.

## Phase 3: Release Workflow — Smoke Tests & Checksums

- [x] 3.1 In `release.yml` build job: add a smoke-test step after build that runs `./cyberpunk-linux-x64 help` and verifies exit code 0 (native runner, can execute directly).
- [x] 3.2 In each cross-compiled build job (darwin-x64, darwin-arm64, linux-arm64): add a `sha256sum` step that writes the binary hash to a `checksums.txt` fragment.
- [x] 3.3 In the build job (linux-x64): also compute `sha256sum` for the native binary and append to the same manifest pattern.
- [x] 3.4 Add a new `checksums` job that runs after all build jobs, downloads each `checksums.txt` fragment via `actions/download-artifact`, concatenates into a single `checksums.txt`, and uploads it as a release asset using `ncipollo/release-action`.

## Phase 4: README Documentation

- [x] 4.1 Update **Install** section in `README.md` to mention shell-aware PATH guidance and the new verification summary.
- [x] 4.2 Update **macOS notes** section to document automatic quarantine removal and the manual fallback.
- [x] 4.3 Add a **Verifying downloads** section with `sha256sum -c checksums.txt` instructions for release checksums.

## Phase 5: Dry-Run Verification

- [x] 5.1 Dry-run `install.sh` locally with a temp `HOME` and mock profile files — verify no duplicate PATH, correct shell detection, and summary output.
- [x] 5.2 Verify the release workflow YAML is valid (`actionlint` or `gh workflow lint`) and the new job dependency graph resolves correctly.
