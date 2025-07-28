#!/bin/bash

# Script to validate TypeSpec files
set -e

echo "Validating TypeSpec (.tsp) files..."

# Find all TypeSpec files
tsp_files=$(find . -name "*.tsp" -type f ! -path "./node_modules/*" ! -path "./*/node_modules/*")

if [ -z "$tsp_files" ]; then
  echo "No TypeSpec files found."
  exit 0
fi

echo "Found $(echo "$tsp_files" | wc -l) TypeSpec files..."

# For now, just check that files exist and are readable
# In the future, this could be extended to use TypeSpec compiler for validation
for file in $tsp_files; do
  if [ ! -r "$file" ]; then
    echo "Error: Cannot read TypeSpec file: $file"
    exit 1
  fi
done

echo "All TypeSpec files are readable and found!"
echo "Note: TypeSpec formatting validation with prettier is not yet supported."
echo "Consider using TypeSpec-specific formatting tools if available."