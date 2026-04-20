# Tasks: Sound Interaction Trigger Fix

## Phase 1: Plugin Source — Remove session.idle Handler

- [x] 1.1 In `PLUGIN_SOURCE` template (src/components/plugin.ts, line ~184), remove the entire `if (event.type === "session.idle")` block that calls `playSound($, "idle.wav")`
- [x] 1.2 Replace `let lastSoundTime = 0` (line ~100 in PLUGIN_SOURCE) with `const COMPLETION_THROTTLE_MS = 2000` and `let lastCompletionTime = 0` — the original `lastSoundTime` was dead code (declared, never read); replace it with the throttle constant and tracking variable

## Phase 2: Plugin Source — Add Dedupe/Throttle Guard

- [x] 2.1 In the `message.updated` handler inside PLUGIN_SOURCE, wrap the `playSound($, "idle.wav")` call with throttle guard: `if (now - lastCompletionTime > COMPLETION_THROTTLE_MS) { lastCompletionTime = now; try { await playSound($, "idle.wav") } catch {} }` — where `now = Date.now()`
- [x] 2.2 The `info?.finish` gate remains unchanged; throttle ensures only one sound per 2s window regardless of how many `message.updated`+`finish` events fire
- [x] 2.3 Verify `permission.asked` (line ~196), `session.error` (line ~188), and `session.compacted` (line ~192) handlers are untouched

## Phase 3: Testing — plugin.patch.test.ts

- [x] 3.1 Add test: `PLUGIN_SOURCE` must NOT contain `event.type === "session.idle"` string (confirms handler is gone)
- [x] 3.2 Add test: `PLUGIN_SOURCE` must contain `COMPLETION_THROTTLE_MS = 2000` (constant exists)
- [x] 3.3 Add test: `PLUGIN_SOURCE` must contain `lastCompletionTime` variable declaration
- [x] 3.4 Add test: `PLUGIN_SOURCE` must contain throttle guard pattern `now - lastCompletionTime > COMPLETION_THROTTLE_MS` inside `message.updated` handler
- [x] 3.5 Add test: `PLUGIN_SOURCE` must still contain `event.type === "permission.asked"` + `playSound($, "permission.wav")` (preserved)
- [x] 3.6 Add test: `PLUGIN_SOURCE` must still contain `event.type === "session.error"` + `playSound($, "error.wav")` (preserved)
- [x] 3.7 Add test: `PLUGIN_SOURCE` must still contain `event.type === "session.compacted"` + `playSound($, "compact.wav")` (preserved)
- [x] 3.8 Add test: `PLUGIN_SOURCE` must still contain `playSound($, "idle.wav")` for completion (filename unchanged, no asset rename)

## Phase 4: Verification

- [x] 4.1 Run `bun test tests/plugin.patch.test.ts` — all new and existing tests pass
- [x] 4.2 Verify `PLUGIN_SOURCE` string exports cleanly (no syntax errors in template) by checking `bun build src/components/plugin.ts` or equivalent type-check
- [x] 4.3 Confirm no `session.idle` string remains in PLUGIN_SOURCE template body

## Phase 5: Root File Sync — cyberpunk-plugin.ts

- [x] 5.1 Remove `session.idle` handler block from root `cyberpunk-plugin.ts`
- [x] 5.2 Add `COMPLETION_THROTTLE_MS = 2000` and `let lastCompletionTime = 0` constants
- [x] 5.3 Add throttle guard inside `message.updated` handler (gated by `info?.finish`)
- [x] 5.4 Verify `permission.asked`, `session.error`, `session.compacted` handlers preserved
- [x] 5.5 Verify `idle.wav` filename unchanged
- [x] 5.6 Verify root file builds cleanly (`bun build --no-bundle`)
- [x] 5.7 Run full test suite — all 53 tests pass
