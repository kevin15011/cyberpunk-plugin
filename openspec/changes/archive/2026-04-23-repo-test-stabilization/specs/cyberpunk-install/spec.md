# Delta for cyberpunk-install

## ADDED Requirements

### Requirement: Tmux Verification Harness Preparation

Automated verification for tmux install and related doctor assertions MUST prepare temporary tmux/config fixtures before execution, MUST verify only the managed cyberpunk-owned content within those isolated fixtures, and MUST NOT touch real user tmux or cyberpunk config files.

#### Scenario: Tmux install verification provisions fixture first

- GIVEN tmux install verification is about to assert managed config behavior
- WHEN the harness executes the install flow
- THEN the temporary tmux config fixture already exists with any required seed content
- AND assertions target that fixture instead of the real user files

#### Scenario: Tmux verification preserves unmanaged content in fixture

- GIVEN the temporary tmux fixture contains unmanaged user content around the managed block
- WHEN install or doctor verification runs
- THEN only cyberpunk-managed content is asserted or changed
- AND unmanaged fixture content remains intact
