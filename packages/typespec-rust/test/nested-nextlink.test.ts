import { strict as assert } from 'assert';
import { describe, it } from 'vitest';
import * as rust from '../src/codemodel/client.js';
import * as types from '../src/codemodel/types.js';

describe('PageableStrategyNextLink', () => {
  it('should handle single field path', () => {
    const field = new types.ModelField('nextLink', 'next_link', 'pub', new types.StringType(), false);
    const strategy = new rust.PageableStrategyNextLink([field]);
    
    assert.equal(strategy.kind, 'nextLink');
    assert.equal(strategy.nextLinkPath.length, 1);
    assert.equal(strategy.nextLinkPath[0].name, 'nextLink');
  });

  it('should handle nested field path', () => {
    const nestedModel = new types.Model('NestedNext', 'pub', types.ModelFlags.Unspecified);
    const nestedField = new types.ModelField('nestedNext', 'nested_next', 'pub', nestedModel, false);
    const nextField = new types.ModelField('next', 'next', 'pub', new types.StringType(), false);
    const strategy = new rust.PageableStrategyNextLink([nestedField, nextField]);
    
    assert.equal(strategy.kind, 'nextLink');
    assert.equal(strategy.nextLinkPath.length, 2);
    assert.equal(strategy.nextLinkPath[0].name, 'nestedNext');
    assert.equal(strategy.nextLinkPath[1].name, 'next');
  });
});