---
name: lint
description: >-
  Run all linting and spell checking for TypeScript and Rust code. Run this
  before committing to catch style issues, clippy warnings, and misspellings.
---

Run all linting and spell checking for the project. All commands below assume
you start from the repo root and follow them sequentially.

## TypeScript Linting

```bash
cd packages/typespec-rust
pnpm eslint
```

Fix all warnings and errors before committing.

## Rust Linting

```bash
cd test
cargo clippy --workspace --all-features --all-targets --keep-going --no-deps
```

Note: The emitter automatically runs `cargo fmt` post-codegen if the Rust toolset is installed, so manual formatting is typically not needed.

## Spell Checking

Run from the repo root:
```bash
cd ../..
cspell -c .vscode/cspell.json .
```

This must pass before committing. If new words need to be added, either add them to `.vscode/cspell.json` or use a `<!-- cspell:words ... -->` directive in the affected file.
