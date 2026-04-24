# Delta for cyberpunk-config

## ADDED Requirements

### Requirement: Config Verification Uses Temporary Home

Automated verification of cyberpunk config behavior MUST execute against temporary HOME-backed fixtures only and MUST NOT create, modify, or depend on the real `~/.config/cyberpunk` path.

#### Scenario: Config tests create isolated state

- GIVEN automated verification starts with no existing temp config
- WHEN config initialization or writes are exercised
- THEN all created files are placed under the temporary HOME fixture
- AND the real user config directory remains unchanged

#### Scenario: Config results do not depend on caller environment

- GIVEN the caller machine has unrelated cyberpunk config content
- WHEN automated verification reads or writes config values
- THEN the results are derived only from the test fixture state
- AND verification passes or fails the same way on a clean machine
