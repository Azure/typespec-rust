# Skill: Spector Test Wiring

## When to Use

Use this when adding a new Spector scenario to the emitter's test suite. This applies when:
- A new spec is added to `@typespec/http-specs` or `@azure-tools/azure-http-specs`
- An existing spec was previously commented out and needs to be enabled
- The emitter gains support for a previously unsupported spec

## Steps

### 1. Identify the Spec Source

- **Standard HTTP specs:** `node_modules/@typespec/http-specs/specs/<path>/`
- **Azure specs:** `node_modules/@azure-tools/azure-http-specs/specs/<path>/`
- Check for `client.tsp` first, then `main.tsp` — the compiler prefers `client.tsp`.

### 2. Add Entry to `tspcompile.js`

In `packages/typespec-rust/.scripts/tspcompile.js`:

- For HTTP specs, add to `httpSpecsGroup`:
  ```js
  'spector_<cratename>': {input: '<relative/path/to/spec>'},
  ```
- For Azure specs, add to `azureHttpSpecsGroup`:
  ```js
  'spector_<cratename>': {input: '<relative/path/to/spec>'},
  ```
- Use `output:` override if the output directory should differ from the input path.
- If the spec entry is `.tsp`-specific (e.g., `client.tsp`), include the filename in `input`.

### 3. Add Workspace Member to `test/Cargo.toml`

Add the new crate's directory (relative to `test/`) to the `[workspace] members` array:
```toml
"spector/<path/matching/output/dir>",
```

**Important:** Add the workspace member BEFORE regenerating, or `cargo fmt` will fail during generation.

### 4. Regenerate

```bash
cd packages/typespec-rust
pnpm build        # Compile TypeScript first
pnpm tspcompile   # Generate all test crates
```

Or filter to just the new crate:
```bash
pnpm tspcompile --filter=spector_<cratename>
```

### 5. Verify

```bash
cd test
cargo check       # Ensure generated Rust compiles
cargo clippy      # Check for warnings
```

### 6. Commit

Commit both the configuration changes AND the generated crate files. Generated code under `src/generated/` is checked in.

## Common Gotchas

1. **`noauth` spec path:** It's at `authentication/noauth/union/`, not `authentication/noauth/`.
2. **Non-discriminated unions:** The emitter does NOT support `T1 | T2` style unions. Specs using these will fail with `"non-discriminated unions are not supported"`.
3. **Name collisions:** Nested discriminators can produce a model struct and union enum with the same name. This causes Rust `E0255` errors.
4. **Workspace ordering:** The `members` array in `test/Cargo.toml` should be alphabetically ordered by convention.
5. **`cargo fmt` bootstrap:** If you regenerate before adding the workspace member, `cargo fmt` fails but code IS generated. Just add the member and regenerate again.
