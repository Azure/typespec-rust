<!-- cspell:words nocapture -->
---
name: test
description: >-
  Run TypeScript unit tests and Rust integration tests for the emitter. Use this
  to verify emitter correctness after making code changes.
---

Run the test suites for the TypeSpec Rust emitter. All commands below assume
you start from the repo root and follow them sequentially.

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
   pnpm spector --start
   ```

2. Run the Rust integration tests:
   ```bash
   cd test/spector
   cargo test --no-fail-fast
   ```

3. Stop the spector server when done:
   ```bash
   cd ../..
   pnpm spector --stop
   ```

## Running a Specific Test Crate

```bash
cd test/spector/<test-name>
cargo test
```

To see detailed test output:
```bash
cargo test -- --nocapture
```
