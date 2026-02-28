<!-- cspell:words tcgcadapter MSRV -->
# AGENTS.md

## Project Summary

This repository contains the TypeSpec Rust emitter (`@azure-tools/typespec-rust`), a TypeScript-based code generator that produces Rust SDK client code from TypeSpec API specifications. It is a Microsoft open-source project.

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** (version specified in `packageManager` field of `package.json`; do not use npm or yarn)
- **Rust** at the minimum supported Rust version (MSRV) with clippy and rustfmt components (components are configured in `rust-toolchain.toml`)

## Setup

Always run commands from the `packages/typespec-rust` directory unless stated otherwise.

```bash
cd packages/typespec-rust
pnpm install
pnpm build
```

- `pnpm build` compiles TypeScript to `dist/`.
- `pnpm watch` runs the compiler in watch mode for iterative development.

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
  - `test/other/` — Targeted test crates
  - `test/tsp/` — TypeSpec files used to generate test/other and test/sdk content
- `/eng/pipelines/` — Azure DevOps CI/CD pipeline definitions
- `/.vscode/cspell.json` — Spell checking configuration
- `/rust-toolchain.toml` — Rust toolchain components (clippy, rustfmt)

## Coding Standards

- All files must end with a newline character.
- The emitter automatically runs `cargo fmt` post-codegen if the Rust toolset is installed.
- Spell checking from the repo root: `cspell -c .vscode/cspell.json .` must succeed before committing.

## CI Pipeline

The CI pipeline (Azure DevOps, defined in `eng/pipelines/ci.yml`) runs these checks on every PR:

1. Build TypeScript emitter
2. ESLint on TypeScript code
3. TypeScript unit tests with coverage
4. Regenerate all test crates and verify no uncommitted changes
5. Build all generated Rust crates
6. Clippy on generated Rust code
7. Spector integration tests

Always replicate these checks locally before opening a PR.

## PR Guidelines

- Run all linting, build, and test steps before submitting.
- Keep PRs focused on a single change or feature.
- Regenerate test crates and commit the updated generated code if the emitter output changes.

