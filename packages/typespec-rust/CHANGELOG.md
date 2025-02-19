# Release History

## 0.10.0 (unreleased)

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
