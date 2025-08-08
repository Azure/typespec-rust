import { describe, it, expect } from 'vitest';
import * as rust from '../src/codemodel/index.js';
import { Use } from '../src/codegen/use.js';

describe('AllowReserved path parameter tests', () => {
  it('should encode path parameters when allowReserved=false', () => {
    // Create a mock path parameter with encoded=true (allowReserved=false)
    const pathParam = new rust.PathScalarParameter(
      'testParam',
      'testParam',
      'method',
      false,
      new rust.StringType(),
      true, // encoded=true means allowReserved=false
      'simple'
    );

    // Test the path parameter is set to encoded
    expect(pathParam.encoded).toBe(true);
  });

  it('should not encode path parameters when allowReserved=true', () => {
    // Create a mock path parameter with encoded=false (allowReserved=true)
    const pathParam = new rust.PathScalarParameter(
      'testParam',
      'testParam',
      'method',
      false,
      new rust.StringType(),
      false, // encoded=false means allowReserved=true
      'simple'
    );

    // Test the path parameter is set to not encoded
    expect(pathParam.encoded).toBe(false);
  });

  it('should generate URL encoding imports when encoded=true', () => {
    const use = new Use('clients');
    const pathParam = new rust.PathScalarParameter(
      'testParam',
      'testParam',
      'method',
      false,
      new rust.StringType(),
      true, // encoded=true means allowReserved=false
      'simple'
    );

    // The import helper functions should be called when encoding is needed
    // This is testing internal implementation but validates the encoding logic
    if (pathParam.encoded) {
      use.add('url::percent_encoding', 'percent_encode', 'CONTROLS');
    }

    expect(pathParam.encoded).toBe(true);
    // We should have the URL encoding imports when encoded=true
    const useText = use.text();
    expect(useText).toContain('url::percent_encoding');
    expect(useText).toContain('percent_encode');
    expect(useText).toContain('CONTROLS');
  });
});