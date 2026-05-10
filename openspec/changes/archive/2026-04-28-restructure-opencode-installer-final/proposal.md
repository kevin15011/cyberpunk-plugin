# Proposal: Restructure OpenCode Installer — Final macOS OpenCode Polish

## Intent

Finish macOS + OpenCode first with the final polish found during real OpenCode usage: fresh doctor repair results, one-key TUI return-home shortcuts, no OTEL/telemetry install surface, canonical codebase-memory MCP config, and strict clean verification.

## Scope

### In Scope
- macOS + OpenCode is the only implementation target for this iteration; Claude/Codex remain disabled/rejected with clear messaging.
- SDD Integration readiness detection must inspect the OpenCode SDD skill/shared files used by this installer, not only `sdd-phase-common.md`.
- If required OpenCode SDD assets are missing, install/status/doctor/preflight must mark `sdd-integration` unavailable or skipped with a specific missing-file list.
- Normal presets must exclude aesthetic-only `theme` and `sounds`; they are included only by `cyberpunk-full` or explicit Custom/manual selection.
- codebase-memory tests and path resolution must be deterministic, independent of the user’s real `PATH`.
- TUI install/uninstall/repair/doctor completion screens must expose a one-key Home/root shortcut and doctor repair must refresh diagnostics immediately after fixing.
- OTEL/telemetry install features must be removed from components, presets, CLI help/flags, doctor/status/preflight, docs, and tests; uninstall/cleanup guidance must cover legacy OTEL plugin/config/env state.
- OpenCode MCP config must keep only canonical `codebase-memory`; install/repair/doctor fix must remove legacy duplicate `codebase-memory-mcp` while preserving the absolute executable path.
- End-to-end macOS + OpenCode validation must pass with 0 warnings.

### Out of Scope
- Browser automation, Claude/Codex installers, Git helpers implementation.

## Success Criteria
- [ ] SDD readiness detects required OpenCode SDD shared/phase skill files and reports missing assets clearly.
- [ ] `sdd-integration` installs only when readiness is satisfied; otherwise skipped/unavailable without pretending success.
- [ ] Normal presets exclude `theme` and `sounds`; only Full/Custom include them.
- [ ] codebase-memory tests do not depend on the user’s real `PATH`.
- [ ] Doctor repair refreshes visible results and completed TUI flows provide one-key Home/root navigation.
- [ ] OTEL/telemetry is absent from installable feature surfaces, with safe cleanup guidance for existing installs.
- [ ] User evidence is covered: `opencode.json` containing both `codebase-memory` and `codebase-memory-mcp` pointing to `/Users/kevinlondono/.local/bin/codebase-memory-mcp` is normalized to only `codebase-memory`.
- [ ] macOS + OpenCode install/status/doctor verification is clean: 0 CRITICAL, 0 WARNING.
