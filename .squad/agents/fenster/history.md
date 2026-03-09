# Project Context

- **Owner:** Rick
- **Project:** typespec-rust — TypeSpec Rust emitter that generates Rust SDK client code from TypeSpec API specifications
- **Stack:** TypeScript (emitter), Rust (generated output), Node.js >= 20, pnpm, Vitest
- **Goal:** Achieve 100% Spector test coverage
- **Created:** 2026-03-06

## Architecture

- Generated Rust code lives under `packages/typespec-rust/test/`
- `test/spector/` — Spector integration test crates
- `test/sdk/` — SDK test crates
- `test/other/` — Targeted test crates
- CI runs `cargo clippy` and `cargo build` on all generated crates
- The emitter runs `cargo fmt` post-codegen if Rust toolset is installed

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-06: Spector Coverage Gap Analysis & Sprint Plan

**Briefing from Keaton's gap analysis:**
- **Current coverage:** 99/122 scenarios (81%). 23 gaps identified.
- **Tier 2 (infrastructure validation sprint):** Multipart, streaming, file handling. Your generated Rust code likely already handles these. Need validation that:
  - Multipart test crate generates cleanly and passes Spector validation
  - Streaming (jsonl) test crate compiles and behaves correctly
  - File type handling generates valid Rust code
- **Tier 3 includes status-code-range:** This will require extending the status code handling in generated Rust (currently only specific codes, not ranges).
- **Timeline:** 4-sprint roadmap to 100%. Tier 2 is Sprint 2 (after Tier 1 easy wins).

**Action item for you:** After Tier 1 (easy wins) completes, please validate that the existing multipart/streaming/file infrastructure in generated code compiles cleanly and integrates with Spector test patterns. This unblocks Sprint 2.

### 2026-03-06: Sprint 1 Results — Tier 2 Scope Update for Fenster

**From:** McManus (Emitter Dev)
**About:** Sprint 1 easy-win execution completed; 7 of 10 scenarios succeeded

**For Fenster's Sprint 2 work:**
McManus wired up 7 Spector scenarios successfully. The 3 that failed share a common blocker (non-discriminated union support not yet in emitter). These 3 plus non-discriminated union architecture work are moving to Sprint 2 scope.

**Fenster's validated infrastructure (Tier 2):**
- **Multipart handling** — Emitter infrastructure exists; needs validation that it compiles cleanly and integrates with Spector patterns
- **Streaming (jsonl)** — Emitter infrastructure exists; needs validation that it behaves correctly
- **File type handling** — Emitter infrastructure exists; needs Spector integration validation

**Action for Fenster (post-Sprint 1, pre-Sprint 2 team review):**
Please validate that the existing multipart/streaming/file infrastructure in generated Rust code compiles cleanly and passes basic validation. This is critical for Sprint 2 planning — if the infrastructure is production-ready, Tier 2 could move quickly. If there are gaps, flag them early so Keaton can scope the work.

**New crate visibility:**
7 new Spector test crates were added on branch `squad/sprint1-spector-easy-wins`. When this lands, you'll have 105 total Spector crates (vs 98 baseline) with additional integration test coverage to work with.

**Full report:** `.squad/orchestration-log/2026-03-06T0215-mcmanus.md`

### 2026-03-06: Sprint 1 Rust Quality Review — 7 New Spector Crates

**Reviewed on branch:** `squad/sprint1-spector-easy-wins`

**Overall verdict:** All 7 crates pass static analysis review. Code quality is excellent. No blocking issues found.

**Crate-by-crate summary:**

1. **authentication/noauth/union** — ✅ Clean. Dual auth pattern (token + no-auth) correctly implemented. SafeDebug, proper visibility, idiomatic async.
2. **documentation** — ✅ Clean. Rich doc comment testing (bold, italic, bullet points, numbered lists). Enum serde split correctly into separate files. Model + request wrapper pattern correct.
3. **encode/array** — ✅ Clean. 12 array encoding variants (comma/newline/pipe/space × string/enum/extensible-enum). Serde derives correct, enum serde delegation pattern solid.
4. **parameters/query** — ✅ Clean. Minimal crate, constant query param hardcoded correctly. Sub-client factory pattern correct.
5. **type/model/inheritance/recursive** — ✅ Clean. `Option<Vec<Extension>>` is valid — `Vec<T>` provides heap indirection, no `Box` needed. (Explore agent false-flagged this.)
6. **azure/client-generator-core/access** — ✅ Excellent. Most complex crate. Access control (pub vs pub(crate)) precisely correct across 4 sub-modules. Internal operations, models, and options all properly gated. Discriminated union with `AbstractModel` enum + `UnknownKind` variant for forward compatibility. Manual serde serialization correct.
7. **azure/client-generator-core/client-default-value** — ✅ Clean. Default values handled as `Option<T>` with defaults applied client-side (options struct). Path parameter validation with empty-string checks is good practice.

**Patterns confirmed good:**
- `SafeDebug` instead of `Debug` on all client/options structs (prevents credential leaks)
- `pub(crate)` on client struct fields (endpoint, pipeline)
- Serde separated from core types (enums.rs / enums_serde.rs / enums_impl.rs)
- `#[non_exhaustive]` on output-only and Azure-namespace models
- `#[tracing::client]`, `#[tracing::function]`, `#[tracing::subclient]` consistently applied
- `#[allow(clippy::module_inception)]` used where justified

**Pre-existing pattern noted (not a regression):**
- Empty doc comment summaries (`///\n/// # Arguments`) when TypeSpec operations have no description. Cosmetic, not blocking. Pervasive across entire codebase.

**Compilation check:** Could not run `cargo check`/`cargo clippy` due to environment restrictions on cargo execution. Static analysis only. CI pipeline will confirm compilation.

**Next steps:** Validate multipart/streaming/file infrastructure for Sprint 2 readiness.

---

### 2026-03-07: USER DIRECTIVES — Generated Code Policy & Clippy Pre-Submit

**From:** Rick (via Copilot)
**Critical for Rust quality work**

Two new directives for all generated code review and quality work:

1. **No hand-editing of generated code.** Issues in generated Rust (including clippy violations) must be addressed via:
   - Emitter TypeScript changes (codegen files)
   - client.tsp directives
   - NEVER by hand-editing the generated Rust output

2. **Clippy before submit — mandatory.** Always verify `cargo clippy --workspace` passes zero warnings before code reviews or approvals. This is a hard CI requirement.

When you review generated code quality (like the Sprint 1 Spector crates), you should verify clippy compliance as part of your sign-off. If issues are found, work with McManus to fix them in the emitter, then regenerate and re-verify.

### 2026-03-09: pub(crate) Visibility Design & DEFAULT Constants Fix

**Context:** PR #887 review flagged issues with `clients.ts` constant emission. McManus's dead_code fix over-corrected by suppressing constant emission when `constructable.suppressed === 'yes'`. Keaton designed the proper fix.

**Implementation (by Fenster, per Reviewer Rejection Protocol):**
- Removed the `if (!isSuppressed)` guard in `clients.ts` — constants are now ALWAYS emitted
- Added conditional `#[allow(dead_code)]` only for suppressed options types (SDK crate pattern)
- Non-suppressed crates use intra-doc links; suppressed crates use plain text doc comments
- Added rich doc comments on suppressed constants explaining SDK author usage pattern

**Key design patterns learned:**
1. `pub(crate)` types are NOT dead in real SDKs — they're called by hand-authored convenience methods. The `_touch_*` pattern or unit tests serve as exerciser in test crates.
2. `#[allow(dead_code)]` is acceptable on convenience constants that SDK authors MAY use, but should NEVER be applied as a blanket suppression on generated types.
3. When `constructable.suppressed === 'yes'`, the options type doesn't exist in generated code — SDK authors provide their own. Constants must still be emitted so they can reference TypeSpec-defined defaults.
4. Intra-doc links (`[`TypeName::field`]`) must not be used when the referenced type doesn't exist (suppressed). Use backtick-only references instead.

**Verification:** Build clean, 32/32 TypeScript tests pass, cargo clippy zero warnings across full workspace.

