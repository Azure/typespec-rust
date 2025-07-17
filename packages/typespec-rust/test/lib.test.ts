/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { $lib } from '../src/lib.js';
import { describe, expect, it } from 'vitest';

describe('typespec-rust: lib', () => {
  it('should have documentation for all emitter options', () => {
    const schema = $lib.emitter?.options;
    expect(schema).toBeDefined();
    
    if (!schema?.properties) {
      throw new Error('Emitter options schema properties not defined');
    }

    // Get all the option properties
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
      if (typeof property === 'object' && property !== null) {
        expect(property).toHaveProperty('description');
        expect(typeof (property as any).description).toBe('string');
        expect((property as any).description.length).toBeGreaterThan(0);
      }
    }
  });

  it('should have required options marked correctly', () => {
    const schema = $lib.emitter?.options;
    expect(schema).toBeDefined();
    expect(schema?.required).toContain('crate-name');
    expect(schema?.required).toContain('crate-version');
  });

  it('should have appropriate default values for optional options', () => {
    const schema = $lib.emitter?.options;
    expect(schema).toBeDefined();
    
    if (!schema?.properties) {
      throw new Error('Emitter options schema properties not defined');
    }

    const properties = schema.properties;
    
    // Check that boolean options have default values
    expect((properties as any)['overwrite-cargo-toml']).toHaveProperty('default', false);
    expect((properties as any)['overwrite-lib-rs']).toHaveProperty('default', false);
    expect((properties as any)['temp-omit-doc-links']).toHaveProperty('default', false);
  });
});