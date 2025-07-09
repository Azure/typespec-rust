# Release History

## 0.18.0 (2025-07-09)

### Breaking Changes

**NOTE: this version is incompatible with earlier versions of `azure_core`**

* Renamed `PagerResult::More { next, .. }` to `PagerResult::More { continuation, .. }`.

### Other Changes

* Fixed malformed doc comments for enums and their values.
* Retooled some usage of `format!` macros.

## 0.17.0 (2025-06-19)

### Breaking Changes

**NOTE: this version is incompatible with earlier versions of `azure_core`**

* Switch to using `OffsetDateTime` from `azure_core::time` instead of the `time` crate.

### Features Added

* Added support for stylized path collection parameters.

## 0.16.0 (2025-06-12)

### Breaking Changes

**NOTE: this version is incompatible with earlier versions of `azure_core`**

* Methods that return a raw response with a marker type or no response have a return type of `Response<T, NoFormat>`.

### Other Changes

* Small refactoring to pageable method bodies.
* Updated to the latest tsp toolset.
* Response headers decorated with `Access.internal` are omitted from the response headers trait.

## 0.15.0 (2025-06-05)

### Breaking Changes

**NOTE: this version is incompatible with earlier versions of `azure_core`**

* Updated method bodies to use the new `azure_core::http::Format` in the pipeline.
* Methods that return a streaming response now return a `Result<RawResponse>` type.
* Updated implementations of paged methods per changes in `azure_core`.
  * Paged operations that return a collection and "next link" now return a per-item iterator of type `Pager<T>`.
  * If a paged operation returns more than the above, it returns a `PageIterator<T>` which behaves like previous versions of `Pager<T>`.

### Bugs Fixed

* Fixed handling for required API version client parameter.
* Don't propagate parent client fields to child clients that aren't used by the child.
* Fixed incorrect `content-type` header parameter when the request body is optional.
* Fixed some rare cases where a field name could start with an underscore character.

## 0.14.2 (2025-05-27)

### Features Added

* Added support for `plainDate` and `plainTime` types. They're emitted as `String` types.
* Added support for the `safeint` type. It's emitted as a `serde_json::Number` type.

### Bugs Fixed

* Fixed bad codegen when path parameters are aliased as client initializers.
* Fixed bad codegen for model with literal values.
* Fixed incorrect behavior for numeric types that use string encoding.
* Fixed decimal types to properly handle string/float encodings.

## 0.14.1 (2025-05-07)

### Bugs Fixed

* Fixed infinite loop for certain paged operations.
* Fixed missing borrow for required header parameters that are used in a closure (e.g. pageable operations).
* Fixed missing header constant when header traits are merged.
* Don't skip core types when they're explicitly referenced.
* Fixed missing content type for operations that have multiple responses and one of them doesn't include a response body (e.g. 200 and 204).
* Fixed more cases of enum names with symbols that can't be in an identifier.

### Other Changes

* Updated to the latest tsp toolset.
  * This includes the GA version of the compiler and supporting libraries.

## 0.14.0 (2025-05-01)

### Breaking Changes

* Model fields of type `HashMap` and `Vec` are now wrapped in an `Option<T>`.
  * The only exception is for the `Vec<T>` in paged responses.
* Parameters emitted as `&str` but required ownership are now emitted as `String`.
* Parameters of type `Vec<T>` that don't require ownership are now `&[T]`.

### Features Added

* Added support for pageable methods that use a continuation token when fetching pages.
* Added support for TypeSpec `decimal` and `decimal128` types.

### Bugs Fixed

* Fixed XML helpers for certain cases of wrapped arrays.
* Avoid infinite recursion in emitted types by using `Box<T>` to break the cycle.

### Other Changes

* Errors in the emitter are no longer surfaced as a crash.
* Skip `cargo fmt` if the emitter fails.

## 0.13.3 (2025-04-04)

### Other Changes

* Nullable types are treated as their underlying type (temporary until `Nullable<T>` arrives in core).

## 0.13.2 (2025-04-03)

### Other Changes

* Add doc comments for fields in client options types.
* Add missing doc comment(s) for multiple response header traits that get merged into a single trait.
* Added switch `temp-omit-doc-links` to omit links to types in doc comments.
  * NOTE: this switch is _temporary_ and will be removed in a future release.
* Updated to the latest tsp toolset.
  * This prompted updating the minimum node engine to `v20.x.y`.

## 0.13.1 (2025-04-01)

### Other Changes

* Recursively delete the contents of `src/generated` before writing the content to disk.
* Consolidate `use` statements.
* Omit `DO NOT EDIT` phrase from `src/lib.rs`.
* Skip LRO methods instead of erroring out.

## 0.13.0 (2025-03-24)

### Breaking Changes

**NOTE: this version is incompatible with earlier versions of `azure_core`**

* Updated references to types in `azure_core` based on its refactoring.
* Replaced references to `typespec_client_core` with the matching references in `azure_core`.

### Other Changes

* Use `crate::generated::` paths to types in doc links.

## 0.12.0 (2025-03-20)

### Breaking Changes

* The word `Etag` is no longer snake-cased to `e_tag`.

### Bugs Fixed

* Fixed serde for models containing hash maps/vectors of base64 encoded bytes and hash maps/vectors of `OffsetDateTime` types.
* Fixed an issue that could cause emitted code to use incorrect base64 encoding/decoding.
* Fixed serde annotations to omit empty `Vec<T>` for XML unwrapped arrays.
* Remove erroneous `url = url.join("")?;` that can happen in some cases.

### Other Changes

* Updated to the latest tsp toolset.
* Client struct fields are now always `pub(crate)`. In addition, internal and helper types are now `pub(crate)` instead of `pub` to help prevent inadvertent exposure.
* Report diagnostics from `@azure-tools/typespec-client-generator-core`.
* Refactor on-disk layout of generated code (simplifies re-exporting of types).
* The `lib.rs` file is no longer merged and will be ignored when it exists (a warning diagnostic is displayed).
  * Set `overwrite-lib-rs: true` to force overwriting the `lib.rs` file.

## 0.11.0 (2025-03-04)

### Breaking Changes

* Pageable methods will be renamed to start with `list` (e.g. `get_versions` becomes `list_versions`). A warning diagnostic is displayed when such a rename occurs.
* Sub-clients that specify a `@clientName` decorator will use that client name verbatim instead of having the parent client name as a prefix.

### Bug Fixes

* Client constructors will now return an error if the endpoint parameter doesn't start with `http[s]`.
* Added support for unsigned integer types.
* Preserve `pub(crate)` on sub-client fields that can also be individually initialized.
* Removed redundant client accessor parameters that can be inherited from the parent client.

### Other Changes

* Updated to the latest tsp toolset.
* Set minimum node engine to `v18.x`.

## 0.10.0 (2025-02-25)

### Breaking Changes

* Model fields of type `HashMap` or `Vec` are no longer wrapped in an `Option<T>`.

### Features Added

* Added response types/traits for methods that return typed headers.

### Other Changes

* Updated to the latest tsp toolset.

## 0.9.1 (2025-02-12)

### Bugs Fixed

* Added support for `enumvalue` types in method parameters.

## 0.9.0 (2025-02-10)

### Breaking Changes

* All client method option types are now exported from the `models` module (they are no longer in the root).

### Features Added

* Merge preexisting `lib.rs` content with generated content.

### Other Changes

* Fixed formatting of some doc comments.
  * HTML elements are converted to markdown equivalents.
  * Bare URLs are converted to Rust docs hyperlinks.
* The emitter will attempt to execute `cargo fmt` after files are written.
* Add `derive` feature for `typespec_client_core` dependency.

## 0.8.2 (2025-02-04)

### Other Changes

* Added various missing doc comments.

## 0.8.1 (2025-02-03)

### Bug Fixes

* Fixed bad codegen for certain cases of enum names.

## 0.8.0 (2025-02-03)

### Breaking Changes

* Required `String` parameters are now emitted as `&str`.
* Sub-client modules are no longer publicly exported.
  * All clients and their option types (client and/or method) are now exported in the `clients` module.
  * Instantiable clients and their client options types along with all client method options will be re-exported in the crate's root.

### Bugs Fixed

* Ensure that the API version query parameter in a pager's next link is set to the version on the client.

### Other Changes

* Input models are no longer `non_exhaustive`.
* Models and options types derive `SafeDebug` instead of `Debug`.

## 0.7.0 (2025-01-17)

### Breaking Changes

* Methods that take a binary body now take a `RequestContent<Bytes>` instead of `RequestContent<Vec<u8>>`.
* Methods that return a binary body now return a `Response` instead of `Response<()>`.
* Client accessor methods now include any modeled parameters.

### Bugs Fixed

* Use `serde` helpers to encode/decode time types in the specified wire format.

### Other Changes

* Various codegen changes to clean up Clippy issues.
* Updated to the latest tsp toolset.

## 0.6.0 (2025-01-08)

### Breaking Changes

* Models and enums used as output types no longer implement `TryFrom`. Use `into_body()` instead of `try_into()` when deserializing a modeled response.

### Bugs Fixed

* Add `derive` and `xml` features in `Cargo.toml` files as required.
* Borrow client fields used in method header parameters if their type is non-copyable.

### Features Added

* Added support for TypeSpec `duration` types. Numeric durations are emitted as their respective types. For ISO8601 they're emitted as `String` types.

### Other Changes

* Removed dependency on crate `async-std`.

## 0.5.1 (2024-12-19)

### Bugs Fixed

* Fixed bad codegen for enum values that contain a comma character.

### Features Added

* Added support for model properties of type `path`.
* Aggregate inherited model properties so they're all in the super-type.

### Other Fixes

* Various codegen changes to clean up Clippy issues.

## 0.5.0 (2024-12-19)

### Breaking Changes

* Updated serde helpers to use renamed methods from core. This requires core versions from commit `65917ad` or later.

## 0.4.1 (2024-12-19)

### Bugs Fixed

* Fixed an issue that could cause incorrect usage of client parameters in method bodies.

### Features Added

* Added support for endpoints with supplemental paths.
* Added support for `OAuth2` credentials when part of a union authentication scheme. Unsupported schemes are omitted.

### Other Changes

* Use `Url::join` for constructing the complete endpoint.
* Updated to the latest tsp toolset.

## 0.4.0 (2024-12-10)

### Breaking Changes

* `Azure.Core.eTag` types are now emitted as `azure_core::Etag` types.

### Bugs Fixed

* Pager callbacks will properly clone method options when it contains non-copyable types.

### Features Added

* Added support for required client parameters.

### Other Changes

* Methods create their own `Context` using the caller's as the parent.
* Updated to the latest version of `azure_core` which removed `AsClientMethodOptions` and it associated methods.

## 0.3.0 (2024-12-06)

### Breaking Changes

* Model fields of type `url` are now emitted as `String` types.

### Bugs Fixed

* Fixed an issue that could cause a crash with error `Error: didn't find body format for model Error`.

### Other Changes

* Don't overwrite an existing `Cargo.toml` file by default.
  * Specify `overwrite-cargo-toml=true` to force overwriting the file.
* Emitter args `crate-name` and `crate-version` have been marked as requried.
* Updated minimum tcgc to `v0.48.4`.

### Features Added

* Clients have an `endpoint()` method that returns its `azure_core::Url`.

## 0.2.0 (2024-12-03)

### Breaking Changes

* Optional client method parameters are now in the method's options type.
* Sub-clients now have the suffix `Client` on their type names.
* Methods parameters of type `impl Into<String>` have been changed to `String`.
* Client and method options builders have been removed. The options are now POD types.

### Bugs Fixed

* Add necessary calls to `to_string()` for header/path/query params.
* Fixed improperly clearing an endpoint's query parameters during client construction.
* Fixed constructing URLs from routes that contain query parameters.
* Fixed handling of spread parameters when the param and serde names are different.

### Features Added

* Models now derive `typespec_client_core::Model`.
* Added support for binary responses.
* Added support for TypeSpec spread parameters.
* Added support for pageable methods.
* Added support for XML payloads.
* Added partial support for base64 encoded values.
  * Headers, query parameters, and struct fiels work. The exception for struct fields is nested arrays (e.g. `Vec<Vec<u8>>`).
  * Requests and responses of base64 encoded values do not work due to the orphan problem.
* Added support for `x-ms-meta-*` headers in blob storage.

### Other Changes

* Use macros from `typespec_client_core` for creating enums.
* `TryFrom` implementations return an `azure_core::Result` instead of `std::result::Result`.
* Client parameters of type `impl AsRef<str>` have been changed to `&str`.

## 0.1.0 (2024-10-10)

* Initial release
