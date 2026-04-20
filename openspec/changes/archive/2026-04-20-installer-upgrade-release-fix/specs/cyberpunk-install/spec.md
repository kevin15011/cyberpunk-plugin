# Delta for Cyberpunk Install

## ADDED Requirements

### Requirement: OpenCode Registration After Plugin Install

After a successful plugin file copy, the system SHALL invoke the plugin-registration helper to add `./plugins/cyberpunk` to the OpenCode config `plugin` array.

#### Scenario: Registration follows successful plugin install

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` is copied successfully
- WHEN the install result status is `"success"`
- THEN the registration helper is invoked to update OpenCode config

#### Scenario: Registration skipped on install failure

- GIVEN the plugin file copy fails
- WHEN the install result status is `"error"`
- THEN the registration helper is NOT invoked

### Requirement: OpenCode Unregistration After Plugin Uninstall

After a successful plugin file removal, the system SHALL invoke the plugin-registration helper to remove `./plugins/cyberpunk` from the OpenCode config `plugin` array.

#### Scenario: Unregistration follows successful plugin uninstall

- GIVEN `~/.config/opencode/plugins/cyberpunk.ts` is removed successfully
- WHEN the uninstall result status is `"success"`
- THEN the unregistration helper is invoked to update OpenCode config

#### Scenario: Unregistration skipped on uninstall skip

- GIVEN the plugin file does not exist
- WHEN the uninstall result status is `"skipped"`
- THEN the unregistration helper is NOT invoked
