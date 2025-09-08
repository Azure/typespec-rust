# Copilot Instructions

This document serves as an index to task-specific instructions for GitHub Copilot. Each task has its own detailed instructions file in the `.github/prompts` directory.

## Install and Build

- Packages are located in the `packages` folder.
- Use `pnpm` as the package manager.
- Use `pnpm install` to install dependencies.
- Use `pnpm build` to build every package.
- Use `pnpm format` under each subfolder of `packages` folder to format all files.

## Coding Standards

- Validate all changes are linter clean by running `pnpm eslint`.
- Make sure that cspell is installed and configured in your editor for spell checking.
- Ensure that "cspell -c ./.vscode/cspell.json ./packages" succeeds before committing changes.

## Source Generation and Testing

- Use `pnpm run tspcompile` to regenerate Rust code from TypeSpec files.
- Generated sources are located in `test/*/src/generated/` directories.
- Use `pnpm run test` to run TypeScript tests.
- Use `pnpm run test-ci` for CI-style testing with coverage and JUnit output.
- Use `pnpm run spector --serve` to run the spector server for TypeSpec testing.
- Use `cargo test` in generated Rust project directories to run Rust tests.

## Files and Directories

- Content in files must end with a newline character.
