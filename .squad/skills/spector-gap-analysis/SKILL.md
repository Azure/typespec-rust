---
name: "spector-gap-analysis"
description: "How to analyze Spector test coverage gaps for the TypeSpec Rust emitter"
domain: "testing"
confidence: "high"
source: "earned — Keaton performed full gap analysis 2025-07-18"
---

## Context

When assessing Spector coverage, you need to cross-reference three data sources:
1. Our local `test/spector/` directory (what we have)
2. `microsoft/typespec` repo at `packages/http-specs/specs/` (HTTP spec scenarios)
3. `Azure/typespec-azure` repo at `packages/azure-http-specs/specs/` (Azure-specific scenarios)

## Patterns

- **Scenario = directory with main.tsp**: Each leaf directory containing a `main.tsp` file is one Spector scenario.
- **Nested scenarios exist**: e.g., `type/union/` has BOTH a root `main.tsp` AND a `discriminated/` subdirectory. Both are separate scenarios.
- **Azure specs split across two repos**: Core HTTP specs are in microsoft/typespec. Azure-specific (TCGC, resource-manager, Azure core) are in Azure/typespec-azure.
- **The can-i-use page is a JS SPA**: Cannot be fetched with simple HTTP. Must enumerate spec directories from GitHub repos directly.
- **Difficulty assessment**: Check `packages/typespec-rust/src/` for existing infrastructure before rating difficulty. Search for keywords like "multipart", "stream", "additional", "conditional".

## Examples

To enumerate all upstream scenarios:
```
# HTTP specs
github-mcp: get_file_contents owner:microsoft repo:typespec path:packages/http-specs/specs

# Azure specs  
github-mcp: get_file_contents owner:Azure repo:typespec-azure path:packages/azure-http-specs/specs
```

Then recursively drill into each directory until you find leaf `main.tsp` files.

## Anti-Patterns

- Don't try to scrape the can-i-use webpage — it's client-rendered JavaScript.
- Don't assume our `test/spector/` directories map 1:1 to upstream names — `client/enum-conflict` is project-specific, not from upstream.
- Don't count directories without main.tsp as scenarios — intermediate directories are just organizational.
