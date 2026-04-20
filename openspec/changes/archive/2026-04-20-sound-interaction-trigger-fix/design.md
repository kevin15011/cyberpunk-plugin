# Design: Sound Interaction Trigger Fix

## Technical Approach

Remove the `session.idle` completion trigger and the unused `lastSoundTime` variable from `PLUGIN_SOURCE`. Replace with a single `message.updated` + `info.finish` trigger guarded by a timestamp-based throttle (`lastCompletionTime`). The completion sound file remains `idle.wav` per the Sound Asset Filename Stability spec requirement. Only `src/components/plugin.ts` changes — the `PLUGIN_SOURCE` template string is updated. No sound component or filename changes.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Completion trigger | `message.updated` gated by `properties.info.finish` | `session.idle` | `session.idle` is unreliable; `message.updated`+`finish` is the correct terminal signal from OpenCode |
| Dedupe mechanism | Timestamp throttle (module-level `lastCompletionTime`, 2s window) | Message-ID tracking, Set-based dedupe | Timestamp is simpler, no external state, survives across events; message-ID would require access to `event.id` which may not exist on all events |
| Throttle window | 2 seconds (extracted constant `COMPLETION_THROTTLE_MS`) | 1s, 5s, configurable | 2s covers the typical burst of duplicate `message.updated`+`finish` events; short enough to allow consecutive user interactions |
| Throttle variable | Replace unused `lastSoundTime` with `lastCompletionTime` | Keep both, add new variable | `lastSoundTime` is dead code (declared but never read); replacing it avoids accumulating dead state |
| Sound filename | Keep `idle.wav` unchanged | Rename to `complete.wav` | Spec requirement "Sound Asset Filename Stability" forbids renames; existing users must not need reinstallation |
| Role guard | Not added | `info.role === "assistant"` check | `info.finish` is only set on assistant messages per OpenCode semantics; adding a role guard is defensive but spec does not require it — keep minimal |

## Data Flow

```
OpenCode runtime
  │
  ├─ session.error ────────────► playSound("error.wav")        [unchanged]
  ├─ session.compacted ────────► playSound("compact.wav")      [unchanged]
  ├─ permission.asked ─────────► playSound("permission.wav")   [unchanged]
  │
  ├─ session.idle ─────────────► (no handler)                  [REMOVED]
  │
  └─ message.updated
       │
       ├─ info.finish absent? ──► ignore (streaming intermediate)
       │
       └─ info.finish present?
            │
            ├─ now - lastCompletionTime > 2000ms?
            │    ├─ YES ► playSound("idle.wav"), set lastCompletionTime = now
            │    └─ NO  ► skip (deduped)
            │
            └─ (end)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/plugin.ts` | Modify | Update `PLUGIN_SOURCE` template: remove `session.idle` handler (lines 184–186), replace `let lastSoundTime = 0` with `const COMPLETION_THROTTLE_MS = 2000` + `let lastCompletionTime = 0`, add throttle guard in `message.updated` handler |
| `tests/plugin.patch.test.ts` | Modify | Add tests: verify `PLUGIN_SOURCE` does NOT contain `session.idle` sound trigger; verify `lastCompletionTime` throttle logic via string assertions on `PLUGIN_SOURCE` |

**No changes to**: `src/components/sounds.ts`, `tests/components.test.ts`, or any sound assets — filenames remain `idle.wav`, `error.wav`, `compact.wav`, `permission.wav`.

## Interfaces / Contracts

The `PLUGIN_SOURCE` template string's event handler changes from:

```typescript
// BEFORE (lines 181–208 of PLUGIN_SOURCE)
event: async ({ event }) => {
  if (event.type === "session.idle") {         // ← REMOVE this block
    try { await playSound($, "idle.wav") } catch {}
  }
  // ... permission/error/compact unchanged ...
  if (event.type === "message.updated") {
    const info = (event as any).properties?.info
    if (info?.finish) {
      try { await playSound($, "idle.wav") } catch {}  // ← no dedupe
    }
  }
}
```

To:

```typescript
// AFTER
event: async ({ event }) => {
  // No session.idle handler — completion is message.updated only
  
  // ... permission/error/compact unchanged ...
  
  if (event.type === "message.updated") {
    const info = (event as any).properties?.info
    if (info?.finish) {
      const now = Date.now()
      if (now - lastCompletionTime > COMPLETION_THROTTLE_MS) {
        lastCompletionTime = now
        try { await playSound($, "idle.wav") } catch {}
      }
    }
  }
}
```

Module-level state in PLUGIN_SOURCE changes from:
```typescript
let lastSoundTime = 0  // dead code — never read
```
To:
```typescript
const COMPLETION_THROTTLE_MS = 2000
let lastCompletionTime = 0
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `PLUGIN_SOURCE` does not contain `session.idle` sound trigger | String assertion: `expect(PLUGIN_SOURCE).not.toContain('event.type === "session.idle"')` in `tests/plugin.patch.test.ts` |
| Unit | `PLUGIN_SOURCE` contains `lastCompletionTime` and `COMPLETION_THROTTLE_MS` | String assertions on template content |
| Unit | `PLUGIN_SOURCE` contains throttle guard (`now - lastCompletionTime`) | String assertion confirming guard logic present |
| Unit | Existing handlers (`session.error`, `session.compacted`, `permission.asked`) remain unchanged | Positive string assertions on each event type in `PLUGIN_SOURCE` |
| Unit | Throttle window is 2000ms | Assert `COMPLETION_THROTTLE_MS = 2000` in template |

No integration/E2E tests — the plugin runs inside OpenCode's runtime; we test the template content that gets installed, not the runtime behavior.

## Migration / Rollout

No migration required. The `PLUGIN_SOURCE` template is written to disk at install time. Users run `cyberpunk install` (or `bun run cyberpunk.ts install`) which overwrites the plugin file with the updated template. Existing `idle.wav` sound files remain valid — no reinstallation of sounds needed.

Rollback: revert the single commit. `cyberpunk install` rewrites the old template.

## Open Questions

None — all constraints are resolved by the spec.
