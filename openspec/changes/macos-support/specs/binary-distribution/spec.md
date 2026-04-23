# Binary Distribution Specification

## Purpose

Define release assets, bootstrap install behavior, and user-facing macOS distribution constraints for standalone binaries.

## Requirements

### Requirement: Cross-Platform Release Assets

The system MUST publish GitHub release assets using the `cyberpunk-{os}-{arch}` convention. Supported macOS assets MUST include `cyberpunk-darwin-x64` and `cyberpunk-darwin-arm64`.

#### Scenario: macOS assets are published

- GIVEN a release is created
- WHEN binary assets are built for supported targets
- THEN the release includes `cyberpunk-darwin-x64` and `cyberpunk-darwin-arm64`

#### Scenario: Naming stays URL-compatible

- GIVEN any supported binary release asset
- WHEN its filename is evaluated
- THEN it matches `cyberpunk-{os}-{arch}` with no macOS-specific URL variant

### Requirement: Installer Reuses Shared Release URL Pattern

The installer MUST detect `darwin` with `x64` or `arm64` and download the matching asset from `releases/latest/download/cyberpunk-{os}-{arch}`. The installer SHALL use the same binary-install flow on macOS as on Linux after asset selection.

#### Scenario: Apple Silicon install

- GIVEN a macOS arm64 machine
- WHEN the installer runs
- THEN it downloads `cyberpunk-darwin-arm64` from the shared latest-download URL

#### Scenario: Intel Mac install

- GIVEN a macOS x64 machine
- WHEN the installer runs
- THEN it downloads `cyberpunk-darwin-x64` from the shared latest-download URL

### Requirement: Documentation States macOS Constraints and Deferrals

The documentation MUST describe macOS binary availability, ffmpeg installation guidance, and user-visible unsigned-binary constraints. It MUST explicitly state that signing, notarization, and macOS CI validation are deferred non-goals for this change.

#### Scenario: README explains macOS prerequisites

- GIVEN a user reads install documentation
- WHEN reviewing macOS instructions
- THEN the user sees ffmpeg guidance and any required first-run workaround for unsigned binaries

#### Scenario: Deferred work is explicit

- GIVEN a user reads the macOS support notes
- WHEN reviewing current limitations
- THEN the documentation states that signing, notarization, and macOS CI are not included in this MVP
