# Release History

## 0.1.1 (Unreleased)

### Breaking Changes

* Optional client method parameters are now in the method's options type and their associated builder methods have been added.

### Bugs Fixed

* Add necessary calls to `to_string()` for header/path/query params.

### Features Added

* Models now derive `typespec_client_core::Model`.

### Other Changes

* Use macros from `typespec_client_core` for creating enums.

## 0.1.0 (2024-10-10)

* Initial release
