# Parameter Reinjection in Pageable Operations

This document demonstrates the new parameter reinjection feature for pageable operations in TypeSpec Rust SDK generation.

## Overview

Parameter reinjection allows certain parameters from the original request to be automatically carried forward to subsequent page requests in pageable operations. This is useful when filter parameters or other query parameters need to be preserved across pagination.

## How It Works

When a TypeSpec definition includes `nextLinkReInjectedParametersSegments` in the pagination metadata, the TypeSpec Rust emitter will:

1. **Detect reinjected parameters** from the TCGC `nextLinkReInjectedParametersSegments` field
2. **Capture parameter values** from the current page response
3. **Include them in the next page URL** as query parameters

## Generated Code Example

For a pageable operation with reinjected parameters, the generated Rust code will include:

```rust
// Before (without reinjection)
continuation: next_link.parse()?

// After (with reinjection)
continuation: {
    let mut url = next_link.parse()?;
    {
        let mut query_pairs = url.query_pairs_mut();
        for (key, value) in [("filter", res.filter.as_ref().map(|v| v.to_string()).unwrap_or_default())] {
            if !value.is_empty() {
                query_pairs.append_pair(key, &value);
            }
        }
    }
    url
}
```

## Backward Compatibility

This feature maintains full backward compatibility:
- Existing pageable operations without reinjected parameters continue to work unchanged
- The reinjection logic only activates when `nextLinkReInjectedParametersSegments` is present
- No breaking changes to existing APIs

## Implementation Details

- **TypeScript Interface**: Extended `PageableStrategyNextLink` to include optional `reinjectedParameters` field
- **Adapter Logic**: Enhanced `adaptPageableMethodStrategy` to process reinjected parameter segments
- **Code Generation**: Updated pageable method generation to include reinjection logic in continuation URLs
- **Error Handling**: Proper error messages for unsupported nested reinjection scenarios

The implementation handles multiple reinjected parameters and automatically filters out empty values to avoid polluting URLs with unnecessary query parameters.