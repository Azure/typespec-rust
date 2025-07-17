
<!-- cspell: ignore nocapture RUSTFLAGS Dwarnings -->
# Contributing Guide

This guide explains how to contribute to the TypeSpec Rust emitter project, including how to build, test, and develop the codebase.

## Prerequisites

- **Node.js** (>=20.0.0) - Required for the TypeScript emitter
- **pnpm** (10.10.0) - Package manager for Node.js dependencies  
- **Rust** (1.80+) - Required for building and testing generated Rust code
- **Git** - Version control

## Project Structure

This project is a TypeSpec emitter that generates Rust SDK code from TypeSpec specifications:

- `/packages/typespec-rust/` - Main TypeScript emitter package
- `/packages/typespec-rust/src/` - TypeScript emitter source code
- `/packages/typespec-rust/test/` - Generated Rust test crates and TypeScript unit tests
- `/packages/typespec-rust/test/spector/` - Integration test crates generated from spector specs
- `/packages/typespec-rust/test/sdk/` - SDK test crates
- `/eng/` - Build and CI/CD pipeline configuration

## Building the Project

The project has two build phases: building the TypeScript emitter and building the generated Rust code.

### Building the TypeScript Emitter

Navigate to the emitter package directory:

```bash
cd packages/typespec-rust
```

Install dependencies:

```bash
pnpm install
```

Build the TypeScript emitter:

```bash
pnpm build
```

This compiles the TypeScript source code to JavaScript in the `dist/` directory.

## Regenerating Test Suites

The project includes extensive test suites generated from TypeSpec specifications. When you modify the emitter or need to update tests, regenerate them:

```bash
cd packages/typespec-rust
pnpm run tspcompile
```

### Regenerating Specific Test Suites

To regenerate only specific test crates (useful during development):

```bash
pnpm run tspcompile --filter=<pattern>
```

For example, to regenerate only tests containing "oauth":

```bash
pnpm run tspcompile --filter=oauth
```

### What Test Regeneration Does

The `tspcompile` script:

1. Compiles TypeSpec specifications from:
   - `@typespec/http-specs` (standard HTTP specifications)
   - `@azure-tools/azure-http-specs` (Azure-specific specifications)
   - Local test specifications in `test/tsp/`

2. Generates Rust crates in:
   - `test/spector/` - Integration tests from spector specifications
   - `test/sdk/` - SDK tests from custom TypeSpec files
   - `test/other/` - Additional test scenarios

3. Updates the workspace `Cargo.toml` with all generated crates

Each generated crate includes:

- `Cargo.toml` - Rust package configuration
- `src/lib.rs` - Entry point (usually not regenerated to preserve customizations)
- `src/generated/` - Generated Rust client code (fully regenerated)
- `tests/` - Integration test files that use the generated client

### Building Generated Rust Code

After generating Rust test crates (as described above), you can build the Rust code:

```bash
cd packages/typespec-rust/test
cargo build
```

This builds all generated Rust crates in the workspace.

## Executing Test Suites

### TypeScript Unit Tests

Run the emitter's TypeScript unit tests:

```bash
cd packages/typespec-rust
pnpm test
```

For CI with coverage:

```bash
pnpm run test-ci
```

### Rust Integration Tests

#### Building Test Crates

First, ensure all Rust test crates compile:

```bash
cd packages/typespec-rust/test
cargo build
```

#### Running Tests with Spector Server

Most integration tests require the spector test server running on `localhost:3000`. The integration tests make HTTP calls to this server to validate the generated Rust client code.

Start the spector server:

```bash
cd packages/typespec-rust
pnpm spector --start
```

In another terminal, run the Rust tests:

```bash
cd packages/typespec-rust/test/spector
cargo test --no-fail-fast
```

Stop the spector server when done:

```bash
cd packages/typespec-rust  
pnpm spector --stop
```

**Note**: Integration tests connect to the test server and make real HTTP requests to validate that the generated client code works correctly with the expected API responses.

#### Running Individual Test Crates

To test a specific generated crate:

```bash
cd packages/typespec-rust/test/spector/<test-name>
cargo test
```

To run a specific test within a crate:

```bash
cd packages/typespec-rust/test/spector/<test-name>
cargo test <test-function-name>
```

To see detailed test output:

```bash
cargo test -- --nocapture
```

**Debugging Test Failures**: If tests fail, check:

1. That the spector server is running (`pnpm spector --start`)
2. That the generated code compiled successfully (`cargo build`)
3. Review the test output for HTTP errors or assertion failures
4. Check if the TypeSpec specification changed and regeneration is needed

### Code Quality Checks

#### Linting TypeScript Code

```bash
cd packages/typespec-rust
pnpm eslint
```

#### Linting Rust Code  

```bash
cd packages/typespec-rust/test
cargo clippy --workspace --all-features --all-targets --keep-going --no-deps
```

For strict linting (CI mode):

```bash
RUSTFLAGS='-Dwarnings' cargo clippy --workspace --all-features --all-targets --keep-going --no-deps
```

#### Formatting Rust Code

```bash
cd packages/typespec-rust/test
cargo fmt --all
```

## Development Workflow

1. **Make changes** to the TypeScript emitter code in `packages/typespec-rust/src/`

2. **Build the emitter**:

   ```bash
   cd packages/typespec-rust
   pnpm build
   ```

   For continuous development, use watch mode:

   ```bash
   pnpm watch
   ```

3. **Regenerate test crates** to test your changes:

   ```bash
   pnpm run tspcompile
   ```

4. **Build generated Rust code**:

   ```bash
   cd test
   cargo build
   ```

5. **Run tests**:

   ```bash
   # TypeScript tests
   cd packages/typespec-rust
   pnpm test
   
   # Rust integration tests  
   pnpm spector --start
   cd test/spector
   cargo test
   cd ../../
   pnpm spector --stop
   ```

6. **Run linting**:

   ```bash
   # TypeScript linting
   cd packages/typespec-rust
   pnpm eslint
   
   # Rust linting
   cd test
   cargo clippy --workspace --all-features --all-targets
   ```

## Versioning Guidelines

When making changes to the emitter, follow these versioning guidelines:

### Patch Version Bump (0.18.X)

Increment the patch version for:

- Bug fixes that don't change the public API
- Internal refactoring or improvements
- Documentation updates
- Minor improvements to generated code quality
- Performance improvements

### Minor Version Bump (0.X.0)

Increment the minor version for:

- New features or capabilities in the emitter
- Support for new TypeSpec constructs or decorators
- Breaking changes to generated Rust code structure
- Changes that require users to update their generated code
- New configuration options or emitter settings

### Major Version Bump (X.0.0)

Increment the major version for:

- Breaking changes to the emitter's public API
- Changes that require TypeSpec specification updates
- Fundamental changes to the emitter architecture
- Removal of deprecated features

Update the version in `packages/typespec-rust/package.json` and document changes in `packages/typespec-rust/CHANGELOG.md`.

## Continuous Integration

The CI pipeline runs the following checks on every pull request:

1. **Build** - Compiles TypeScript emitter
2. **Lint** - Runs ESLint on TypeScript code  
3. **Test** - Runs TypeScript unit tests with coverage
4. **Regenerate** - Regenerates all test crates and verifies no changes
5. **Compile** - Builds all generated Rust crates
6. **Clippy** - Runs Rust linting on generated code
7. **Integration Tests** - Runs spector integration tests

Ensure all these checks pass before submitting a pull request.

## Getting Help

- Check existing [issues](https://github.com/Azure/typespec-rust/issues) and [discussions](https://github.com/Azure/typespec-rust/discussions)
- Review the [TypeSpec documentation](https://typespec.io/)
- Look at the generated code in `test/` directories for examples
- Examine the CI pipeline in `/eng/pipelines/` for the complete build process