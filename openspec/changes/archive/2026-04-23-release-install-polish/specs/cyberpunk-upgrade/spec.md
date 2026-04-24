# Delta for cyberpunk-upgrade

## ADDED Requirements

### Requirement: Release Asset Validation and Checksums

The release pipeline MUST validate each produced binary with a lightweight startup-oriented smoke test before publish, and MUST publish SHA256 checksums alongside release assets so binary installs and upgrades can rely on verifiable artifacts.

#### Scenario: Release succeeds with validated assets

- GIVEN release CI has built the platform binaries for a tagged release
- WHEN the publish workflow runs
- THEN each binary passes a non-interactive startup smoke test before assets are published
- AND SHA256 checksum artifacts are generated and attached with the release outputs

#### Scenario: Smoke test failure blocks publish

- GIVEN one produced binary cannot complete the required smoke test
- WHEN the release workflow evaluates publish readiness
- THEN release publication is stopped for that run
- AND checksum publication does not proceed for the failed release attempt
