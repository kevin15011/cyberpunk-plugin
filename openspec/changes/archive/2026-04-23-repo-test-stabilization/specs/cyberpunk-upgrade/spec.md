# Delta for cyberpunk-upgrade

## ADDED Requirements

### Requirement: Repo Upgrade Verification Isolation

Automated verification for repo-based upgrade flows MUST validate dispatch, status reporting, and config preservation without depending on live network access, remote git state, or the caller's working clone.

#### Scenario: Deterministic repo upgrade check

- GIVEN automated verification runs for repo install mode
- WHEN upgrade check behavior is exercised
- THEN remote-version and diff results come from deterministic doubles or fixtures
- AND the outcome is identical across repeated runs without internet access

#### Scenario: Upgrade verification preserves user config in isolation

- GIVEN automated verification uses an isolated cyberpunk config fixture
- WHEN repo upgrade behavior is exercised
- THEN verification confirms config content is preserved across the flow
- AND no real user config path is read or written
