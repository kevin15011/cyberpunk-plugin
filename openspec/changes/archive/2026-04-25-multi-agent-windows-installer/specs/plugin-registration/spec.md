# Delta for plugin-registration

## ADDED Requirements

### Requirement: Agent-Specific Registration Adapters

The system MUST preserve the current OpenCode registration contract exactly, and MUST isolate registration behind agent-specific adapters. Claude and Codex registration MUST NOT run unless their adapter is explicitly verified as supported.

#### Scenario: OpenCode registration is unchanged

- GIVEN OpenCode plugin installation succeeds
- WHEN registration runs
- THEN the current OpenCode config entry is managed with the existing path and idempotent behavior

#### Scenario: Unverified adapter is not invoked

- GIVEN Claude or Codex is selected but no verified registration adapter exists
- WHEN plugin registration would otherwise run
- THEN registration is skipped safely with an explanatory status
