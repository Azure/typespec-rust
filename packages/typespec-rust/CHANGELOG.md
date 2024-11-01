# Release History

## 0.2.0 (Unreleased)

### Breaking Changes

* Optional client method parameters are now in the method's options type.
* Sub-clients now have the suffix `Client` on their type names.
* Methods parameters of type `impl Into<String>` have been changed to `String`.
* Client and method options builders have been removed. The options are now POD types.

### Bugs Fixed

* Add necessary calls to `to_string()` for header/path/query params.

### Features Added

* Models now derive `typespec_client_core::Model`.
* Added support for binary responses.
* Added support for TypeSpec spread parameters.

### Other Changes

* Use macros from `typespec_client_core` for creating enums.
* `TryFrom` implementations return an `azure_core::Result` instead of `std::result::Result`.
* Client parameters of type `impl AsRef<str>` have been changed to `&str`.

## 0.1.0 (2024-10-10)

* Initial release
