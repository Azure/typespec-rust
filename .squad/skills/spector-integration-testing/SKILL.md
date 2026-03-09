# Skill: Spector Integration Testing (Thorough Pattern)

## When to Use

Use this when writing or reviewing integration tests for Spector test crates. This applies to all crates under `test/spector/` that exercise generated Rust SDK code against the Spector mock server.

## Test File Location

- Test files go in `tests/` directories (NOT `src/generated/`)
- Naming convention: `<client_name>_test.rs` (e.g., `union_client_test.rs`)
- Each test uses `#[tokio::test]` for async runtime
- Cargo.toml must have `[dev-dependencies] tokio = { workspace = true }`

## Client Instantiation Pattern

```rust
use spector_<cratename>::<ClientType>;

let client = <ClientType>::with_no_credential("http://localhost:3000", None).unwrap();
```

For sub-clients:
```rust
let sub = client.get_<subclient_name>_client();
```

## Thorough Test Checklist

Every test crate MUST include:

### 1. Status Code Assertions (Required)

```rust
// Void response (204 No Content)
let resp = client.some_operation(None).await.unwrap();
assert_eq!(resp.status(), 204, "operation should return 204");

// Typed response (200 OK)
let resp = client.get_something(None).await.unwrap();
assert_eq!(resp.status(), 200, "get should return 200");
```

### 2. Response Body Validation (Required for typed responses)

```rust
let resp = client.get_something("name", None).await.unwrap();
assert_eq!(resp.status(), 200);
let model: SomeModel = resp.into_model().unwrap();
assert_eq!(model.name, Some("name".to_string()));
assert_eq!(model.count, Some(42));
```

### 3. Error Response Validation (When applicable)

```rust
// For operations that can return errors
let resp = client.invalid_operation(None).await;
assert_eq!(resp.unwrap_err().http_status(), Some(StatusCode::Forbidden));
```

### 4. Client Construction Negative Tests (Required)

```rust
// Non-HTTP scheme rejected
let result = Client::with_no_credential("ftp://localhost:3000", None);
assert!(result.is_err(), "non-http scheme should be rejected");

// Malformed URL rejected
let result = Client::with_no_credential("not-a-valid-url", None);
assert!(result.is_err(), "malformed URL should be rejected");
```

### 5. Input Variant Coverage (Best practice)

- Test each enum variant separately
- Test optional parameters with and without values
- Test empty/boundary values where generated code has validation (e.g., empty path segments)
- Test with different data combinations

## Import Patterns

```rust
// Main client
use spector_<crate>::<ClientType>;

// Models from sub-modules
use spector_<crate>::<submodule>::models::{Model1, Model2};

// Status codes for error assertions
use azure_core::http::StatusCode;

// Method options for optional parameters
use spector_<crate>::models::ClientOperationOptions;
```

## Request Content Pattern

For POST/PUT operations with typed bodies:
```rust
let input = SomeModel {
    field1: Some("value".to_string()),
    field2: Some(42),
};
let resp = client
    .some_operation(input.try_into().unwrap(), None)
    .await
    .unwrap();
```

## Running Tests

```bash
# Clippy (must pass with zero warnings)
cd packages/typespec-rust/test
cargo clippy -p spector_<crate> --all-targets

# Run tests (requires Spector mock server at localhost:3000)
cargo test -p spector_<crate>
```

## Common Gotchas

1. **`Response<(), NoFormat>` has no `into_model()`** — only check `.status()` for void responses.
2. **`pub(crate)` methods** — internal operations can't be tested from `tests/` directory. Use the dead-code touch pattern in `lib.rs` instead.
3. **`#[non_exhaustive]` models** — some models have `#[non_exhaustive]` so you can't construct them directly; only receive them from API responses.
4. **Model field values depend on mock server** — the Spector mock server echoes back what you send, or returns predefined responses. Check the spec to know what to assert.
