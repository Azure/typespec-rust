# Project Context

- **Owner:** Rick
- **Project:** typespec-rust — TypeSpec Rust emitter that generates Rust SDK client code from TypeSpec API specifications
- **Stack:** TypeScript (emitter), Rust (generated output), Node.js >= 20, pnpm, Vitest
- **Goal:** Achieve 100% Spector test coverage
- **Created:** 2026-03-06

## Test Infrastructure

- `pnpm build` — Compile TypeScript emitter
- `pnpm test` — Run Vitest unit tests
- `pnpm regenerate` — Regenerate Rust test crates from TypeSpec files
- Spector tests live in `test/spector/` as generated Rust crates
- TypeSpec source files for tests in `test/tsp/`
- CI pipeline: build → ESLint → unit tests → regenerate → cargo build → clippy → Spector

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-06: Spector Coverage Gap Analysis & Sprint Plan

**Briefing from Keaton's gap analysis:**
- **Current coverage:** 99/122 scenarios (81%). 23 gaps identified.
- **4-sprint roadmap to 100% coverage:**
  - **Sprint 1 (Tier 1 — Easy Wins):** 10 scenarios. Emitter already supports them. Test-crate creation + regeneration work. Target 89% coverage.
  - **Sprint 2 (Tier 2 — Infrastructure Validation):** 3 scenarios (multipart, streaming, file). Validate existing emitter infrastructure. Target 92% coverage.
  - **Sprint 3 (Tier 3 — Medium Effort):** 8 scenarios (versioning, Azure TCGC, status-code-range). Partial emitter support. Target 98% coverage.
  - **Sprint 4 (Tier 4 — Hard):** 2 scenarios (conditional-request, repeatability headers). Zero emitter support. Build new HTTP pipeline features. Target 100% coverage.
- **Key insight:** Emitter is more capable than expected. Many "missing" scenarios just need test crates, not architectural changes.

**Timeline:** Ready to begin Sprint 1 pending team review and approval.

### 2026-03-06: Baseline Assessment (Pre-Sprint 1)

**Verified baseline numbers before Sprint 1 begins:**

**TypeScript Emitter:**
- `pnpm build` (tsc): Clean, zero errors. Version 0.37.0.
- `pnpm test` (Vitest): **8 test files, 32 tests — all passing** (16 unique tests run twice: TS + compiled JS).
  - codegen.test.ts: 8 tests (Cargo.toml gen, helpers, annotations, indentation)
  - lib.test.ts: 3 tests (emitter options, required fields, defaults)
  - shared.test.ts: 1 test (type unwrapping utility)
  - tcgcadapter.test.ts: 4 tests (enum naming, param sorting, doc formatting, visibility)

**Spector Test Crates:**
- **98 total crates** across 14 domains, all registered in workspace Cargo.toml (no orphans).
- **89 crates with integration tests** (tests/ directory with #[tokio::test] functions).
- **9 crates without integration tests** (generated SDK code only): documentation, type/model/inheritance/recursive, type/model/inheritance/nested-discriminator, azure/client-generator-core/access, azure/client-generator-core/client-default-value, parameters/query, encode/array, authentication/noauth/union, plus 1 more TBD.
- **823 Rust integration test functions** across 232 test files.
- **Cargo compilation: NOT VERIFIED** — cargo is blocked in this environment. CI (Azure DevOps) handles cargo build + clippy + spector test execution.

**Domain breakdown (98 crates):**
- authentication: 5 | azure: 39 | client: 8 | documentation: 1
- encode: 5 | parameters: 6 | payload: 5 | resiliency: 2
- routes: 1 | serialization: 1 | server: 5 | service: 1
- special-words: 1 | type: 17 | versioning: 1

**CI Pipeline (Azure DevOps, eng/pipelines/ci.yml):**
- Build → ESLint → Spell Check → Unit Tests → Regenerate (verify no diff) → Cargo Build → Clippy (warnings=errors) → Spector Integration Tests
- Separate Spector coverage upload pipeline (typespec-spector.yml) runs on main pushes to test/spector/.

**Key observations:**
1. Workspace is healthy — 98 crates in workspace match 98 on disk.
2. 9 crates lack integration tests — these may be candidates for Sprint 1 additions.
3. Cannot verify cargo compilation locally; must rely on CI or get cargo access.
4. The crate count (98) exceeds the previously reported 99 scenarios from Keaton's analysis — some crates may map to sub-scenarios within a single Spector scenario.

**Status for team:** Baseline report and detailed metrics documented at `.squad/orchestration-log/2026-03-06T0215-hockney.md`. Infrastructure is ready for Sprint 1 execution. Will track coverage changes post-Sprint completion.

---

### 2026-03-07: USER DIRECTIVES — Generated Code Policy & Clippy Pre-Submit

**From:** Rick (via Copilot)
**Critical for all test infrastructure work**

Two new directives affecting test validation and CI:

1. **No hand-editing of generated code.** All generated Rust code issues (including clippy violations) must be fixed by:
   - Modifying emitter TypeScript source
   - Updating client.tsp directives
   - NEVER by hand-editing generated test crate code

2. **Clippy before submit — mandatory.** Always run `cargo clippy --workspace` on all generated test crates before validating CI. This is a hard requirement for all PR submissions.

When running your baseline or coverage validation tests, ensure `cargo clippy` passes zero warnings. If you find clippy violations in generated code, flag them to McManus for emitter fixes rather than attempting local workarounds.

### 2026-03-07: Sprint 1 Integration Test Verification

**Reference Pattern (from `parameters/basic`):**

A "tested" Spector crate has three distinguishing features vs. a "generated-only" crate:
1. `Cargo.toml` includes `[dev-dependencies]` with `tokio = { workspace = true }`
2. A `tests/` directory with `*_client_test.rs` or `*_client.rs` files
3. `#[tokio::test]` async functions that instantiate the generated client via `::with_no_credential("http://localhost:3000", None)` and call API methods

Test files are hand-written, NOT generated. This is the expected distinction. Tests run against the Spector mock server.

**Sprint 1 Verification Result: 0/7 crates have integration tests.**

All 7 Sprint 1 crates (noauth/union, documentation, encode/array, parameters/query, type/model/inheritance/recursive, azure/cgc/access, azure/cgc/client-default-value) have generated SDK code only. None have `tests/` directories, `[dev-dependencies]`, or `#[tokio::test]` functions.

Estimated work to bring all 7 to reference pattern: ~10 test files, ~29 test functions. Straightforward — all follow the same client instantiation + method call pattern.

Special case: `spector_access` has a dead-code touch in `lib.rs` for `pub(crate)` internal operations, but still needs public operation tests.

**TypeScript unit tests:** 32/32 passing (no regression).

**Detailed findings filed to:** `.squad/decisions/inbox/hockney-test-verification.md`

### 2026-03-07: Sprint 1 Integration Test Gap Verification — COMPLETE

**Task:** Verify Sprint 1 test coverage (Rick's observation: no integration tests exist)  
**Status:** Complete — All 7 crates confirmed missing integration tests

**Verification executed:**

All 7 Sprint 1 Spector crates inspected systematically:
- `spector_noauth` (authentication/noauth/union): 0 tests
- `spector_documentation` (documentation): 0 tests
- `spector_encarray` (encode/array): 0 tests
- `spector_query` (parameters/query): 0 tests
- `spector_recursive` (type/model/inheritance/recursive): 0 tests
- `spector_access` (azure/client-generator-core/access): 0 tests (only dead-code touch in lib.rs)
- `spector_clientdefault` (azure/client-generator-core/client-default-value): 0 tests

**Reference pattern identified:**

`parameters/basic` crate analyzed as the model for proper test structure:
- `Cargo.toml` contains `[dev-dependencies]` with `tokio = { workspace = true }`
- `tests/` directory exists with `*_client_test.rs` files
- `#[tokio::test]` async functions instantiate client with `with_no_credential("http://localhost:3000", None).unwrap()`
- API methods called with appropriate arguments
- Success verified by `.unwrap()` on response

**Test requirements scoped:**

Each crate needs specific test coverage based on generated client types:
- **spector_noauth:** UnionClient (2 tests)
- **spector_documentation:** DocumentationClient with sub-clients (6 tests)
- **spector_encarray:** ArrayPropertyClient (12 tests)
- **spector_query:** QueryConstantClient (1 test)
- **spector_recursive:** RecursiveClient (2 tests)
- **spector_access:** AccessClient public operations (2 tests, internal ops are pub(crate))
- **spector_clientdefault:** ClientDefaultValueClient (4 tests)

**Total:** ~29 test functions needed across ~10 test files

**Handoff:** Findings documented and passed to McManus for implementation.

**Session log:** `.squad/log/2026-03-09-sprint1-tests.md`
**Orchestration log:** `.squad/orchestration-log/2026-03-07T0300-hockney.md`

