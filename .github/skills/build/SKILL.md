---
name: build
description: >-
  Build the TypeSpec Rust emitter from source. Run this after cloning the repo,
  after pulling changes, or when TypeScript source files have been modified.
---

Build the TypeSpec Rust emitter.

1. Navigate to the emitter package directory:
   ```bash
   cd packages/typespec-rust
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Compile the TypeScript emitter to `dist/`:
   ```bash
   pnpm build
   ```
