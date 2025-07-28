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

## Files and Directories

- Content in files must end with a newline character.
