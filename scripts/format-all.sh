#!/bin/bash

# Master script to format all code
set -e

echo "=== Running comprehensive code formatting ==="
echo

# Format TypeScript/JavaScript with ESLint
echo "1. Formatting TypeScript/JavaScript with ESLint..."
cd packages/typespec-rust
npx eslint src test --fix --max-warnings=0
echo "✅ ESLint formatting completed!"
echo

# Go back to root
cd ../..

# Format with Prettier
echo "2. Formatting with Prettier (Markdown, JSON, TypeScript)..."
prettier --write "**/*.{md,json,ts,js}" \
  --ignore-path .gitignore \
  --ignore-path .prettierignore
echo "✅ Prettier formatting completed!"
echo

# Note about TypeSpec files
echo "3. TypeSpec files..."
echo "ℹ️  TypeSpec files currently require manual formatting (no automated tool available)"
echo

# Format Rust files
echo "4. Formatting Rust files with rustfmt..."
# Find all Rust source files, excluding generated test files with edition issues
rust_files=$(find . -name "*.rs" -type f \
  ! -path "./packages/typespec-rust/test/spector/*/src/generated/*" \
  ! -path "./target/*" \
  ! -path "./*/target/*")

if [ -n "$rust_files" ]; then
  echo "Formatting $(echo "$rust_files" | wc -l) Rust files..."
  echo "$rust_files" | xargs rustfmt --edition 2021
  echo "✅ Rust formatting completed!"
else
  echo "No Rust source files found to format."
fi
echo

echo "=== All code formatting completed! ==="