# Proposal: Sound Interaction Trigger Fix

## Intent

The completion sound (`idle.wav`) fires on the unreliable `session.idle` event, which does not reliably indicate "assistant finished responding." The correct event is `message.updated` gated by `properties.info.finish`, but this fires multiple times per interaction. The plugin currently has both triggers active (lines 184 and 200–205 in `PLUGIN_SOURCE`), causing duplicate or missing sounds. We need to: remove the `session.idle` trigger, gate completion solely on `message.updated` + `info.finish`, and add dedupe protection so the completion sound plays exactly once per interaction.

## Scope

### In Scope
- Remove `session.idle` sound trigger from `PLUGIN_SOURCE` in `src/components/plugin.ts`
- Add a completion dedupe guard (timestamp or message-ID based) to `PLUGIN_SOURCE`
- Rename `idle.wav` → `complete.wav` in both `PLUGIN_SOURCE` and `src/components/sounds.ts` to clarify semantics
- Update `SOUND_FILES` array and `SOUND_GENERATORS` map accordingly
- Preserve existing `session.error`, `session.compacted`, `permission.asked` handlers unchanged
- Restrict all changes to files within this repository

### Out of Scope
- Adding new sound events beyond the four existing ones
- Changing sound synthesis parameters or audio content
- Modifying any files outside this repository (e.g., installed plugin at runtime)
- Changing the `cyberpunk-plugin.ts` root file (it imports from `src/components/plugin.ts`)

## Capabilities

### New Capabilities
- `plugin-sound-events`: Runtime plugin event-to-sound mapping — defines which OpenCode lifecycle events trigger which sound files, with dedupe rules for streaming-completion events.

### Modified Capabilities
None — the existing `cyberpunk-install` spec covers component installation only. Sound event behavior was never formally specified, so this is a new capability, not a modification.

## Approach

1. In `PLUGIN_SOURCE` (inside `src/components/plugin.ts`):
   - Delete the `session.idle` handler block (lines 184–186)
   - Add a `lastCompletionTime` variable (module-level, initialized to 0)
   - In the `message.updated` handler, guard `playSound` with a 2-second throttle: only play if `Date.now() - lastCompletionTime > 2000`, then set `lastCompletionTime = Date.now()`
   - Change the sound file reference from `idle.wav` to `complete.wav`

2. In `src/components/sounds.ts`:
   - Rename the `idle.wav` entry in `SOUND_FILES` and `SOUND_GENERATORS` to `complete.wav`
   - Keep the same synthesis parameters (frequency, filter chain) — just rename

3. Update tests in `tests/plugin.patch.test.ts` and `tests/components.test.ts` to reflect the new event mapping and file name.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/plugin.ts` (PLUGIN_SOURCE) | Modified | Remove `session.idle` handler, add dedupe guard to `message.updated`, rename `idle.wav` → `complete.wav` |
| `src/components/sounds.ts` | Modified | Rename `idle.wav` → `complete.wav` in file list and generators |
| `tests/plugin.patch.test.ts` | Modified | Update assertions for new event trigger and file name |
| `tests/components.test.ts` | Modified | Update sound file name expectations |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `message.updated` with `info.finish` fires for non-assistant messages | Low | Check `info.role === "assistant"` as additional guard |
| Existing users have `idle.wav` but no `complete.wav` after upgrade | Med | Install flow regenerates sounds; document `cyberpunk install --sounds` as upgrade step |
| Throttle window (2s) too short for slow interactions | Low | Configurable via constant; 2s covers normal streaming gaps |

## Rollback Plan

Revert to `session.idle` trigger and remove dedupe guard. Restore `idle.wav` filename. Single commit revert of the 4 affected files.

## Dependencies

- None external. All changes are within the repository.

## Success Criteria

- [ ] `session.idle` handler removed from `PLUGIN_SOURCE`
- [ ] `message.updated` + `info.finish` is the sole completion trigger
- [ ] Completion sound plays at most once per 2-second window (dedupe verified)
- [ ] `permission.asked`, `session.error`, `session.compacted` handlers unchanged
- [ ] Sound file renamed from `idle.wav` to `complete.wav` in both plugin source and sounds component
- [ ] All existing tests pass with updated assertions
