# Project Context

- **Owner:** Rick
- **Project:** typespec-rust — TypeSpec Rust emitter that generates Rust SDK client code from TypeSpec API specifications
- **Stack:** TypeScript (emitter), Rust (generated output), Node.js >= 20, pnpm, Vitest
- **Goal:** Achieve 100% Spector test coverage
- **Created:** 2026-03-06

## Architecture

- `/packages/typespec-rust/src/emitter.ts` — Entry point
- `/packages/typespec-rust/src/tcgcadapter/` — TypeSpec→Crate Model bridge
- `/packages/typespec-rust/src/codemodel/` — Rust code model (AST)
- `/packages/typespec-rust/src/codegen/` — Rust code generation
- `/packages/typespec-rust/test/spector/` — Spector integration test crates
- `/packages/typespec-rust/test/tsp/` — TypeSpec files for test generation

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-07-18: Spector Coverage Gap Analysis

- **Coverage status:** 99/122 Spector scenarios covered (81%). 23 gaps identified.
- **Spec sources:** HTTP specs live in `microsoft/typespec` at `packages/http-specs/specs/`. Azure specs live in `Azure/typespec-azure` at `packages/azure-http-specs/specs/`.
- **Emitter is more capable than expected:** Multipart, streaming, file handling, additional properties, and doc comments are already implemented in the emitter. Many "missing" test crates just need to be wired up, not built from scratch.
- **Biggest gaps by category:** Versioning (5 missing), special-headers (2 missing, no emitter support), type/model/inheritance (2 missing), Azure TCGC (4 missing).
- **Versioning is the largest gap cluster:** 5 of 6 versioning scenarios are missing (only madeOptional exists). These likely share infrastructure.
- **Special headers are the hardest:** conditional-request and repeatability have zero emitter support. These are Sprint 4 material.
- **Key file paths for emitter capabilities:** `src/codegen/models.ts` (additionalProperties), `src/codegen/clients.ts` (streaming, status codes), `src/tcgcadapter/adapter.ts` (multipart, file handling).
- **The can-i-use page at azure.github.io is JS-rendered SPA** — cannot be scraped with simple fetch. Must cross-reference directly against upstream spec repo directories.
- **`client/enum-conflict` in our test/spector** does not map to an upstream Spector spec — it appears to be a custom/project-specific test crate.

### 2026-03-06: Sprint 1 Results — Tier 1 Recategorization & Scope Update

**From:** McManus (Emitter Dev)
**About:** Sprint 1 easy-win execution completed with 7/10 success rate

**Key finding:** Your Tier 1 "10 easy wins" should be recategorized as **"7 easy wins + 3 medium-effort scenarios"**.

**What succeeded (7 of 10):** These required zero emitter changes and are verification-ready:
- authentication/noauth, documentation, encode/array, parameters/query
- type/model/inheritance/recursive, azure/client-generator-core/access, client-default-value

**What failed (3 of 10) and why:**
1. **`type/union` (basic)** — Emitter rejects non-discriminated unions (`Cat | Dog`) at adapter.ts:969
2. **`type/property/additional-properties`** — Same union blocker hits `Record<T1 | T2>` patterns
3. **`type/model/inheritance/nested-discriminator`** — Codegen bug: produces name collision (Shark struct vs Shark enum in same scope)

**Recommended Sprint 2 scope:**
- Move all 3 failed Tier 1 scenarios to Sprint 2
- **Add non-discriminated union architecture work to Sprint 2** — blocks 2 scenarios directly, likely needed for future features
- Fenster to validate multipart/streaming/file compiles cleanly (existing Tier 2 infrastructure)

**Coverage impact:**
- Before Sprint 1: 99/122 (81%)
- After Sprint 1: 106/122 (87%) — 7 new scenarios added
- Remaining gap: 16 scenarios (was 23)

### 2026-03-07: USER DIRECTIVES — Generated Code Policy & Clippy Pre-Submit

**From:** Rick (via Copilot)
**Critical for all team members**

Two new directives affecting all emitter and generated code work:

1. **No hand-editing of generated code.** Clippy violations, compilation errors, and other issues in generated Rust must be addressed by:
   - Modifying the emitter TypeScript source (codegen files)
   - Adding/updating client.tsp directives
   - NEVER by hand-editing generated Rust files (they get overwritten on regeneration)

2. **Clippy before submit — mandatory.** Always run `cargo clippy --workspace` on generated code before pushing. CI failure due to clippy violations is a blocker.

These directives apply to all team work going forward. If you encounter generated code quality issues, escalate to McManus (or fix the emitter yourself if applicable) rather than hand-editing the output.


**Full report:** `.squad/orchestration-log/2026-03-06T0215-mcmanus.md`

### 2026-03-07: Dead Code Architecture Analysis & Proper Fix

**Investigation:** Keaton (triggered by Rick's pushback on blanket suppression)  
**Implementation:** McManus (implemented Keaton's recommendation)  
**Status:** ✅ Complete

**Context:** McManus added blanket `#[allow(dead_code)]` to ALL `pub(crate)` types via `emitDeadCodeAttribute()`. Rick rejected this as anti-pattern suppression. Keaton investigated, McManus implemented proper fix.

**Key findings (empirically verified by running clippy on each affected crate):**

1. **Only the `access` crate actually triggers dead_code warnings.** Out of 11 affected crates, only 1 fails clippy without suppressions. All others (spread, union/non-discriminated, documentation, lro, misc_tests, pub_crate, parameters/basic, core/basic, keyvault_secrets) pass cleanly.

2. **Root cause isolated in `access`:** The TypeSpec `access: "internal"` decorator correctly generates `pub(crate)` client methods. But test crates have no consumer code calling these methods, making the entire internal chain (methods → models → options) dead. In real SDKs, a public convenience layer would call internal methods.

3. **McManus over-applied the suppression:** `emitDeadCodeAttribute()` annotates ALL `pub(crate)` types (~40+ items), but `pub(crate)` types used by `pub` methods are NOT dead — Rust traces reachability from public API. Only types exclusively used by `pub(crate)` methods with no callers are dead.

4. **Pre-existing `#[allow(dead_code)]` on `pub(crate) const` (clients.ts:286) was also unnecessary.** Constants are used in `Default` impls and pass clippy without annotation.

**Implementation (McManus):**

1. Reverted `emitDeadCodeAttribute()` from helpers.ts and all 6 call sites in models.ts, unions.ts, clients.ts. Zero suppressions in generated code.

2. Added exercising code to `test/tsp/azure/client-generator-core/access/src/lib.rs` using pattern: `const _: () = { fn _touch_() { drop(method()); } }` for all 6 `pub(crate)` methods.

3. Fixed orphan constant bug: when options are suppressed, emitter now skips const emission (`constructable.suppressed === 'yes'`). Affected `keyvault_secrets`.

**Verification:**
- ✅ `pnpm build` — 0 errors
- ✅ `pnpm test` — 32/32 passing  
- ✅ `cargo clippy --workspace --all-features --all-targets --keep-going --no-deps` with `RUSTFLAGS='-Dwarnings'` — Zero warnings across entire workspace
- ✅ 15 test crates regenerated, all passing

**Team Lesson (documented in decisions.md):**

**POLICY: Never use blanket `#[allow(dead_code)]` in generated code. Fix the root cause instead.**

- If code shouldn't exist → fix the emitter to not generate it
- If code should exist → exercise it in test code  
- Suppress only as last resort (crate-level, for legitimate architectural reasons)

Dead code is a real signal. Blanket suppression hides bugs in production SDKs.

**Related docs:**
- Orchestration: `.squad/orchestration-log/2026-03-07T0145-keaton.md` (investigation)
- Orchestration: `.squad/orchestration-log/2026-03-07T0230-mcmanus.md` (implementation)
- Session log: `.squad/log/2026-03-07-dead-code-fix.md`
- Decision: `.squad/decisions/decisions.md` → 2026-03-07T01:45Z entry
