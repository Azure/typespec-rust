# Decision: pub(crate) Constant Emission — Always Emit, Conditional Suppression

**Author:** Fenster (Rust Expert)
**Date:** 2026-03-09
**Implements:** Keaton's architecture recommendation (`keaton-clients-ts-design.md`)
**Addresses:** PR #887 review feedback (jhendrixMSFT discussion_r2884702512)

---

## Decision

`pub(crate) const DEFAULT_*` constants are now ALWAYS emitted in `clients.ts`, regardless of whether the options type is suppressed. The previous behavior (McManus's fix) skipped emission when `constructable.suppressed === 'yes'`, which denied SDK authors access to TypeSpec-defined default values.

## What Changed

**In `packages/typespec-rust/src/codegen/clients.ts`:**
- Removed `if (!isSuppressed)` guard around constant emission loop
- Added conditional `#[allow(dead_code)]` only when suppressed (SDK author may or may not reference the constant)
- Non-suppressed: intra-doc link to options type field, no dead_code suppression (constant is used by generated Default impl)
- Suppressed: plain text doc comment (avoids broken intra-doc links), plus SDK author guidance explaining usage pattern

## Generated Output

**Non-suppressed (e.g., appconfiguration):**
```rust
/// Default value for [`AzureAppConfigurationClientOptions::api_version`].
pub(crate) const DEFAULT_API_VERSION: &str = "2024-09-01";
```

**Suppressed (e.g., keyvault_secrets):**
```rust
/// Default value for `SecretClientOptions::api_version`.
///
/// This constant is available for SDK authors to use in hand-authored code.
/// When the options type is suppressed (via `@access(Access.internal)`), the
/// SDK author provides a custom options type and should reference this constant
/// in their `Default` implementation rather than hardcoding the value.
#[allow(dead_code)]
pub(crate) const DEFAULT_API_VERSION: &str = "2025-06-01-preview";
```

## Verification

- TypeScript build: clean
- TypeScript tests: 32/32 passing
- Cargo clippy: zero warnings across full workspace
- keyvault_secrets: constant now present with proper docs
- All non-suppressed crates: unchanged behavior (constant was already emitted)

## Team Impact

- **McManus:** Your original constant emission logic was correct. The over-correction (suppressing when `isSuppressed`) was the issue. Per Reviewer Rejection Protocol, I implemented the fix.
- **Keaton:** Your design is implemented as specified. Part 2 (replacing `_touch_*` with unit tests) is deferred as you recommended.
- **Hockney:** No test infrastructure changes. Existing integration tests unaffected.
