# Decision: Thorough Integration Test Standard

**Author:** Hockney (Tester)
**Date:** 2026-03-10
**Status:** Proposed

## Context

Rick rejected McManus's initial Sprint 1 integration tests as insufficient. They were "structural smoke tests" — they called each API and unwrapped the result, but never asserted status codes, never validated response bodies, and had no negative test cases.

## Decision

All Spector integration tests must follow the **thorough test pattern**:

1. **Assert status codes** on every API call (`assert_eq!(resp.status(), 200)` or `assert_eq!(resp.status(), 204)`)
2. **Deserialize and validate response bodies** for typed responses (`resp.into_model::<T>().unwrap()` + field assertions)
3. **Include negative tests** for each crate:
   - Client construction with invalid URLs (non-http scheme, malformed)
   - Empty/invalid required parameters where the generated code has validation
   - Error response status codes where applicable
4. **Test input variants** — exercise different enum values, optional parameters, edge cases

## Rationale

- Smoke tests only prove the code compiles and the mock server responds — they don't catch regressions in response handling, serialization, or status code mapping.
- Status code assertions catch bugs where the emitter generates wrong `success_codes`.
- Response body validation catches serialization/deserialization bugs.
- Negative tests catch missing validation in generated client code.

## Impact

- All future Spector test crates (Sprint 2, 3, 4) should follow this pattern.
- Existing crates with smoke-style tests should be upgraded when touched.
- Test count per crate will be roughly 2-3x what simple smoke tests produce.

## Reference

Gold standard tests: `parameters/basic`, `authentication/api-key`, `encode/bytes`, `type/enum/extensible`.
