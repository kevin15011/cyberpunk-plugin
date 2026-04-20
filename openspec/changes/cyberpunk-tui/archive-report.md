# Archive Report: cyberpunk-tui

**Change**: cyberpunk-tui  
**Project**: cyberpunk-plugin  
**Archive Date**: 2026-04-20  
**Status**: PASS (verified)  

---

## Summary

Replaced the monolithic `install.sh` + fat `cyberpunk.ts` plugin with a compiled CLI binary (`cyberpunk`) featuring an interactive TUI for managing components. The OpenCode plugin was refactored to a slim runtime-only module that handles only sound playback on events.

### What was built

- **CLI binary** (`cyberpunk`) compiled via `bun build --compile` — standalone, zero runtime deps
- **Interactive TUI** using `@clack/prompts` with cyberpunk-themed ANSI colors, component toggles, and keyboard navigation
- **4 installable components**: plugin, theme, sounds, context-mode — each with `install()`, `uninstall()`, `status()`
- **Persistent config** at `~/.config/cyberpunk/config.json` with atomic writes
- **Non-interactive flags**: `--install`, `--uninstall`, `--status`, `--upgrade`, `--json`
- **Bootstrap script** (`install.sh`) downloads release binary from GitHub Releases
- **Automated test suite**: 33 tests across 4 files, all passing
- **Refactored plugin** (`cyberpunk.ts`): reduced from ~700 lines to ~40 lines, runtime-only (sound playback on events)

---

## Final Task Status

### Completed (23/28)

| Phase | Tasks |
|-------|-------|
| **Bootstrap** | `package.json`, `tsconfig.json`, `build.ts`, `src/` structure |
| **Core CLI** | Config schema/load/save, argv parser, output formatter, entry point, config command, status command |
| **TUI** | Cyberpunk theme constants, interactive menu with `@clack/prompts` |
| **Components** | Types interface, plugin/theme/sounds/context-mode modules, install command, upgrade command |
| **Build** | Binary compilation verified |
| **Refactor** | `cyberpunk.ts` slimmed to runtime-only, sound playback verified |

### Deferred (5/28)

| Task | Reason |
|------|--------|
| `cyberpunk-plugin.ts` bundling wired to `src/components/plugin.ts` | File exists but is stale (references `.m4a`); component still inlines plugin source. Technical debt for future cleanup. |
| `install.sh` task checkbox unchecked | Implementation already downloads release binary; task tracking not updated. Cosmetic issue. |
| tmux as fifth component | Open question — user preference needed on whether tmux config belongs in CLI |
| CI strategy (GitHub Actions vs manual) | Open question — deferred until release distribution is needed |
| CLI self-update strategy | Open question — deferred until versioning scheme is established |

---

## Decisions Made During Implementation

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build target | `bun build --compile` | Single-file binary, zero runtime deps, project already uses Bun |
| TUI framework | `@clack/prompts` | Lightweight, same ecosystem as OpenCode, no native deps |
| CLI parsing | Manual `process.argv` | Only 6 commands — keeps binary small, no extra dependency |
| Config format | JSON at `~/.config/cyberpunk/config.json` | Native to TS, no parser dep, matches OpenCode convention |
| Sound format | `.wav` files (not `.m4a`) | Active runtime/plugin path uses `.wav`; `cyberpunk-plugin.ts` still references `.m4a` (stale) |
| Plugin refactor scope | Strip install/config, keep event handlers only | Plugin must never write files or patch config on OpenCode load |
| Migration approach | Coexistence — no forced migration | Both old and new paths work; `cyberpunk upgrade` replaces fat plugin |

---

## Open Questions (Deferred)

1. **tmux component**: Should `tmux.conf` become a fifth component (`tmux`) or remain outside the CLI?
2. **CI strategy**: GitHub Actions auto-build binaries on release, or manual build process?
3. **Self-update**: Should `cyberpunk upgrade` update the CLI binary itself, or only update components?

---

## Verification Summary

- **Tests**: ✅ 33 pass, 0 fail (4 test files)
- **Build**: ✅ Binary compiles successfully
- **Type check**: ✅ `tsc --noEmit` exits 0
- **Runtime verification**: ✅ All non-interactive flags work correctly
- **Previously critical issues**: ✅ All 7 resolved
- **Verdict**: **PASS**

---

## Final File Structure

```
cyberpunk-plugin/
├── src/
│   ├── index.ts                    # CLI entry: argv parse → command dispatch
│   ├── cli/
│   │   ├── parse-args.ts           # argv parser → typed command object
│   │   └── output.ts               # format output (text vs --json)
│   ├── tui/
│   │   ├── index.ts                # Interactive TUI with @clack/prompts
│   │   └── theme.ts                # Cyberpunk ANSI color constants
│   ├── commands/
│   │   ├── install.ts              # Orchestrates component install/uninstall
│   │   ├── status.ts               # Collects status from all components
│   │   ├── upgrade.ts              # Git-based upgrade logic
│   │   └── config.ts               # Config get/set/list/init
│   ├── components/
│   │   ├── types.ts                # ComponentId, InstallResult, Component interfaces
│   │   ├── plugin.ts               # OpenCode plugin install
│   │   ├── theme.ts                # Theme JSON + tui.json activation
│   │   ├── sounds.ts               # ffmpeg sound generation (.wav)
│   │   └── context-mode.ts         # npm install -g + routing instructions
│   └── config/
│       ├── schema.ts               # CyberpunkConfig interface + defaults
│       ├── load.ts                 # Read + parse config, auto-create if missing
│       └── save.ts                 # Atomic write: .tmp then rename
├── tests/
│   ├── parse-args.test.ts          # CLI argument parsing tests
│   ├── config.test.ts              # Config load/save tests
│   ├── components.test.ts          # Component status tests
│   └── upgrade.test.ts             # Upgrade command tests
├── cyberpunk.ts                    # Refactored OpenCode plugin (runtime only, ~40 lines)
├── cyberpunk-plugin.ts             # Bundled plugin source (stale, deferred wiring)
├── install.sh                      # Bootstrap: downloads binary from GitHub Releases
├── build.ts                        # Build script: bun build --compile
├── package.json                    # Dependencies: @clack/prompts
├── tsconfig.json                   # TS config: ESNext, moduleResolution bun
├── openspec/                       # SDD specs, proposal, design, tasks, reports
└── cyberpunk                       # Compiled binary (gitignored)
```

### Git Summary

- **Modified**: `cyberpunk.ts` (-676 lines, slimmed to runtime-only), `install.sh` (rewritten for binary download)
- **New files**: 17 source files in `src/`, 4 test files, `build.ts`, `cyberpunk-plugin.ts`, `package.json`, `tsconfig.json`, `openspec/` directory
- **Net change**: ~716 lines removed from `cyberpunk.ts`, ~33 lines added to `install.sh`, ~2000+ new lines across new files
