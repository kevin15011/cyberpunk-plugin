# SDD Phase Common

## A. Skill Loading

Some content.

<!-- cyberpunk:start:section-e -->
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

## F. RTK Routing

Prefer `rtk` for broad shell inspection and verbose command output when a compact CLI proxy is enough (for example: directory listings, trees, long git/gh output, or noisy test output).

- Keep using narrow file tools like `Read`, `Grep`, and `Glob` for targeted file/content inspection.
- Use `context-mode` / `ctx_*` tools only when you need heavy sandboxed processing, indexed follow-up questions, or the output would otherwise be genuinely large.
- If `rtk` is unavailable or a command is unsupported, fall back to the normal tool path.
<!-- cyberpunk:end:section-e -->
