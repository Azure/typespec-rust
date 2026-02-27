# AGENTS.md

## Project Summary

TypeSpec Rust emitter — a TypeScript code generator that produces Rust SDK client code from TypeSpec API specifications. The emitter is an `@azure-tools/typespec-rust` npm package.

## Setup

```bash
cd packages/typespec-rust
pnpm install
pnpm build
```

- **Package manager**: pnpm 10.10.0 (do not use npm or yarn)
- **Node.js**: >= 20.0.0
- **Rust**: 1.80+ with clippy and rustfmt (see `rust-toolchain.toml`)

## Build Commands

| Command | Directory | Purpose |
|---|---|---|
| `pnpm install` | `packages/typespec-rust` | Install dependencies |
| `pnpm build` | `packages/typespec-rust` | Build TypeScript emitter to `dist/` |
| `pnpm watch` | `packages/typespec-rust` | Build in watch mode |
| `pnpm run tspcompile` | `packages/typespec-rust` | Regenerate all Rust test crates |
| `pnpm run tspcompile --filter=<pattern>` | `packages/typespec-rust` | Regenerate matching test crates only |
| `cargo build` | `packages/typespec-rust/test` | Build all generated Rust crates |

## Testing

| Command | Directory | Purpose |
|---|---|---|
| `pnpm test` | `packages/typespec-rust` | Run TypeScript unit tests |
| `pnpm run test-ci` | `packages/typespec-rust` | Run tests with coverage |
| `pnpm spector --start` | `packages/typespec-rust` | Start spector test server on localhost:3000 |
| `cargo test --no-fail-fast` | `packages/typespec-rust/test/spector` | Run Rust integration tests (needs spector running) |
| `pnpm spector --stop` | `packages/typespec-rust` | Stop spector test server |

## Linting and Formatting

| Command | Directory | Purpose |
|---|---|---|
| `pnpm eslint` | `packages/typespec-rust` | Lint TypeScript code |
| `pnpm format` | `packages/typespec-rust` | Format TypeScript files |
| `cargo clippy --workspace --all-features --all-targets --keep-going --no-deps` | `packages/typespec-rust/test` | Lint generated Rust code |
| `cargo fmt --all` | `packages/typespec-rust/test` | Format generated Rust code |
| `cspell -c ./.vscode/cspell.json ./packages` | repo root | Spell check — must pass before committing |

## Code Style

- TypeScript strict mode is used throughout the emitter.
- All files must end with a newline character.
- Run `pnpm eslint` and fix all warnings before committing TypeScript changes.
- Run `cargo clippy` and `cargo fmt` before committing generated Rust changes.
- Ensure `cspell` spell checking passes on all packages.

## Repository Structure

```
packages/typespec-rust/
├── src/                    # TypeScript emitter source
│   ├── emitter.ts          # Entry point
│   ├── codegen/            # Rust code generation
│   ├── codemodel/          # Internal model representation
│   ├── tcgcadapter/        # TypeSpec Client Generator Core adapter
│   └── utils/              # Shared utilities
├── test/                   # Generated Rust test crates + TS unit tests
│   ├── spector/            # Integration tests (from spector specs)
│   ├── sdk/                # SDK tests
│   └── Cargo.toml          # Rust workspace root
├── .scripts/               # Build helper scripts
├── package.json            # Package configuration (pnpm)
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Vitest test configuration
└── eslint.config.js        # ESLint configuration
eng/pipelines/              # Azure DevOps CI/CD pipelines
.vscode/cspell.json         # Spell checking dictionary
rust-toolchain.toml         # Rust toolchain components
```

## CI Pipeline

CI is run via Azure DevOps (defined in `eng/pipelines/ci.yml`). The pipeline checks:

1. TypeScript emitter builds successfully
2. ESLint passes on TypeScript code
3. TypeScript unit tests pass with coverage
4. Regenerated test crates match committed code (no uncommitted diffs)
5. All generated Rust crates compile
6. Clippy passes on generated Rust code
7. Spector integration tests pass

Always replicate these checks locally before opening a PR.

## Development Workflow

1. Edit emitter source in `packages/typespec-rust/src/`
2. `pnpm build` to compile
3. `pnpm run tspcompile` to regenerate test crates
4. `cd test && cargo build` to verify Rust compilation
5. `pnpm test` for unit tests
6. `pnpm eslint` for TypeScript linting
7. `cargo clippy --workspace --all-features --all-targets` for Rust linting

## PR Guidelines

- Run all linting, build, and test steps before submitting.
- Keep PRs focused on a single change or feature.
- Regenerate test crates and commit the updated generated code if the emitter output changes.
