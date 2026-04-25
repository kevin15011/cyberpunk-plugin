# Proposal: Multi-Agent Windows Installer

## Intent

Cyberpunk is OpenCode-centric and Unix-first. Windows enterprise users need a professional installer that detects OpenCode, Claude, and Codex environments, recommends compatible components, and preserves existing OpenCode behavior while introducing agent/platform abstractions.

## Scope

### In Scope
- Add Windows-native environment, path, binary, and prerequisite detection.
- Introduce agent targets for OpenCode, Claude, and Codex with compatibility metadata.
- Recommend installable components including context-mode and RTK from detected state.
- Add Windows binary/release support and PowerShell installer guidance.
- Rework TUI copy/flow for professional English, non-technical, developer, and admin users.

### Out of Scope
- Replacing current OpenCode plugin behavior or sound asset names.
- Full Claude/Codex plugin/theme implementations before their extension surfaces are verified.
- Enterprise packaging formats such as MSI, Intune packages, or code signing automation.

## Capabilities

### New Capabilities
- `agent-environment-detection`: Detect Windows/WSL/macOS/Linux, installed agent targets, prerequisites, and recommended actions.
- `windows-installer-distribution`: Build Windows executables and provide PowerShell-based installation/update entrypoints.

### Modified Capabilities
- `cyberpunk-install`: Support agent-aware component compatibility, recommendations, and Windows-safe install execution.
- `cyberpunk-config`: Persist agent/profile/platform-aware component state without breaking existing config.
- `cyberpunk-tui`: Segment UI by target agent and user profile with professional copy and guided recommendations.
- `doctor`: Diagnose Windows prerequisites, agent availability, and recommended remediation.
- `plugin-registration`: Keep OpenCode registration intact while isolating it behind agent-specific adapters.

## Approach

Phase 1 adds platform/path/command abstractions and Windows detection. Phase 2 generalizes component registry/config around `AgentTarget`, compatibility, and user profiles. Phase 3 adds detection/recommendation engine. Phase 4 adds Windows build plus `install.ps1`. Phase 5 validates Claude/Codex surfaces before agent-specific components. Phase 6 updates TUI copy and flows.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/platform/` | Modified | Windows detection, paths, command lookup |
| `src/components/` | Modified | Compatibility metadata and agent adapters |
| `src/config/` | Modified | Backcompatible multi-agent state |
| `src/commands/` | Modified | Detection-driven install/status/doctor |
| `src/tui/` | Modified | Professional segmented guidance |
| `build.ts`, `install.ps1` | New/Modified | Windows executable and installer |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Claude/Codex surfaces unclear | High | Gate agent-specific features behind verified adapters |
| Windows shell/path differences | High | Centralize command/path abstractions with tests |
| OpenCode regression | Medium | Preserve existing paths and specs; add adapter parity tests |
| Enterprise trust friction | Medium | Document signing/Defender limitations; defer MSI/signing |

## Rollback Plan

Keep OpenCode defaults as legacy-compatible behavior. New Windows and multi-agent features should be feature-gated by detection/config so rollback can remove new adapters, `install.ps1`, and Windows release assets without changing existing OpenCode install paths.

## Dependencies

- Bun Windows compile validation, GitHub Actions Windows runners, PowerShell availability.
- Research on Claude Code and Codex config, MCP, theme, and extension surfaces.

## Success Criteria

- [ ] Existing OpenCode install/status/doctor/TUI flows remain compatible.
- [ ] Windows detection recommends only supported components with clear rationale.
- [ ] Non-technical users get guided defaults; developers/admins get explicit controls and JSON/scriptable paths.
- [ ] Windows binary and PowerShell installer can install, upgrade, and report actionable errors.
