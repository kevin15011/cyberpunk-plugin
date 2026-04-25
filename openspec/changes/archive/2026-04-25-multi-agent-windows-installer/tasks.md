# Tasks: Multi-Agent Windows Installer

## Phase 1: Domain Model + Platform Detection (no agent unknowns)

- [x] 1.1 RED: `tests/domain-environment.test.ts` — assert all discriminated unions (`AgentTarget`, `PlatformInfo.kind`, `ShellInfo.kind`, `ComponentCapability`, `DetectionResult`, `Recommendation`) compile and enforce exhaustiveness via `bun test`.
- [x] 1.2 GREEN: Create `src/domain/environment.ts` exporting the interfaces/contracts from design §Interfaces. Acceptance: `bun test tests/domain-environment.test.ts` passes, `tsc --noEmit` clean.
- [x] 1.3 RED: `tests/platform-detect.test.ts` — shim `process.platform` to `win32`, verify `detectEnvironment()` returns `windows`; shim linux+`/proc/version` with "microsoft", verify `wsl`; verify `darwin`, `linux` unchanged.
- [x] 1.4 GREEN: Extend `src/platform/detect.ts` — add `"windows"` to `DetectedEnvironment`, return `"windows"` when `process.platform === "win32"`, update `getPlatformLabel`/`getPlaybackDependency`. Acceptance: tests green, existing tests still pass.
- [x] 1.5 RED: `tests/platform-paths.test.ts` — assert Windows shims (`APPDATA`/`LOCALAPPDATA`/`USERPROFILE`) produce correct config/home roots; assert POSIX unchanged.
- [x] 1.6 GREEN: Create `src/platform/paths.ts` — `getConfigRoot(platform)`, `getHomeDir(platform)`, Windows-aware path joins. Acceptance: tests green.
- [x] 1.7 RED: `tests/platform-shell.test.ts` — assert `detectShell()` returns `"powershell"`/`"cmd"` on Windows shims, `"bash"`/`"zsh"` on POSIX.
- [x] 1.8 GREEN: Create `src/platform/shell.ts` — `ShellInfo` detection, `buildCommand()` descriptor replacing raw `which`/shell redirects. Acceptance: tests green.

## Phase 2: Detection Registry + OpenCode Detector

- [x] 2.1 RED: `tests/detection-registry.test.ts` — assert registering an `AgentDetector` returns installed/version/path for OpenCode via shimmed `execSync`.
- [x] 2.2 GREEN: Create `src/detection/types.ts` (`AgentDetector` interface), `src/detection/registry.ts` (`detectAgents` iterating detectors), `src/detection/agents/opencode.ts` (probe `opencode --version`). Acceptance: tests green, existing doctor/platform tests unaffected.
- [x] 2.3 RED: `tests/detection-recommend.test.ts` — given OpenCode+RTK prerequisites met, recommend `rtk` as `install`; given missing prereqs, recommend `defer` with reason.
- [x] 2.4 GREEN: Create `src/detection/recommend.ts` — filter capabilities by target/platform, produce `Recommendation[]`. Acceptance: tests green.

## Phase 3: Component Adapters + Config v2

- [x] 3.1 RED: `tests/component-adapter.test.ts` — assert `getCapabilities("rtk")` returns `targets: ["opencode"]`, `platforms: ["linux","wsl","darwin"]`; assert plugin `targets: ["opencode"]`.
- [x] 3.2 GREEN: Add `ComponentCapability` to `src/components/types.ts`; create `src/components/registry.ts` with static capability map for all 6 components. Acceptance: tests green.
- [x] 3.3 RED: `tests/config-v2.test.ts` — load v1 JSON, assert `normalizeConfig()` adds `target: "opencode"`, `profile: undefined`, missing components get defaults; v2 JSON loads unchanged.
- [x] 3.4 GREEN: Extend `src/config/schema.ts` with v2 fields (`target`, `profile`, `agentState`); update `src/config/load.ts` — `normalizeConfig()` reads v1 without destructive rewrite. Acceptance: tests green, `bun test` full suite green.

## Phase 4: CLI Flags + Command Routing

- [x] 4.1 RED: `tests/parse-args-target.test.ts` — assert `--target claude` parsed, `--profile admin` parsed, `--mode guided` parsed; assert unknown target errors.
- [x] 4.2 GREEN: Add `target`, `profile`, `mode` to `ParsedArgs` in `src/cli/parse-args.ts`; parse new flags, default `target: "opencode"`. Acceptance: tests green, existing parse-args tests green.
- [x] 4.3 Modify `src/commands/install.ts` — accept optional `DetectionResult`, filter components by compatibility, dry-run output for `--check`. Preserve current behavior when target is `"opencode"`.
- [x] 4.4 Modify `src/commands/doctor.ts` — call detection registry, report per-agent state, keep existing OpenCode checks backward-compatible.
- [x] 4.5 Modify `src/commands/status.ts` — show platform + detected agents alongside component status.

## Phase 5: Claude/Codex Safe Detection

- [x] 5.1 RED: `tests/detection-claude.test.ts` — assert Claude probe returns `installed` when binary shim present, `unsupported` when absent, `unknown` on error.
- [x] 5.2 GREEN: Create `src/detection/agents/claude.ts` — conservative probe, never throws, always returns `installed`|`unsupported`|`unknown`.
- [x] 5.3 RED: `tests/detection-codex.test.ts` — assert Codex probe always returns `unknown` with rationale.
- [x] 5.4 GREEN: Create `src/detection/agents/codex.ts` — stub returning `unknown` per spec "cannot be verified safely". Acceptance: tests green.

## Phase 6: Windows Build + Installer

- [x] 6.1 RED: `tests/build-windows.test.ts` — assert `build.ts` produces `cyberpunk.exe` when `--target-platform windows` flag passed; assert Linux/macOS builds unchanged.
- [x] 6.2 GREEN: Modify `build.ts` — accept `--target-platform`, output `cyberpunk.exe` for windows, current binary for linux/darwin.
- [x] 6.3 RED: `tests/install-ps1.test.ts` — assert `install.ps1` contains URL placeholder, PATH guidance, execution-policy check, and safe failure text.
- [x] 6.4 GREEN: Create `install.ps1` — PowerShell download+install script with execution-policy guard and remediation messages.

## Phase 7: Component Migration + TUI Copy

- [x] 7.1 Modify `src/components/platform.ts` — replace `isOnPath("which")` with `shell.ts` lookup; add Windows playback dependency.
- [x] 7.2 Migrate each component (`plugin.ts`, `theme.ts`, `sounds.ts`, `context-mode.ts`, `rtk.ts`, `tmux.ts`) to use `paths.ts` helpers instead of raw `~`/`homedir()`.
- [x] 7.3 Modify `src/tui/screens/install.ts` — environment-first flow, professional English, guided/advanced modes.
- [x] 7.4 Modify `src/tui/screens/doctor.ts` — show agent state and compatibility rationale per spec.
- [x] 7.5 Run `bun test` full suite + `tsc --noEmit` — all green, no regressions.
