# Proposal: Preset Preflight and Guidance

## Intent

Make preset installs clearer before execution by showing live readiness, likely file touches, and practical warnings using existing installer/doctor knowledge. Keep this limited to install-time disclosure, not installer redesign.

## Scope

### In Scope
- Add preset preflight summaries for CLI and TUI before confirmation.
- Disclose per-component/preset dependency readiness, already-installed components, and known warnings.
- Disclose expected file touches where component knowledge already exists.

### Out of Scope
- Full doctor integration, new standalone `preflight` command, or auto-fixing missing dependencies.
- Redesigning install flows, preset definitions, or broader component lifecycle behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cyberpunk-install`: preset preflight disclosure changes from static warnings to live, component-aware readiness guidance before install confirmation.

## Approach

Add a lightweight shared preflight step for preset installs that reuses existing platform prerequisite checks and component/status knowledge. Return a structured summary for CLI/TUI output showing present or missing dependencies, already-installed components, file-touch disclosures, and existing warnings such as platform mismatch or tmux managed-block notes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/commands/preflight.ts` | New | Shared preflight collector for preset installs |
| `src/commands/install.ts` | Modified | Run preflight before preset confirmation/execution |
| `src/cli/output.ts` | Modified | Format preflight summary for human-readable disclosure |
| `src/tui/index.ts` | Modified | Show preflight summary in TUI install flow |
| `src/presets/resolve.ts` | Modified | Carry preset warnings/readiness inputs as needed |
| `src/components/platform.ts` | Reused | Source of dependency checks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Preflight output becomes noisy | Med | Keep sections short and prioritize actionable items |
| Dependency mapping drifts from components | Low | Centralize mapping in one preflight module |
| File-touch disclosure is incomplete | Med | Limit disclosure to known paths and state that it is advisory |

## Rollback Plan

Revert preflight wiring and formatting changes, restoring the existing static preset summary path for CLI and TUI. No config or data migration is required.

## Dependencies

- Existing `checkPlatformPrerequisites()` and install/status component metadata

## Success Criteria

- [ ] Preset installs show live readiness before confirmation in CLI and TUI.
- [ ] Missing or present dependencies are disclosed per relevant component or preset.
- [ ] Known file touches and practical warnings are shown without changing install behavior.
