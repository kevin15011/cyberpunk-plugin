# Delta for Cyberpunk-Install

## ADDED Requirements

### Requirement: ComponentModule Doctor Method

The `ComponentModule` interface SHALL include an optional `doctor()` method returning `Promise<DoctorResult>`. Modules that do not implement `doctor()` MUST be treated as having zero checks (empty `DoctorResult`).

#### Scenario: Module with doctor implementation

- GIVEN a component module implements `doctor()`
- WHEN the doctor command collects results
- THEN the module's `DoctorResult` is included in the report

#### Scenario: Module without doctor implementation

- GIVEN a component module does not implement `doctor()`
- WHEN the doctor command collects results
- THEN the module produces an empty `DoctorResult` (no checks, no failures)
