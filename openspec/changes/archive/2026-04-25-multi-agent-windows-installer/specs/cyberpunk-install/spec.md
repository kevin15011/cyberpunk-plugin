# Delta for cyberpunk-install

## ADDED Requirements

### Requirement: Agent-Aware Compatibility and Backward Compatibility

The install flow MUST preserve current OpenCode component behavior when no new target is selected, and MUST apply agent/platform compatibility filtering when a target is detected or chosen. Unsupported or unknown components MUST be skipped with rationale instead of being installed speculatively.

#### Scenario: Legacy OpenCode flow stays intact

- GIVEN a user runs an existing OpenCode install flow without agent-specific overrides
- WHEN install selection is resolved
- THEN the same OpenCode-capable components and registration behavior remain available

#### Scenario: Unsupported target component is withheld

- GIVEN Claude or Codex is selected and plugin or theme support is not verified
- WHEN install selection is resolved
- THEN unsupported components are excluded with an explanation
- AND compatible items such as RTK or context-mode are only offered when their compatibility state allows it

### Requirement: Windows-Safe Planning Output

Install planning MUST expose dry-run friendly output that shows selected target, compatibility state, prerequisites, and intended paths before mutation. On Windows, execution MUST use the shared path and shell abstraction.

#### Scenario: Windows install dry-run explains plan

- GIVEN the user requests install planning on Windows
- WHEN the plan is rendered
- THEN the output lists target agent, selected components, prerequisite gaps, and intended paths
- AND no install side effects occur
