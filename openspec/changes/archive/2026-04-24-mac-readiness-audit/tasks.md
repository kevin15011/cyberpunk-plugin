# Tasks: macOS Readiness Audit

## Phase 1: Upgrade Verification Foundation

- [x] 1.1 Add `BinaryVerification` type and `fetchChecksums(tag)` helper to `src/commands/upgrade.ts` — fetch `checksums.txt` from release assets, parse SHA256 line matching the platform asset name.
- [x] 1.2 Add `computeFileSha256(path)` helper to `src/commands/upgrade.ts` using Node crypto — returns hex digest of the file at the given path.
- [x] 1.3 Add `smokeTestBinary(tmpPath)` helper to `src/commands/upgrade.ts` — runs `tmpPath --help` (or `help` subcommand) with a short timeout, returns boolean success.
- [x] 1.4 Add `prepareDarwinBinary(tmpPath)` helper to `src/commands/upgrade.ts` — attempts `xattr -d com.apple.quarantine`, returns `{ attempted: boolean, guidance?: string }` with fallback manual instructions.

## Phase 2: Upgrade Flow Hardening

- [x] 2.1 Rewrite `downloadAndReplaceBinary()` in `src/commands/upgrade.ts` to call `fetchChecksums → computeFileSha256 → smokeTestBinary → prepareDarwinBinary (if darwin) → atomic rename`. On any step failure, delete `.tmp` file and throw without replacing the existing binary.
- [x] 2.2 Update `runBinaryUpgrade()` error messages to distinguish checksum mismatch, smoke-test rejection, and quarantine failure — each with specific user-facing guidance.

## Phase 3: Doctor macOS Readiness Checks

- [x] 3.1 Add `isXattrAvailable()` and `canCheckCodesign()` probe helpers to `src/components/platform.ts` — use `which`/`execSync`, return booleans, no side effects.
- [x] 3.2 Add darwin-only readiness checks to `collectPlatformChecks()` in `src/commands/doctor.ts` — gated on `detectEnvironment() === "darwin"`: release-asset readiness, quarantine-handling readiness, unsigned-binary advisory. Deferred items (signing, notarization) MUST use `fixable: false`.
- [x] 3.3 Ensure `doctor --fix` does NOT attempt automatic repair for deferred mac items — advisory-only reporting path.

## Phase 4: README Documentation

- [x] 4.1 Update `README.md` "Current macOS limitations" section to reflect audited support status: verified upgrade integrity, documented unsigned-binary expectations, explicit signing/notarization deferral.
- [x] 4.2 Add upgrade hardening description to install/upgrade docs — checksum verification, smoke test, quarantine handling.

## Phase 5: Tests

- [x] 5.1 Add checksum-mismatch test to `tests/upgrade-mode.test.ts` — mock `checksums.txt` with wrong SHA256, verify existing binary is untouched and error is returned.
- [x] 5.2 Add smoke-test rejection test to `tests/upgrade-mode.test.ts` — mock smoke helper to fail, verify no replace and `.tmp` cleanup.
- [x] 5.3 Add darwin quarantine branch test to `tests/upgrade-mode.test.ts` — mock `process.platform` as darwin, verify quarantine attempt and fallback guidance on failure.
- [x] 5.4 Add darwin-only readiness scenario to `tests/doctor-scenarios.test.ts` — mock `detectEnvironment` to return `"darwin"`, verify mac-specific checks appear and advisory items have `fixable: false`.
- [x] 5.5 Add non-darwin no-op test to `tests/doctor-scenarios.test.ts` — mock `detectEnvironment` to return `"linux"`, verify zero mac-specific checks emitted.
- [x] 5.6 Update `tests/readme-release-install.test.ts` — add assertion for audited mac support statement and explicit deferral language.
