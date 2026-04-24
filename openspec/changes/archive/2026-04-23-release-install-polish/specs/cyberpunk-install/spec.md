# Delta for cyberpunk-install

## ADDED Requirements

### Requirement: Standalone Installer Guidance Summary

The standalone binary installer MUST provide shell-aware PATH guidance, MUST avoid duplicating an already-present PATH export, and MUST end with a concise verification-oriented summary covering binary access and any unresolved prerequisites.

#### Scenario: Shell-aware PATH help for missing binary path

- GIVEN `install.sh` places the binary in a directory not currently reachable on PATH
- WHEN the installer finishes on a recognized shell profile target
- THEN it explains which shell profile to update and how to reload or restart the shell
- AND the completion summary includes a command the user can run to verify `cyberpunk` is callable

#### Scenario: No duplicate PATH export added

- GIVEN the target PATH export line is already present in the selected shell profile
- WHEN `install.sh` provides PATH setup guidance
- THEN the installer does not append a duplicate export line
- AND the completion summary still reports the verification step

### Requirement: Standalone Installer Dependency and macOS First-Run Guidance

The standalone binary installer MUST provide actionable ffmpeg follow-up guidance when ffmpeg is unavailable, MUST attempt macOS quarantine removal when applicable, and MUST continue with manual guidance if automated first-run help cannot be completed.

#### Scenario: Missing ffmpeg is surfaced as follow-up guidance

- GIVEN the binary install succeeds but ffmpeg is not available on PATH
- WHEN `install.sh` reaches post-install guidance
- THEN the installer explains that ffmpeg is still required for sound generation features
- AND the completion summary marks ffmpeg setup as a remaining user action instead of reporting install failure

#### Scenario: macOS quarantine removal falls back to guidance

- GIVEN the installer is running on macOS for a downloaded binary
- WHEN quarantine removal is attempted
- THEN the installer reports whether the automatic step succeeded
- AND if the step cannot run, it provides the user with manual first-run guidance before exit
