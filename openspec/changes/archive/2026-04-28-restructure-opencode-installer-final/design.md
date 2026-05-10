# Design: Restructure OpenCode Installer — Final macOS OpenCode Polish

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Target order | Finish macOS + OpenCode before any other target/tool | User validated this machine and found SDD still pending |
| SDD readiness | Add an OpenCode SDD readiness manifest and detector | A single `sdd-phase-common.md` check is a false positive |
| Missing SDD assets | Skip/mark unavailable with explicit missing paths | Honest status beats pretending integration is complete |
| Presets | Remove `theme`/`sounds` from normal presets | Aesthetic components must be opt-in except Full |
| codebase-memory tests | Isolate executable lookup from real user `PATH` | Verification must be deterministic on this Mac |
| Doctor repair UI | Re-run diagnostics after repair before rendering completed state | Stale cached doctor output is misleading after fixes |
| Process navigation | Add one-key Home/root shortcut on completed process screens | Avoid repeated Esc through nested install/uninstall/repair phases |
| Telemetry | Remove OTEL and telemetry capture as supported install features | The kit should not present OTEL/plugin/collector/metrics capture as installable scope |
| MCP naming | Canonical OpenCode MCP key is `codebase-memory` only | User config has duplicate `codebase-memory` and `codebase-memory-mcp` entries pointing to the same binary |

## OpenCode SDD Readiness Manifest

Required files, discovered from current OpenCode SDD skill conventions and the file patched by `src/components/sdd-integration.ts`:

- `~/.config/opencode/skills/_shared/sdd-phase-common.md` — patched by `sdd-integration`.
- `~/.config/opencode/skills/sdd-propose/SKILL.md`
- `~/.config/opencode/skills/sdd-spec/SKILL.md`
- `~/.config/opencode/skills/sdd-design/SKILL.md`
- `~/.config/opencode/skills/sdd-tasks/SKILL.md`
- `~/.config/opencode/skills/sdd-apply/SKILL.md`
- `~/.config/opencode/skills/sdd-review/SKILL.md`
- `~/.config/opencode/skills/sdd-verify/SKILL.md`
- `~/.config/opencode/skills/sdd-archive/SKILL.md`

Optional but reportable if present/missing: `sdd-init`, `sdd-explore`, `sdd-onboard`, `sdd-claude-review`.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/sdd-integration.ts` | Modify | Add readiness detector, missing asset messages, status/doctor/install gating. |
| `src/commands/status.ts`, `src/commands/preflight.ts`, `src/commands/doctor.ts` | Modify | Surface SDD readiness and missing files consistently. |
| `src/presets/definitions.ts` | Modify | Remove `theme`/`sounds` from normal presets; keep them in `cyberpunk-full`; Custom remains explicit. |
| `src/components/codebase-memory.ts` | Modify | Make executable resolution testable/deterministic and prefer explicit home-local path. |
| `src/tui/screens/{install,uninstall,doctor,results,result-detail}.ts`, `src/tui/app.ts`, `src/tui/router.ts` | Modify | Refresh doctor results after repair and add one-key Home/root shortcut on completed flows. |
| `src/components/otel.ts`, `src/components/otel-collector.ts`, component registry/presets/CLI/help/status/preflight/doctor modules | Modify/Delete | Remove OTEL/collector/telemetry capture from supported install surfaces; retain safe uninstall cleanup only if needed. |
| `src/components/codebase-memory.ts`, `src/commands/doctor.ts` | Modify | Normalize duplicate legacy `codebase-memory-mcp` MCP key to canonical `codebase-memory`; command remains absolute executable path. |
| `README.md`, relevant docs/spec notes | Modify | Remove OTEL feature docs and add legacy cleanup guidance. |
| `tests/sdd-integration.test.ts` | Modify | Cover readiness satisfied/missing/partial and install skip behavior. |
| `tests/codebase-memory.test.ts` | Modify | Isolate `PATH` and fake binary lookup from the host machine. |
| `tests/presets*.test.ts`, `tests/tui-*.test.ts`, `tests/doctor-scenarios.test.ts`, `tests/preflight.test.ts` | Modify | Assert aesthetics/OTEL policy, TUI refresh/navigation, and MCP duplicate cleanup. |

## Contracts

- `detectOpenCodeSddReadiness()` returns `{ ready, required, missingRequired, optionalMissing }`.
- Install of `sdd-integration` MUST patch only when `ready === true`; otherwise return `skipped` with missing required paths.
- Doctor/status MUST not emit pass for SDD integration when readiness is incomplete.
- Normal presets: `minimal`, `token-saver-general`, `token-saver-dev`, `developer-toolkit` MUST NOT include `theme` or `sounds`.
- TUI doctor repair MUST re-run diagnostics or refresh the report immediately after fixes; completed process screens MUST offer a one-key return Home/root action.
- `otel`, `otel-collector`, telemetry env vars, OTEL plugin registration, and metrics capture MUST NOT appear as installable supported features in CLI/TUI/docs/tests. Safe uninstall cleanup MAY remove legacy marker-managed env/config/plugin/service entries.
- `codebase-memory` is the only supported OpenCode MCP key. If both `codebase-memory` and `codebase-memory-mcp` exist and point to `/Users/kevinlondono/.local/bin/codebase-memory-mcp`, repair MUST keep only `codebase-memory` with that absolute command.
- macOS + OpenCode validation is the gate before any further target/tool work.
