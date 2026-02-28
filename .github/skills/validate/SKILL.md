---
name: validate
description: Run the full CI validation workflow locally before submitting a PR
---

Run the full CI validation workflow locally. This replicates all checks from the Azure DevOps pipeline (`eng/pipelines/ci.yml`).

## Steps

1. **Build the emitter:**
   ```bash
   cd packages/typespec-rust
   pnpm install
   pnpm build
   ```

2. **Lint TypeScript code:**
   ```bash
   pnpm eslint
   ```

3. **Run TypeScript unit tests:**
   ```bash
   pnpm test
   ```

4. **Regenerate test crates** (takes several minutes):
   ```bash
   pnpm run tspcompile
   ```

5. **Verify no uncommitted diffs** in generated code:
   ```bash
   git diff --exit-code packages/typespec-rust/test
   ```

6. **Build generated Rust crates:**
   ```bash
   cd packages/typespec-rust/test
   cargo build
   ```

7. **Lint generated Rust code:**
   ```bash
   cargo clippy --workspace --all-features --all-targets --keep-going --no-deps
   ```

8. **Run integration tests** (requires spector server):
   ```bash
   cd packages/typespec-rust
   pnpm spector --start
   cd test/spector
   cargo test --no-fail-fast
   cd ../../
   pnpm spector --stop
   ```

9. **Spell check** (from repo root):
   ```bash
   cspell -c .vscode/cspell.json .
   ```

All steps must pass before submitting a pull request.
