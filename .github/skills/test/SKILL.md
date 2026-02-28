<!-- cspell:words nocapture -->
---
name: test
description: Run TypeScript unit tests and Rust integration tests for the emitter
---

Run the test suites for the TypeSpec Rust emitter.

## TypeScript Unit Tests

```bash
cd packages/typespec-rust
pnpm test
```

For CI with coverage reporting:
```bash
pnpm run test-ci
```

## Rust Integration Tests

Integration tests require the spector test server running on `localhost:3000`.

1. Start the spector server:
   ```bash
   cd packages/typespec-rust
   pnpm spector --start
   ```

2. Run the Rust integration tests:
   ```bash
   cd packages/typespec-rust/test/spector
   cargo test --no-fail-fast
   ```

3. Stop the spector server when done:
   ```bash
   cd packages/typespec-rust
   pnpm spector --stop
   ```

## Running a Specific Test Crate

```bash
cd packages/typespec-rust/test/spector/<test-name>
cargo test
```

To see detailed test output:
```bash
cargo test -- --nocapture
```
