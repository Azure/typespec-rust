# Squad Decisions

## Active Decisions

### Sprint 1 Integration Tests (2026-03-07)

**Status:** Complete

**Summary:** All 7 Sprint 1 Spector crates now have integration tests. Hockney verified the gap (zero tests), McManus implemented 29 tests across 9 files matching the `parameters/basic` reference pattern.

**Test Coverage:**
- `spector_noauth`: 2 tests
- `spector_documentation`: 6 tests (2 files)
- `spector_encarray`: 12 tests
- `spector_query`: 1 test
- `spector_recursive`: 2 tests
- `spector_access`: 2 tests (public operations only)
- `spector_clientdefault`: 4 tests

**Implementation Details:**
- All tests use `#[tokio::test]` async runtime
- Client instantiation: `with_no_credential("http://localhost:3000", None).unwrap()`
- Cargo.toml `[dev-dependencies]` added to all 7 crates
- Clippy verified clean; TypeScript tests 32/32 passing

**Recommendation:**
- Merge `squad/sprint1-spector-easy-wins` to main
- Monitor CI Spector test execution
- Pattern is reusable for Tier 2, 3, 4 test expansion

**Full Details:** `.squad/log/2026-03-09-sprint1-tests.md`

### Spector Coverage Gap Analysis (2026-03-06)

**Status:** In Progress — Sprint 1 execution underway

**Summary:** 23 scenarios missing across 4 Spector spec tiers. Current coverage 99/122 (81%). 4-sprint roadmap to reach 100%.

**Tier Breakdown:**
- **Tier 1 (Easy Wins):** 10 scenarios. Emitter infrastructure exists; test-crate work only. Sprint 1 → target 89% coverage.
  - **Result:** 7 of 10 succeeded (70% completion rate). Coverage now 106/122 (87%).
  - **Blockers:** 3 failed due to non-discriminated union support missing from emitter. Recommend moving to Sprint 2.
- **Tier 2 (Existing Infrastructure):** 3 scenarios (multipart, streaming, file). Emitter has infrastructure; need validation. Sprint 2 → 92% coverage.
  - **Note:** Will now include the 3 Tier 1 failures (union, additional-properties, nested-discriminator).
  - **Plus:** Non-discriminated union architecture work (blocks 2 scenarios + future needs).
- **Tier 3 (Medium Effort):** 8 scenarios (versioning, Azure TCGC, status-code-range). Emitter has partial support. Sprint 3 → 98% coverage.
- **Tier 4 (Hard):** 2 scenarios (conditional-request, repeatability headers). Zero emitter support. Sprint 4 → 100% coverage.

**Key Finding:** Emitter is more capable than expected. Multipart, streaming, file handling, additional properties, and doc comments are already implemented.

**Decisions Required:**
- [ ] Team agrees to move 3 failed Tier 1 scenarios to Sprint 2
- [ ] Keaton scopes non-discriminated union support as Sprint 2 architecture priority
- [ ] Fenster validates multipart/streaming infrastructure compiles cleanly (Sprint 2)
- [ ] Rick approves revised sprint timeline

**Full Details:** `.squad/orchestration-log/2026-03-06T0215-mcmanus.md` (McManus findings)

### Baseline Spector Coverage Assessment (2026-03-06)

**Status:** Complete

**Summary:** Pre-Sprint 1 baseline established and verified healthy.

**Metrics:**
- TypeScript build: Clean (0 errors)
- TypeScript unit tests: 32/32 passing
- Spector test crates: 98 total, 89 with integration tests, 823 test functions
- Workspace alignment: 100% (all crates registered)
- Cargo verification: Blocked in environment (CI handles)

**Outcome:** Infrastructure ready for Sprint 1. All baseline metrics captured for post-Sprint tracking.

**Full Report:** `.squad/orchestration-log/2026-03-06T0215-hockney.md` (Hockney baseline)

### Branch Policy Enforcement (2026-03-06)

**Status:** Directive active

**Summary:** Each team member doing work must do it in a branch, not directly on main.

**Issued by:** Rick (via Copilot)

**Applicability:** All future work. Applies to McManus (squad/sprint1-spector-easy-wins branch), Keaton, Fenster, Hockney.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
