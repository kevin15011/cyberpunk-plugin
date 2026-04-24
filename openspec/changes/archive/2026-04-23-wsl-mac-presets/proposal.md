# Proposal: WSL and mac Presets

## Intent

Deliver the deferred `wsl` and `mac` install presets using the existing preset system, adding light platform awareness and warnings without changing current install, CLI, or TUI flows.

## Scope

### In Scope
- Add `wsl` and `mac` to the preset registry and resolver.
- Detect `darwin` and WSL at resolve time; warn on platform mismatch but still allow execution.
- Update CLI/help and preset disclosures with the new names and platform-specific caveats.

### Out of Scope
- Auto-installing missing dependencies or fixing WSL audio/PulseAudio.
- Dynamic component filtering, preset persistence, or new preset-management commands.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `cyberpunk-install`: expand preset support beyond slice-1 deferred behavior to include `wsl` and `mac` with mismatch warnings.
- `cyberpunk-tui`: surface the new presets in existing preset-first install selection and confirmation messaging.

## Approach

Remove the temporary deferred guard and add two preset definitions: `wsl` (`plugin`, `theme`, `sounds`, `tmux`) and `mac` (`plugin`, `theme`, `sounds`, `context-mode`, `rtk`). Add a small platform detector (`darwin` or WSL via `/proc/version`) used by preset resolution to attach warnings instead of blocking. Keep execution paths unchanged by resolving presets into the same component lists already used today.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/presets/definitions.ts` | Modified | Register `wsl` and `mac` preset definitions |
| `src/presets/resolve.ts` | Modified | Remove deferral and add mismatch-warning resolution |
| `src/platform/detect.ts` | New | Minimal platform + WSL detection helper |
| `src/cli/output.ts` | Modified | Update help/disclosure text |
| `openspec/specs/cyberpunk-install/spec.md` | Modified | Add supported preset requirements/scenarios |
| `openspec/specs/cyberpunk-tui/spec.md` | Modified | Add TUI preset availability/confirmation updates |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| WSL detection misses edge cases | Low | Use `/proc/version` check with safe fallback |
| Users run a mismatched preset | Medium | Warn clearly; keep per-component dependency checks |
| Scope expands into platform setup work | Medium | Keep slice limited to warnings and help updates |

## Rollback Plan

Revert the new preset definitions, restore the deferred-preset rejection path, and remove the detector/help updates. Existing `minimal`/`full` behavior remains unchanged.

## Dependencies

- Existing preset resolver and install disclosure flows
- Current component-level dependency checks

## Success Criteria

- [ ] `cyberpunk install --preset wsl|mac` resolves through the existing install flow.
- [ ] Mismatched platforms produce warnings, not hard failures.
- [ ] Help/TUI preset messaging includes `wsl` and `mac` without changing manual selection behavior.
