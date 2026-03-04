---
name: validate
description: >-
  Run the full CI validation workflow locally before submitting a PR. Use this as
  a final check to ensure all Azure DevOps CI pipeline steps will pass.
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

3. **Run TypeScript unit tests with coverage:**
   ```bash
   pnpm run test-ci
   ```

4. **Regenerate test crates** (takes several minutes):
   ```bash
   pnpm run tspcompile
   ```

5. **Run modtidy and verify a clean git state** (mirroring CI):
   ```bash
   cd test
   pnpm -w modtidy $PWD
   cd ..
   git add -A .
   git diff --staged --exit-code
   ```

6. **Build generated Rust crates:**
   ```bash
   cd test
   cargo build
   ```

7. **Lint generated Rust code:**
   ```bash
   cargo clippy --workspace --all-features --all-targets --keep-going --no-deps
   cd ..
   ```

8. **Run integration tests** (requires spector server):
   ```bash
   pnpm spector --start
   cd test/spector
   cargo test --no-fail-fast
   cd ../..
   pnpm spector --stop
   ```

9. **Spell check** (from repo root):
   ```bash
   cd ../..
   cspell -c .vscode/cspell.json .
   ```

All steps must pass before submitting a pull request.
