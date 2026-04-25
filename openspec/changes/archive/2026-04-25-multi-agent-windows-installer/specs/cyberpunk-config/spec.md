# Delta for cyberpunk-config

## ADDED Requirements

### Requirement: Multi-Agent State Persistence

The config model MUST persist platform, selected or detected agent target, user profile, and per-component compatibility state using precise interfaces. Existing OpenCode-era config files MUST remain readable without migration failure and MUST default to legacy OpenCode behavior when newer fields are absent.

#### Scenario: Legacy config remains valid

- GIVEN a config file contains only the current OpenCode-focused fields
- WHEN the config is loaded after this change
- THEN loading succeeds without destructive rewrite
- AND missing multi-agent fields default to legacy-compatible values

#### Scenario: Multi-agent state is stored explicitly

- GIVEN a user selects Windows, Claude, and a technical profile
- WHEN config is saved
- THEN the stored state records those selections and per-component compatibility outcomes explicitly
