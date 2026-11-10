# SDK handoff: Resource Manager polling

Two review findings on [TypeSpec Rust PR #1057][pr] require changes in
`Azure/azure-sdk-for-rust`, not emitter-specific polling logic.
This plan is intended for a session in that SDK repository.

The emitter currently pins `azure_core` to
`02db90bf72e046b27a6ee01f3040bda2d5791c07` in
`packages/typespec-rust/test/Cargo.toml`. Reproduce against that revision before
applying changes. Do not copy the emitter's generated clients into core or change
their public method signatures to work around these defects.

## Affected SDK implementation

- `sdk/core/azure_core/src/http/poller/resource_manager.rs`:
  `PollingInfo::new`, `PollingInfo::status`, polling URL selection, and
  `PollingInfo::final_link`.
- `sdk/core/azure_core/src/http/poller/resource_manager/tests.rs`:
  scripted transport and final-response-selection tests.

## 1. Poll the original GET URL after an empty 202 without polling headers

[Review thread][get-thread]

### Reproduction

1. Send GET to an ARM resource URL containing `api-version`.
2. Receive HTTP 202, an empty body, and only `Retry-After: 0`.
   There is no `Location`, `Operation-Location`, or `Azure-AsyncOperation`.
3. Expect another GET to the original URL, including its query.
4. Receive HTTP 200 with the final resource and return that response.

The pinned implementation chooses `PollingMethod::Nop` for this initial GET.
`PollingInfo::status` rejects the 202 with
"Resource Manager long-running operation response is missing a polling URL"
instead of continuing.

The emitter's existing Spector `getLro` scenario supplies `Location` pointing to
the original URL and already passes. It covers the empty-202-body bug addressed
by Azure/typespec-rust#1028, not this missing-header case. Preserve that coverage.

### SDK changes and acceptance

- Support original-URL polling for GET/202 without polling headers, including
  repeated empty 202 responses before the terminal response.
- Honor `Retry-After` and preserve request context, API version, and normal GET
  request handling. Do not attempt to deserialize empty 202 bodies.
- Keep synchronous GET/200 behavior and existing header-driven polling unchanged.
- Retain errors for POST/DELETE 202 responses without a supported polling URL.
  Do not simply make every `Nop` response succeed or poll an arbitrary URL.
- Add SDK tests for the exact sequence, repeated 202s, and terminal response
  status/body/headers. Check request URLs and methods.

Emitter regression:
`get_lro_without_polling_headers_retries_original_url` in
`test/other/resource_manager/tests/resource_manager.rs`.
It also verifies that the final model is returned and every scripted request
is consumed; the scripted transport checks the API version on each GET.

## 2. Honor OriginalUrl for POST polled through Operation-Location

[Review thread][original-thread]

### Reproduction

1. Send POST `/original` with `Some(FinalStateVia::OriginalUrl)`.
2. Receive HTTP 202 with `Operation-Location: /operations/1`.
3. GET `/operations/1` returns `{"status":"Succeeded"}` with neither a
   `Location` header nor a `resourceLocation` property.
4. Expect GET `/original`, then return its `{"data":"final"}` response.

The pinned `PollingInfo::final_link` handles `OriginalUrl` in its
`AzureAsyncOperation` branch but not its `OperationLocation` branch. For this
POST, it returns the terminal monitor as the final resource and skips step 4.

The old emitter test used `azure-asyncoperation` despite the TypeSpec fixture
declaring `operation-location`. Keep that protocol as a separate passing test,
but do not substitute it for this failing sequence.

### SDK changes and acceptance

- Honor explicit `OriginalUrl` for this protocol and original POST method,
  returning the final GET response rather than the monitor.
- Define and test its precedence over fallback final-resource links consistently
  with the explicit selector contract. Do not override the explicit choice with
  a monitor `resourceLocation` or an unrelated `Location` fallback.
- Preserve omitted-selector defaults, explicit `Location`, resourceLocation
  fallback when no overriding selector exists, PUT/PATCH behavior, empty outputs,
  and `OperationLocation` inline-result extraction.
- Add SDK tests for the exact sequence, explicit selection with competing links,
  and the preserved fallbacks. Assert the final request and response, not merely
  successful deserialization of an optional-field model.

Emitter regression:
`original_url_with_operation_location_fetches_the_original_resource` in
`test/other/resource_manager/tests/resource_manager.rs`.
It checks `data == "final"` and that the final GET consumed its scripted step.

## SDK validation

From the SDK repository root, run the focused Resource Manager tests first:

```sh
cargo test -p azure_core --features unstable_resource_manager resource_manager
```

Then run the applicable core test suite, formatting, Clippy, and documentation
checks according to that checkout's contributor instructions. Complete a
requested test batch and report failures before repairing them.

## Return to the emitter

Until core is fixed, both exact regressions are ignored with explicit blocker
reasons; supported scenarios remain enabled. From the emitter package directory,
run them deliberately to reproduce the pinned-core failures:

```sh
cargo test --manifest-path test/Cargo.toml -p azure_resourcemanager_test \
  --test resource_manager get_lro_without_polling_headers_retries_original_url \
  -- --ignored --exact
cargo test --manifest-path test/Cargo.toml -p azure_resourcemanager_test \
  --test resource_manager original_url_with_operation_location_fetches_the_original_resource \
  -- --ignored --exact
```

After both SDK fixes are available:

1. Update the emitter test workspace's SDK revision and lockfile, including
   fixture development dependencies pinned to that same SDK revision.
2. Remove only these two ignore attributes and run both regressions normally.
3. Run all offline ARM tests, existing ARM Spector scenarios (including
   `getLro`), generated-client builds, and Clippy.
4. Update this handoff and the PR review dispositions with the fixed revision
   and passing evidence. Until then, do not claim these two defects are fixed.

[pr]: https://github.com/Azure/typespec-rust/pull/1057
[get-thread]: https://github.com/Azure/typespec-rust/pull/1057#discussion_r4531035747
[original-thread]: https://github.com/Azure/typespec-rust/pull/1057#discussion_r4531035822
