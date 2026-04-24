# Delta for Cyberpunk Upgrade

## ADDED Requirements

### Requirement: Verified Binary Replacement for Audited macOS Support

When `installMode` is `"binary"`, the system MUST verify the downloaded release asset against the published SHA256 checksum before replacing the current binary. The system MUST smoke-test the downloaded candidate in a non-interactive way before swap. On macOS, the system MUST attempt quarantine-safe preparation for the candidate binary before final replacement and MUST report manual recovery guidance if that preparation cannot complete. If any verification or preparation step fails, the system MUST leave the existing binary unchanged and return an error.

#### Scenario: Replace binary only after verified macOS candidate is ready

- GIVEN `installMode` is `"binary"`, a newer darwin release exists, and checksum, smoke test, and quarantine-safe preparation all succeed
- WHEN `cyberpunk upgrade` is run on macOS
- THEN the verified candidate replaces the current binary and the command reports a successful upgrade

#### Scenario: Reject checksum mismatch before replace

- GIVEN `installMode` is `"binary"` and the downloaded release asset does not match the published checksum
- WHEN `cyberpunk upgrade` is run
- THEN the command reports an error and the existing local binary remains unchanged

#### Scenario: Reject candidate that cannot be prepared for macOS execution

- GIVEN `installMode` is `"binary"`, the downloaded darwin asset cannot pass the required smoke test or cannot complete quarantine-safe preparation
- WHEN `cyberpunk upgrade` is run on macOS
- THEN the command reports the failed verification step with manual guidance and does not replace the existing binary
