---
name: build
description: Build the TypeSpec Rust emitter from source
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

For continuous development with automatic recompilation, use watch mode instead of `pnpm build`:
```bash
pnpm watch
```
