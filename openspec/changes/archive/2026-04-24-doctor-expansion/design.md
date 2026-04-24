# Design: Doctor Expansion

## Technical Approach

Extend the existing `runDoctor()` aggregation path instead of changing the doctor contract. New diagnostics stay inside the current component-oriented model: platform/runtime checks remain centralized in `src/commands/doctor.ts` + `src/components/platform.ts`, component drift stays in each component `doctor()` hook, and `--fix` continues to call explicit safe repair handlers only. Human-readable output is upgraded in `src/cli/output.ts`; `formatDoctorJson()` remains unchanged so the JSON contract stays `DoctorResult[]`.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Where to add new checks | New rules engine; inline checks in `doctor.ts`; extend existing doctor hooks | Extend current platform/component hooks | Matches repo architecture, minimizes blast radius, preserves test seams already used in `tests/doctor*.test.ts`. |
| How to represent grouped text output | Change `DoctorRunResult`; derive from flat `checks`; reuse `results` | Reuse `results` for grouping, keep flat `checks` for summaries/fixes | Avoids JSON/schema churn while enabling grouped text sections and next-step summaries. |
| Repair scope | Add installers/bootstrap; patch only managed files; attempt broad auto-heal | Patch only already-managed files/config entries | Proposal explicitly excludes bootstrap redesign; existing safe repairs already use atomic writes and managed markers. |

## Data Flow

`doctor` command
  → `runDoctor()` builds `DoctorContext`
  → platform checks (`platform.ts` + command-level runtime checks)
  → component `doctor(ctx)` hooks (`plugin`, `sounds`, etc.)
  → optional `--fix` dispatches explicit handlers
  → summary counts from flat `checks`
  → text output groups by `results` and derives next steps

Sequence for `doctor --fix`:

1. Collect read-only checks.
2. Mark only supported drift checks as `fixable`.
3. Run existing safe repair handlers in stable order.
4. Mark successful checks as `fixed`.
5. Render grouped text plus “next actions”; JSON stays unchanged.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/types.ts` | Modify | Add optional metadata for doctor output grouping/next-step rendering without breaking existing consumers. |
| `src/platform/detect.ts` | Modify | Expose lightweight environment labels/helpers reused by doctor messaging. |
| `src/components/platform.ts` | Modify | Add platform-aware playback/OpenCode/runtime presence checks and guidance text. |
| `src/commands/doctor.ts` | Modify | Wire new checks, classify fixability, and compute grouped/actionable summary data. |
| `src/components/plugin.ts` | Modify | Detect installed plugin source drift against `PLUGIN_SOURCE`; allow repair only when target file is the managed bundled install path. |
| `src/components/sounds.ts` | Modify | Add basic sound validity checks (missing/empty/invalid header) and reuse regeneration logic for repairable cases. |
| `src/cli/output.ts` | Modify | Replace monolithic table-only doctor text with per-component sections, platform-aware hints, repair recap, and next-step summary. |
| `tests/doctor.test.ts` | Modify | Cover summary derivation and safe fix orchestration for new checks. |
| `tests/doctor-scenarios.test.ts` | Modify | Cover output grouping, plugin drift, sound validity, and JSON stability. |

## Interfaces / Contracts

```ts
interface DoctorCheck {
  id: string
  label: string
  status: "pass" | "fail" | "warn"
  message: string
  fixable: boolean
  fixed?: boolean
  detail?: { group?: string; nextStep?: string }
}
```

`detail` is text-only metadata. `formatDoctorJson()` continues to emit the same top-level `DoctorResult[]` shape; added fields are additive and optional.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Platform detection/guidance, plugin source drift, sound validity classification | Extend Bun tests with temp-home fixtures and PATH control. |
| Unit | `--fix` safety boundaries | Verify only managed/plugin-bundled files are rewritten; foreign files stay report-only. |
| Unit | Text output improvements | Snapshot/assert grouped sections, action summary, and stable JSON output. |

## Migration / Rollout

No migration required. Rollout is a normal code release because config schema and JSON doctor output remain backward compatible.

## Open Questions

- [ ] Sound validity should use a minimal WAV header/size check only; full audio decoding is intentionally out of scope for this slice.
