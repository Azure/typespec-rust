# Project Context

- **Owner:** Rick
- **Project:** typespec-rust — TypeSpec Rust emitter that generates Rust SDK client code from TypeSpec API specifications
- **Stack:** TypeScript (emitter), Rust (generated output), Node.js >= 20, pnpm, Vitest
- **Goal:** Achieve 100% Spector test coverage
- **Created:** 2026-03-06

## Architecture

- `/packages/typespec-rust/src/emitter.ts` — Entry point ($onEmit)
- `/packages/typespec-rust/src/tcgcadapter/adapter.ts` — Main TypeSpec→Rust conversion
- `/packages/typespec-rust/src/tcgcadapter/naming.ts` — Naming conventions
- `/packages/typespec-rust/src/codemodel/types.ts` — Type definitions
- `/packages/typespec-rust/src/codemodel/method.ts` — Method models
- `/packages/typespec-rust/src/codemodel/client.ts` — Client models
- `/packages/typespec-rust/src/codegen/codeGenerator.ts` — Main generator orchestrator
- `/packages/typespec-rust/src/codegen/models.ts` — Struct/model generation
- `/packages/typespec-rust/src/codegen/clients.ts` — Client generation
- `/packages/typespec-rust/src/codegen/enums.ts` — Enum generation
- `/packages/typespec-rust/src/codegen/unions.ts` — Union/discriminator generation

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-06: Spector Coverage Gap Analysis & Sprint Plan

**Briefing from Keaton's gap analysis:**
- **Current coverage:** 99/122 scenarios (81%). 23 gaps identified.
- **Tier 1 (10 easy wins):** Test-crate work only. Your emitter changes likely already support these (doc comments, additional properties, union/basic, nested discriminators, recursive models, TCGC access/client-default-value). Estimate: 1-2 days each.
- **Tier 2 (3 infrastructure validation):** Multipart, streaming, file handling. Emitter infrastructure exists; need validation that they wire up correctly for Spector patterns.
- **Tier 3 (8 medium effort):** Versioning (5 missing), status-code-range, TCGC hierarchy/override. Partial emitter support. Estimate: 2-5 days each.
- **Tier 4 (2 hard):** conditional-request, repeatability headers. Zero emitter support. Estimate: 3-7 days each.
- **Timeline:** 4-sprint roadmap to 100%. Verification needed on Tier 1 readiness.

**Action item for you:** Please confirm that Tier 1 scenarios (authentication/noauth, documentation, encode/array, parameters/query, property/additional-properties, union/basic, recursive, nested-discriminator, TCGC access, TCGC client-default-value) have full emitter support and don't require code changes. This unlocks Sprint 1 immediately.

### 2026-03-06: Sprint 1 Execution — 7 of 10 Easy Wins Landed

**What I did:** Wired up 10 Spector scenarios from the Sprint 1 easy-win list. 7 succeeded, 3 failed.

**Succeeded (7 scenarios — all compile cleanly, zero emitter changes needed):**
1. `authentication/noauth` → `spector_noauth` (httpSpecs: `authentication/noauth/union`)
2. `documentation` → `spector_documentation` (httpSpecs: `documentation`)
3. `encode/array` → `spector_encarray` (httpSpecs: `encode/array`)
4. `parameters/query` → `spector_query` (httpSpecs: `parameters/query`)
5. `type/model/inheritance/recursive` → `spector_recursive` (httpSpecs)
6. `azure/client-generator-core/access` → `spector_access` (azureHttpSpecs)
7. `azure/client-generator-core/client-default-value` → `spector_clientdefault` (azureHttpSpecs)

**Failed (3 scenarios — need emitter work, should move to Sprint 2+):**
1. `type/union` (basic) — Emitter throws `"non-discriminated unions are not supported"`. The `type/union/main.tsp` spec uses `Cat | Dog` style unions that the adapter rejects at `adapter.ts:969`. Root cause: `getType()` has no handler for non-discriminated union types.
2. `type/property/additional-properties` — Same root cause. The additional-properties spec includes `Record<WidgetData2[] | WidgetData1>` patterns that hit the non-discriminated union blocker.
3. `type/model/inheritance/nested-discriminator` — Emitter generates code but it doesn't compile. Produces both a `Shark` struct (model) and a `Shark` enum (union) in the same module scope, causing Rust name collision `E0255`. Root cause: codegen doesn't disambiguate model vs union names when a type serves as both a model and a nested discriminator.

**Key learnings about the test-crate wiring pattern:**
- The `tspcompile.js` script maps crate names to spec paths. httpSpecs go in `httpSpecsGroup`, azure specs in `azureHttpSpecsGroup`.
- Output directories mirror the spec input path by default. Use `output:` override when they differ.
- The spec looks for `client.tsp` first, falls back to `main.tsp`.
- New crates must be added to both `tspcompile.js` AND `test/Cargo.toml` workspace members.
- `cargo fmt` runs post-generation and fails if the crate isn't in the workspace yet — add workspace entry first, then regenerate.
- `noauth` spec is nested under `authentication/noauth/union/` (not directly at `authentication/noauth/`).

**Coverage update:** With 7 new scenarios, we go from 99/122 (81%) to 106/122 (87%). The 3 failed scenarios share a common blocker (non-discriminated unions) and should be grouped as a Sprint 2 priority.

**Status for team:** Orchestration log and findings documented at `.squad/orchestration-log/2026-03-06T0215-mcmanus.md`. Awaiting team decision on moving failed 3 scenarios to Sprint 2 scope.

---

### 2026-03-06: ✅ Fenster Code Review Approved

**Review by:** Fenster (Rust Expert)  
**Status:** All 7 crates APPROVED for merge

**Verdict:** All 7 new Spector crates pass static analysis review. The generated Rust code is idiomatic, correctly structured, and follows Azure SDK conventions. No blocking issues found. Ready for CI validation and merge.

**Highlights:**
- Access control exemplary (pub/pub(crate) precisely placed)
- Discriminated union handling solid (tagged unions, UnknownKind catch-all)
- Recursive types correct (Option<Vec<>> needs no Box)
- #[non_exhaustive] applied consistently

**Pre-existing issue noted (not blocker):** Empty doc comment summaries are cosmetically odd but pre-existing across dozens of files. Priority: Low.

**Next steps:** CI pipeline to confirm cargo build + clippy pass. Fenster will validate multipart/streaming infrastructure for Sprint 2 readiness.

### 2026-03-06: Clippy CI Fix — dead_code warnings on pub(crate) types

**Problem:** CI runs clippy with `RUSTFLAGS='-Dwarnings'` which treats warnings as errors. The `spector_access` crate (and other crates with `pub(crate)` types) triggered `dead_code` warnings because `pub(crate)` structs/enums are never constructed within the crate itself — they're type definitions for deserialization.

**Root cause:** The emitter generates `pub(crate)` visibility for types marked with `@access(Access.internal)` in TypeSpec specs, but didn't suppress the `dead_code` lint that Rust emits for unreferenced internal types.

**Fix:** Added `emitDeadCodeAttribute()` helper to `helpers.ts` that emits `#[allow(dead_code)]` only for `pub(crate)` visibility. Applied in 4 codegen files:
- `helpers.ts` — new helper function
- `models.ts` — marker structs + regular structs
- `unions.ts` — discriminated + untagged enums
- `clients.ts` — method options structs

**Pattern to remember:** The emitter already had this pattern at `clients.ts:286` for `pub(crate)` constants. The fix generalizes it to all `pub(crate)` type declarations. Any future code that emits `pub(crate)` items should also use `emitDeadCodeAttribute()`.

**Affected crates:** 15 regenerated files across `spector_access`, `pub_crate`, `lro`, `misc_tests`, `documentation`, `spread`, `non-discriminated`, and `body-optionality` test crates.

**Verification:** Full clippy pass with `RUSTFLAGS='-Dwarnings' cargo clippy --workspace --all-features --all-targets --keep-going --no-deps` — zero warnings across entire workspace.

---

### 2026-03-07: USER DIRECTIVES — Generated Code Policy & Clippy Pre-Submit

**From:** Rick (via Copilot)
**Status:** Captured & enforced

Two new directives affecting all future emitter work:

1. **No hand-editing of generated code.** Clippy violations, compilation errors, and other issues in generated Rust must be addressed by:
   - Modifying the emitter TypeScript source (codegen files like helpers.ts, models.ts, unions.ts, clients.ts)
   - Adding/updating client.tsp directives
   - NEVER by hand-editing generated Rust files (they get overwritten on regeneration)

2. **Clippy before submit — mandatory.** Always run `cargo clippy --workspace` on generated code before pushing. CI failure due to clippy violations is a blocker.

The fix you just implemented (emitDeadCodeAttribute) is the correct pattern: fix the emitter, regenerate, and verify clippy passes. Do not hand-edit the generated code.

### 2026-03-07: Reverted blanket #[allow(dead_code)] — Proper fix applied

**Triggered by:** Rick's rejection of blanket suppression approach  
**Investigation by:** Keaton (empirical root cause analysis)  
**Implementation by:** McManus (proper fix)  
**Status:** ✅ Complete

**What was reverted:** The `emitDeadCodeAttribute()` function in `helpers.ts` and all 6 call sites across `models.ts`, `unions.ts`, and `clients.ts`. Also the pre-existing `#[allow(dead_code)]` on `pub(crate) const` in `clients.ts`.

**Why:** Keaton's empirical analysis proved only 1 of 11 affected crates (`spector_access`) actually triggered dead_code warnings. The blanket suppression masked ~40 items unnecessarily and would hide real bugs in production SDK crates.

**Proper fix applied:**

1. **Removed all emitter-level dead_code suppression entirely.** Zero `#[allow(dead_code)]` in generated Rust code.

2. **Added exercising code in the `spector_access` crate's `lib.rs`** (non-generated test code) that calls all 6 `pub(crate)` internal methods using `drop()` pattern:
   ```rust
   const _: () = {
       fn _touch_internal_methods() {
           let _ = || {
               drop(internal_decorator_in_internal());
               // ... all 6 internal methods
           };
       }
   };
   ```
   This makes all transitive types reachable without suppressing warnings.

3. **Fixed secondary issue:** The emitter was emitting `pub(crate) const DEFAULT_API_VERSION` for suppressed client options types (e.g., `keyvault_secrets`). When the options type is suppressed, its Default impl is skipped, making the constant genuinely dead. Fixed by skipping const emission when `constructable.suppressed === 'yes'`.

**Verification:**
- ✅ `pnpm build` — 0 errors
- ✅ `pnpm test` — 32/32 passing
- ✅ `cargo clippy --workspace --all-features --all-targets --keep-going --no-deps` with `RUSTFLAGS='-Dwarnings'` — Zero warnings across entire workspace

**Lessons learned:**
- **Never suppress warnings in bulk.** Always verify empirically which items actually trigger the warning.
- **Test crate dead_code ≠ production dead_code.** Test crates are leaf crates with no public convenience layer to call `pub(crate)` methods. The exercising pattern bridges this gap without suppression.
- **Use `drop()` not `let _` for async fn returns.** Clippy's `let_underscore_future` lint catches `let _ = async_fn()` but `drop(async_fn())` is explicit and clean.
- **Suppressed options types leave orphan constants.** When the emitter suppresses a client options type, it must also suppress related artifacts that only exist to serve the suppressed type.

**Team lesson captured in decisions.md:** NEVER use blanket `#[allow(dead_code)]` in generated code. Fix the root cause instead.

**Related docs:**
- Keaton investigation: `.squad/orchestration-log/2026-03-07T0145-keaton.md`
- Implementation: `.squad/orchestration-log/2026-03-07T0230-mcmanus.md`
- Session log: `.squad/log/2026-03-07-dead-code-fix.md`

### 2026-03-07: Sprint 1 Integration Tests — All 7 Crates Tested — COMPLETE

**From:** Hockney's verification (all 7 crates missing integration tests)  
**Task:** Implement integration tests for all 7 Sprint 1 crates  
**Status:** Complete — 29 tests across 9 files

**Test implementation summary:**

All 7 crates now have integration tests following the `parameters/basic` reference pattern:

| Crate | Test File(s) | Tests | Coverage |
|-------|-------------|-------|----------|
| `spector_noauth` | `union_client_test.rs` | 2 | Valid NoAuth client, token-based operations |
| `spector_documentation` | `documentation_lists_client_test.rs`, `documentation_text_formatting_client_test.rs` | 6 | Bullet points, numbered lists, formatting |
| `spector_encarray` | `array_property_client_test.rs` | 12 | All 12 delimiter × type combinations |
| `spector_query` | `query_constant_client_test.rs` | 1 | Query constant operation |
| `spector_recursive` | `recursive_client_test.rs` | 2 | Get/put recursive extension types |
| `spector_access` | `access_public_operation_client_test.rs` | 2 | Public operations (internal ops are pub(crate)) |
| `spector_clientdefault` | `client_default_value_client_test.rs` | 4 | Header param, operation param, path param, model property |

**Pattern consistency:**

All tests use the established pattern:
- ✅ `#[tokio::test]` async functions
- ✅ Client instantiation: `with_no_credential("http://localhost:3000", None).unwrap()`
- ✅ Sub-client getters where applicable
- ✅ Body param conversion: `.try_into().unwrap()`
- ✅ Success verified by `.unwrap()` on response
- ✅ Copyright headers

**Cargo.toml updates:**

All 7 crates updated with:
```toml
[dev-dependencies]
tokio = { workspace = true }
```

**Verification:**

- ✅ `cargo clippy --workspace` with `RUSTFLAGS='-Dwarnings'` — Zero warnings
- ✅ `pnpm test` — 32/32 TypeScript tests passing (no regression)
- ✅ Git committed to `squad/sprint1-spector-easy-wins`

**Key insights for future test implementation:**

1. Test files are hand-written, not generated — single source of truth
2. `[dev-dependencies]` manual addition (emitter does not auto-generate this)
3. Mock server URL: `http://localhost:3000` (constant across all Spector tests)
4. For crates with `pub(crate)` internals (like `spector_access`), integration tests can only call public operations; internal methods are validated by the exercising pattern in lib.rs
5. Model body params typically use `.try_into().unwrap()` to create `RequestContent<T>`
6. Sub-client name arguments are `&str` not `String`

**Session log:** `.squad/log/2026-03-09-sprint1-tests.md`
**Orchestration log:** `.squad/orchestration-log/2026-03-07T0330-mcmanus.md`



**What I did:** Wrote integration tests for all 7 Sprint 1 Spector crates, following the `parameters/basic` reference pattern exactly.

**Test pattern used:**
- Each test file has the copyright header + `#[tokio::test]` async functions
- Client instantiated with `::with_no_credential("http://localhost:3000", None).unwrap()`
- Sub-clients accessed via `get_*_client()` methods
- Body parameters use `model.try_into().unwrap()` to create `RequestContent<T>`
- Options passed as `None` for default
- Success verified by `.unwrap()` on the response

**Crates and test counts:**
1. `spector_noauth` — `tests/union_client_test.rs` (2 tests: valid_no_auth, valid_token)
2. `spector_documentation` — 2 files: `tests/documentation_lists_client_test.rs` (3 tests) + `tests/documentation_text_formatting_client_test.rs` (3 tests)
3. `spector_encarray` — `tests/array_property_client_test.rs` (12 tests: comma/newline/pipe/space × plain/enum/extensible_enum)
4. `spector_query` — `tests/query_constant_client_test.rs` (1 test: post)
5. `spector_recursive` — `tests/recursive_client_test.rs` (2 tests: get, put with nested Extension)
6. `spector_access` — `tests/access_public_operation_client_test.rs` (2 tests: public operations only, internal ops are pub(crate))
7. `spector_clientdefault` — `tests/client_default_value_client_test.rs` (4 tests: get_header_parameter, get_operation_parameter, get_path_parameter, put_model_property)

**Total: 29 test functions across 9 test files.**

**Verification:**
- ✅ `cargo clippy --workspace` with `RUSTFLAGS='-Dwarnings'` — Zero warnings across entire workspace
- ✅ `pnpm test` — 32/32 TypeScript tests passing (no regression)

**Key learnings:**
- Test files are hand-written (NOT generated) — placed in `tests/` dirs, not `src/generated/`
- `[dev-dependencies]` section with `tokio = { workspace = true }` must be added to each Cargo.toml
- For `spector_access`, only public operations can be tested from integration tests; internal ops are `pub(crate)` and handled by the `lib.rs` dead-code touch
- Models with `RequestContent<T>` body params use `.try_into().unwrap()` pattern
- Sub-client methods need `name` argument as `&str` not `String` (e.g., access public_operation methods take `name: &str`)
- File naming convention: `{subclient_name}_client_test.rs` (e.g., `union_client_test.rs`, `array_property_client_test.rs`)

### 2026-03-09: PR #887 LOCKOUT — Reviewer Rejection Per Reviewer Rejection Protocol

**PR:** #887 (McManus)
**Review:** jhendrixMSFT discussion_r2884702512
**Status:** REJECTED
**Lock status:** ✅ Locked — McManus cannot revise

**What McManus did:** Modified `clients.ts` to stop emitting `pub(crate) const DEFAULT_*` when suppressed options types are encountered (`constructable.suppressed === 'yes'`).

**Reviewer feedback:** Design misalignment. Constants should always be emitted—they represent TypeSpec-defined defaults that SDK authors need.

**Why lockout applied:** Per Reviewer Rejection Protocol, when a PR is rejected as misaligned with design/architecture, a different team member implements the revision. This ensures fresh perspective and prevents author bias.

**Assigned to:** Fenster (Rust Expert) — implemented as `2026-03-09T0930-fenster.md`

**What changed:** 

1. **Restored constant emission:** Constants now emitted for both suppressed and non-suppressed options
2. **Conditional documentation:** 
   - Non-suppressed: intra-doc link to options type field
   - Suppressed: plain text doc + SDK author guidance
3. **Conditional suppression:**
   - Non-suppressed: no `#[allow(dead_code)]` (constant used by Default impl)
   - Suppressed: `#[allow(dead_code)]` (SDK author may or may not use it)

**Verification:** Keaton's design + Fenster's implementation passed all checks:
- ✅ TypeScript build clean
- ✅ 32/32 unit tests passing
- ✅ Zero clippy warnings across full workspace
- ✅ keyvault_secrets constant present with guidance
- ✅ appconfiguration constant unchanged (non-suppressed path)

**Key lesson:** Always emit constants. They're not dead code in real SDKs—they're used by hand-authored convenience layers. Documentation and warnings may differ by suppression status, but never suppress their existence.

**Arch docs:** 
- Keaton's recommendation: `.squad/decisions/inbox/keaton-clients-ts-design.md`
- Fenster's implementation: `.squad/orchestration-log/2026-03-09T0930-fenster.md`
- Session log: `.squad/log/2026-03-09-clients-ts-design-fix.md`

