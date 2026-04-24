# Proposal: Doctor Expansion

## Intent

Improve `cyberpunk doctor` so it catches common runtime/platform drift earlier and gives users clearer next actions, while staying within the current component-based doctor model.

## Scope

### In Scope
- Add safe doctor checks for platform/runtime/component drift, including playback binary, OpenCode binary, plugin source drift, and basic sound file validity.
- Add selective safe repairs only where the current model already supports them, without introducing new bootstrap flows.
- Improve text doctor output with component grouping, platform-aware guidance, and actionable next-step summaries.

### Out of Scope
- Installer redesign, component architecture changes, or a rules-engine refactor.
- Tmux active-session health/reload, binary-install-mode verification, config migrations, self-update checks, and broad platform bootstrap automation.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `doctor`: expand high-value diagnostics, keep `--json` stable, and improve human-readable actionability.

## Approach

Use the existing `doctor.ts` orchestration and component `doctor()` hooks. Add incremental checks that leverage `src/platform/detect.ts`, keep fixes limited to already-supported file/config repair patterns, and enhance `formatDoctorText()` without changing the JSON contract.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/commands/doctor.ts` | Modified | Wire new checks and next-step summary data |
| `src/components/platform.ts` | Modified | Add platform-aware prerequisite and playback/OpenCode checks |
| `src/components/plugin.ts` | Modified | Detect bundled-vs-installed plugin source drift |
| `src/components/sounds.ts` | Modified | Validate sound file integrity and reuse safe regeneration |
| `src/cli/output.ts` | Modified | Group text output and improve actionability |
| `tests/doctor*.test.ts` | Modified | Cover new checks and output behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Over-scoping into bootstrap work | Med | Keep repairs limited to existing safe fix paths |
| Output changes affect text consumers | Low | Preserve `--json` as stable contract |
| Platform heuristics misclassify edge cases | Low | Default safely to generic Linux guidance |

## Rollback Plan

Revert the doctor check/output changes and restore prior messaging; no installer, config schema, or component contract changes are required.

## Dependencies

- Existing platform detection helpers in `src/platform/detect.ts`
- Current doctor repair flows for config, plugin, theme, sounds, context-mode, rtk, and tmux

## Success Criteria

- [ ] Doctor reports targeted drift issues for playback/runtime/plugin-source/sound-validity gaps.
- [ ] `--fix` repairs only checks already aligned with current safe repair patterns.
- [ ] Human-readable doctor output gives grouped results and clear next actions without changing `--json` structure.
