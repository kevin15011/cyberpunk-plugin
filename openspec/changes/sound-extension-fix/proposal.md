# Proposal: Sound Extension Fix

## Intent

The bundled plugin file `cyberpunk-plugin.ts` references `.m4a` sound files, but the sounds component (`src/components/sounds.ts`) generates `.wav` files. This mismatch causes all sound playback to silently fail — `playSound()` checks `existsSync()` which returns false, so no sound ever plays. Users hear nothing on session events (idle, error, compacted, permission).

## Scope

### In Scope
- Change 4 hardcoded `.m4a` extensions to `.wav` in `cyberpunk-plugin.ts` lines 26–38
- Align bundled plugin with actual sound file format produced by `src/components/sounds.ts`

### Out of Scope
- Changing the sound file format (`.wav` is correct)
- Modifying `src/components/sounds.ts` or `src/components/plugin.ts` (they already use `.wav`)
- Adding new sound events or changing sound behavior

## Capabilities

### New Capabilities
None

### Modified Capabilities
None — this is a pure bug fix (string literal correction). No spec-level behavior changes.

## Approach

Replace the 4 file extension literals in `cyberpunk-plugin.ts`:
- `idle.m4a` → `idle.wav`
- `error.m4a` → `error.wav`
- `compact.m4a` → `compact.wav`
- `permission.m4a` → `permission.wav`

No logic changes, no new imports, no structural changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `cyberpunk-plugin.ts` lines 26, 30, 34, 38 | Modified | Fix file extension strings |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wrong extension introduced | Low | Direct match with `sounds.ts` output; verify with `ls ~/.config/opencode/sounds/` |
| Existing users have cached `.m4a` files | Low | `playSound()` uses `existsSync` guard — won't crash, just silent |

## Rollback Plan

Revert the 4 string changes back to `.m4a`. Single commit revert.

## Dependencies

None

## Success Criteria

- [ ] All 4 sound file references in `cyberpunk-plugin.ts` use `.wav` extension
- [ ] `playSound()` finds the files when sounds are installed (`existsSync` returns true)
- [ ] Sounds play on session events (idle, error, compacted, permission) when installed
