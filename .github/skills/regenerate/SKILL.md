---
name: regenerate
description: >-
  Regenerate Rust test crates from TypeSpec specifications. Run this after
  modifying emitter source code or TypeSpec files under test/tsp/ to update
  generated output.
---

Regenerate the Rust test crates after modifying the emitter or contents under `test/tsp/`. This command can take several minutes to complete; wait for it to finish before proceeding.

## Regenerate All Test Crates

```bash
cd packages/typespec-rust
pnpm run tspcompile
```

## Regenerate Specific Test Crates

Use the `--filter` flag to regenerate only matching test crates (useful during development):
```bash
pnpm run tspcompile --filter=<pattern>
```

For example, to regenerate only tests containing "oauth":
```bash
pnpm run tspcompile --filter=oauth
```

## Build Generated Rust Code

After regeneration, verify the generated Rust code compiles:
```bash
cd test
cargo build
```

## What Regeneration Does

The `tspcompile` script:
1. Compiles TypeSpec specifications from `@typespec/http-specs`, `@azure-tools/azure-http-specs`, and local specs in `test/tsp/`
2. Generates Rust crates in `test/spector/`, `test/sdk/`, and `test/other/`
3. Updates the workspace `Cargo.toml` with all generated crates

Each generated crate includes:
- `Cargo.toml` — Rust package configuration
- `src/lib.rs` — Entry point (usually not regenerated to preserve customizations)
- `src/generated/` — Generated Rust client code (fully regenerated)
- `tests/` — Integration test files
