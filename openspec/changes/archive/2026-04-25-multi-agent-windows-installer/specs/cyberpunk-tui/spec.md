# Delta for cyberpunk-tui

## ADDED Requirements

### Requirement: Professional Segmented Guidance

The TUI MUST use professional English copy with no emoticons, and MUST provide distinct guided and technical flows. Guided flows SHOULD favor clear defaults and recommendations for non-technical users, while technical flows MUST expose target, compatibility, and remediation detail.

#### Scenario: Guided recommendation flow

- GIVEN a non-technical user starts the install flow
- WHEN recommendations are shown
- THEN the TUI presents plain-language target and component guidance with safe defaults
- AND unsupported options are explained without jargon-heavy failure text

#### Scenario: Technical detail flow

- GIVEN a technical or admin user reviews status or install details
- WHEN advanced information is shown
- THEN the TUI includes agent state, compatibility rationale, paths, and remediation steps in professional English
