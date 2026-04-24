# Delta for Doctor

## ADDED Requirements

### Requirement: macOS Readiness Diagnostics

When platform detection resolves to macOS, doctor MUST emit explicit macOS readiness diagnostics for the audited binary flow. The diagnostics MUST distinguish executable blockers from deferred support limitations, and SHALL include actionable reporting for release-asset readiness, quarantine-handling readiness, and unsigned-binary/Gatekeeper expectations. Deferred items such as signing and notarization MUST be reported as advisory results with `fixable: false`.

#### Scenario: Report explicit audited macOS readiness state

- GIVEN platform detection resolves to macOS and the audited binary install or upgrade path is usable
- WHEN `cyberpunk doctor` is run
- THEN doctor includes macOS-specific readiness checks that show the supported path and any remaining advisory limitations

#### Scenario: Surface actionable macOS blocker

- GIVEN platform detection resolves to macOS and a required audited binary-readiness condition is missing
- WHEN `cyberpunk doctor` is run
- THEN doctor reports a macOS-specific warning or failure with the next recovery action for that blocker

#### Scenario: Keep deferred platform work advisory in fix mode

- GIVEN platform detection resolves to macOS and the only remaining issues are deferred items such as unsigned binaries or missing notarization
- WHEN `cyberpunk doctor --fix` is run
- THEN doctor does not attempt automatic repair for those deferred items and reports them as advisory limitations
