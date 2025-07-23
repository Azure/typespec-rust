/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $lib } from '../src/lib.js';
import { describe, expect, it } from 'vitest';

// Type definitions for the schema structure
interface SchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  nullable?: boolean;
}

interface EmitterOptionsSchema {
  type: string;
  properties: Record<string, SchemaProperty>;
  required: string[];
}

// Type guard to check if schema is properly structured
function isEmitterOptionsSchema(schema: unknown): schema is EmitterOptionsSchema {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    'properties' in schema &&
    typeof (schema as Record<string, unknown>).properties === 'object' &&
    'required' in schema &&
    Array.isArray((schema as Record<string, unknown>).required)
  );
}

// Type guard to check if property has description
function hasDescription(property: SchemaProperty): property is SchemaProperty & { description: string } {
  return typeof property.description === 'string' && property.description.length > 0;
}

describe('typespec-rust: lib', () => {
  it('should have documentation for all emitter options', () => {
    const schema = $lib.emitter?.options;
    expect(schema).toBeDefined();

    if (!isEmitterOptionsSchema(schema)) {
      throw new Error('Emitter options schema is not properly structured');
    }

    const properties = schema.properties;
    const optionNames = Object.keys(properties);

    // Verify we have the expected options
    expect(optionNames).toContain('crate-name');
    expect(optionNames).toContain('crate-version');
    expect(optionNames).toContain('overwrite-cargo-toml');
    expect(optionNames).toContain('overwrite-lib-rs');
    expect(optionNames).toContain('temp-omit-doc-links');

    // Verify each option has a description
    for (const optionName of optionNames) {
      const property = properties[optionName];
      expect(property).toBeDefined();
      expect(typeof property).toBe('object');

      // Each property should have a description
      if (property) {
        expect(hasDescription(property)).toBe(true);
        if (hasDescription(property)) {
          expect(property.description.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should have required options marked correctly', () => {
    const schema = $lib.emitter?.options;
    expect(schema).toBeDefined();

    if (!isEmitterOptionsSchema(schema)) {
      throw new Error('Emitter options schema is not properly structured');
    }

    expect(schema.required).toContain('crate-name');
    expect(schema.required).toContain('crate-version');
  });

  it('should have appropriate default values for optional options', () => {
    const schema = $lib.emitter?.options;
    expect(schema).toBeDefined();

    if (!isEmitterOptionsSchema(schema)) {
      throw new Error('Emitter options schema is not properly structured');
    }

    const properties = schema.properties;

    // Check that boolean options have default values
    expect(properties['overwrite-cargo-toml']).toHaveProperty('default', false);
    expect(properties['overwrite-lib-rs']).toHaveProperty('default', false);
    expect(properties['temp-omit-doc-links']).toHaveProperty('default', false);
  });
});
