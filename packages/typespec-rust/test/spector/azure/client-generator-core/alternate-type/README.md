# Alternate Type Test

This test directory corresponds to the Azure HTTP Specs test located at:
`specs/azure/client-generator-core/alternate-type`

## Current Status

**NOT YET IMPLEMENTED** - This test is currently blocked and cannot be generated.

## Reason

The spec contains non-discriminated unions (specifically `id?: string | numeric` in the Feature model),
which are not currently supported by the Rust emitter. 

## What needs to be done

To enable this test, one of the following approaches is needed:

1. **Implement non-discriminated union support in the Rust emitter** - This would allow the Feature model
   to be generated with a field that can be either string or numeric.

2. **Use a flexible type for non-discriminated unions** - Implement support to generate such fields as
   `serde_json::Value` or a similar type that can represent multiple possible types.

3. **Add Rust-specific alternate type mapping** - If there's a suitable Rust GeoJSON library, add a
   Rust-specific `@@alternateType` decorator in the spec's client.tsp file to use an external type
   instead of generating the model.

## Reference

- TypeSpec spec: `@azure-tools/azure-http-specs/specs/azure/client-generator-core/alternate-type`
- Related entry in `tspcompile.js`: `spector_alternatetype` (commented out)

## See Also

Other commented-out tests with similar limitations:
- `spector_union` - non-discriminated unions
- `spector_multipart` - multipart form data
- `spector_visibility` - visibility modifiers
