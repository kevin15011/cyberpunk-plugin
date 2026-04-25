# Agent Environment Detection Specification

## Purpose

Define cross-platform environment, agent, and compatibility detection used by install, status, and doctor.

## Requirements

### Requirement: Detect Platform and Agent State

The system MUST classify the runtime as `windows`, `wsl`, `darwin`, or `linux`, and MUST evaluate `opencode`, `claude`, and `codex` as `installed`, `installable`, `unsupported`, or `unknown`. Results MUST include the rationale needed by install, status, and doctor output.

#### Scenario: Native Windows with OpenCode available

- GIVEN the runtime is native Windows and OpenCode binaries and config are detectable
- WHEN detection runs
- THEN the platform is `windows` and OpenCode is reported as `installed` or `installable`
- AND the result includes the detected path or the missing prerequisite rationale

#### Scenario: Unverified target remains unknown

- GIVEN Codex presence or extension support cannot be verified safely
- WHEN detection runs
- THEN Codex is reported as `unknown`
- AND no support claim is made without explicit rationale

### Requirement: Recommend Compatible Components

The system SHOULD recommend components only when the target agent and platform are compatible. `context-mode` and `rtk` MUST be reported with compatibility rationale so they can be recommended, withheld, or marked unsupported without ambiguity.

#### Scenario: Recommend supported integration

- GIVEN OpenCode is installed and required prerequisites for RTK are available
- WHEN the recommendations are generated
- THEN RTK is reported as `installable` or `recommended` with an explicit reason

#### Scenario: Withhold unsupported integration

- GIVEN Claude is detected but its required integration surface for context-mode is not yet verified
- WHEN recommendations are generated
- THEN context-mode is reported as `unsupported` or `unknown`
- AND the output explains why it is not recommended
