# Proposal: sdd-ctx-stats — Auto-Inject ctx_stats Directive via Cyberpunk Plugin

## Intent

Make every SDD phase sub-agent report `ctx_stats` automatically after the cyberpunk plugin is installed. The plugin bootstraps during `cyberpunk install --plugin` and patches the shared `sdd-phase-common.md` file to guarantee the ctx_stats directive survives Gentle AI updates.

## Scope

The patch targets `sdd-phase-common.md` (the shared boilerplate loaded by all SDD phase agents). The change must be applied by the plugin during bootstrap, not manually.

- **Target file**: `~/.config/opencode/skills/_shared/sdd-phase-common.md`
- **Trigger**: `cyberpunk install --plugin` → plugin `install()` idempotently applies the patch
- **Persistence**: The plugin re-applies the patch on every `install()` call, so it survives Gentle AI skill updates

## Approach

The cyberpunk plugin already patches config/prompts idempotently and manages files with a cyberpunk marker comment. The same mechanism is extended to the shared common file:

1. **`sdd-phase-common.md` (adds Section E)**: The plugin adds or replaces **Section E — Session Stats** with a directive that instructs agents to call `ctx_stats` before returning. The section is wrapped in a cyberpunk marker so the plugin can detect and re-apply it.

2. **`cyberpunk-plugin.ts` (adds shared file patching to `install()`)**: During `install()`, the plugin:
   - Reads `~/.config/opencode/skills/_shared/sdd-phase-common.md`
   - Checks for the cyberpunk marker around Section E
   - If missing or mismatched, injects/replaces the section
   - Marks the file with the cyberpunk marker comment for future idempotent patches

The Section E content to inject:

```markdown
## E. Session Stats — Always Report at the End

Before returning to the orchestrator, call `ctx_stats` and include the result in your `detailed_report` or as a separate line in the envelope.

```
ctx_stats
```

**Why**: Every SDD phase processes files, runs commands, and indexes content. Reporting the session savings makes the token cost visible and encourages consistent use of `ctx_*` tools.

**Format**: Add this at the end of your return:

```
-- Session Stats --
$ ctx_stats output here
```

If `ctx_stats` is unavailable (e.g., not installed), skip silently.
```

## Affected Areas

| File | Change |
|------|--------|
| `sdd-phase-common.md` | Adds/replaces Section E with ctx_stats directive, wrapped in cyberpunk marker |
| `cyberpunk-plugin.ts` | Extends `install()` to patch the shared common file |

## Success Criteria

- [ ] After `cyberpunk install --plugin`, every SDD phase ends with `ctx_stats` output
- [ ] The change survives Gentle AI updates (plugin re-applies it on re-install)
- [ ] If `ctx_stats` is unavailable, no error is thrown (agents skip silently)

## Artifact Storage

- **Mode**: `hybrid` (write to filesystem AND call `mem_save`)
- **Artifact path**: `openspec/changes/sdd-ctx-stats/proposal.md`
- **Engram topic_key**: `sdd/sdd-ctx-stats/proposal`