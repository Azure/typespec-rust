<!-- cspell:words tcgcadapter -->
# Copilot Instructions

## Project Overview

This repository contains the TypeSpec Rust emitter (`@azure-tools/typespec-rust`), a TypeScript-based code generator that produces Rust SDK client code from TypeSpec API specifications. It is a Microsoft open-source project.

## Repository Layout

- `/packages/typespec-rust/` — Main TypeScript emitter package (the only package)
- `/packages/typespec-rust/src/` — TypeScript emitter source code
  - `src/codegen/` — Rust code generation logic
  - `src/codemodel/` — Internal code model representation
  - `src/tcgcadapter/` — TypeSpec Client Generator Core adapter
  - `src/emitter.ts` — Emitter entry point
- `/packages/typespec-rust/test/` — Generated Rust test crates and TypeScript unit tests
  - `test/spector/` — Integration test crates generated from spector specs
  - `test/sdk/` — SDK test crates
- `/eng/pipelines/` — Azure DevOps CI/CD pipeline definitions
- `/.vscode/cspell.json` — Spell checking configuration
- `/rust-toolchain.toml` — Rust toolchain configuration

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** 10.10.0 (specified in `packageManager` field of `package.json`)
- **Rust** 1.80+ with clippy and rustfmt components (components are configured in `rust-toolchain.toml`)

## Install and Build

Always run commands from the `packages/typespec-rust` directory unless stated otherwise.

```bash
cd packages/typespec-rust
pnpm install
pnpm build
```

- Use `pnpm` as the package manager. Do not use npm or yarn.
- `pnpm build` compiles TypeScript to `dist/`.
- `pnpm watch` runs the compiler in watch mode for iterative development.

## Testing

### TypeScript Unit Tests

```bash
cd packages/typespec-rust
pnpm test
```

For CI with coverage: `pnpm run test-ci`

### Regenerating Rust Test Crates

After modifying the emitter, regenerate the test crates:

```bash
cd packages/typespec-rust
pnpm run tspcompile
```

Use `pnpm run tspcompile --filter=<pattern>` to regenerate only matching test crates.

### Building Generated Rust Code

```bash
cd packages/typespec-rust/test
cargo build
```

### Rust Integration Tests (require spector server)

```bash
cd packages/typespec-rust
pnpm spector --start
# In another terminal:
cd packages/typespec-rust/test/spector
cargo test --no-fail-fast
# When done:
cd packages/typespec-rust
pnpm spector --stop
```

## Coding Standards

- Validate all TypeScript changes are linter clean: `pnpm eslint` (from `packages/typespec-rust`).
- Validate Rust generated code: `cargo clippy --workspace --all-features --all-targets --keep-going --no-deps` (from `packages/typespec-rust/test`).
- Format Rust code: `cargo fmt --all` (from `packages/typespec-rust/test`).
- Run spell checking from the repo root: `cspell -c .vscode/cspell.json .` must succeed before committing.
- All files must end with a newline character.

## CI Pipeline

The CI pipeline (Azure DevOps, defined in `/eng/pipelines/ci.yml`) runs these checks on every PR:

1. Build TypeScript emitter
2. ESLint on TypeScript code
3. TypeScript unit tests with coverage
4. Regenerate all test crates and verify no uncommitted changes
5. Build all generated Rust crates
6. Clippy on generated Rust code
7. Spector integration tests

Always ensure all of these checks pass locally before submitting a pull request.

## Development Workflow

1. Make changes in `packages/typespec-rust/src/`
2. `pnpm build` (or `pnpm watch`)
3. `pnpm run tspcompile` to regenerate test crates
4. `cd test && cargo build` to verify Rust compilation
5. `pnpm test` for TypeScript tests
6. `pnpm eslint` for linting
7. `cargo clippy --workspace --all-features --all-targets` for Rust linting
