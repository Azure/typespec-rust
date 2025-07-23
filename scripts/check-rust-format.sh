#!/bin/bash

# Script to check Rust formatting, excluding generated files with edition issues
set -e

echo "Checking Rust file formatting with rustfmt..."

# Find all Rust source files, excluding generated test files with edition issues
rust_files=$(find . -name "*.rs" -type f \
  ! -path "./packages/typespec-rust/test/spector/*/src/generated/*" \
  ! -path "./target/*" \
  ! -path "./*/target/*")

if [ -z "$rust_files" ]; then
  echo "No Rust source files found to check."
  exit 0
fi

# Check each file with rustfmt
echo "Found $(echo "$rust_files" | wc -l) Rust files to check..."
echo "$rust_files" | xargs rustfmt --check --edition 2021

echo "All Rust files are properly formatted!"