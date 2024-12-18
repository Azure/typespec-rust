# Release History

## 0.4.1 (Unreleased)

### Bugs Fixed

* Fixed an issue that could cause incorrect usage of client parameters in method bodies.

### Features Added

* Added support for endpoints with supplemental paths.

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
