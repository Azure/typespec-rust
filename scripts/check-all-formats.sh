#!/bin/bash

# Master script to check all code formatting
set -e

echo "=== Running comprehensive format checks ==="
echo

# Check TypeScript/JavaScript with ESLint
echo "1. Checking TypeScript/JavaScript formatting with ESLint..."
cd packages/typespec-rust
npx eslint src test --max-warnings=0
echo "✅ ESLint checks passed!"
echo

# Go back to root
cd ../..

# Check Prettier formatting
echo "2. Checking Prettier formatting (Markdown, JSON, TypeScript)..."
prettier --check "**/*.{md,json,ts,js}" \
  --ignore-path .gitignore \
  --ignore-path .prettierignore
echo "✅ Prettier checks passed!"
echo

# Check TypeSpec files
echo "3. Validating TypeSpec files..."
./scripts/check-typespec-format.sh
echo "✅ TypeSpec validation passed!"
echo

# Check Rust formatting
echo "4. Checking Rust formatting with rustfmt..."
./scripts/check-rust-format.sh
echo "✅ Rust formatting checks passed!"
echo

echo "=== All format checks completed successfully! ==="