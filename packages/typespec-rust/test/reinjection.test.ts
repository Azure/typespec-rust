/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rust from '../src/codemodel/index.js';
import { strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: reinjection codegen', () => {
  it('generates reinjected parameters in continuation', () => {
    // Create a mock pageable method with reinjected parameters
    const nextLinkField = new rust.ModelField('next_link', 'next_link', 'pub', new rust.StringType(), true);
    const filterField = new rust.ModelField('filter', 'filter', 'pub', new rust.StringType(), true);
    const sortField = new rust.ModelField('sort', 'sort', 'pub', new rust.StringType(), true);
    
    const strategy = new rust.PageableStrategyNextLink(nextLinkField, [filterField, sortField]);
    
    // Verify the strategy was created correctly
    strictEqual(strategy.kind, 'nextLink');
    strictEqual(strategy.nextLink, nextLinkField);
    strictEqual(strategy.reinjectedParameters?.length, 2);
    strictEqual(strategy.reinjectedParameters?.[0], filterField);
    strictEqual(strategy.reinjectedParameters?.[1], sortField);
  });

  it('generates continuation without reinjected parameters when none exist', () => {
    const nextLinkField = new rust.ModelField('next_link', 'next_link', 'pub', new rust.StringType(), true);
    const strategy = new rust.PageableStrategyNextLink(nextLinkField);
    
    strictEqual(strategy.kind, 'nextLink');
    strictEqual(strategy.nextLink, nextLinkField);
    strictEqual(strategy.reinjectedParameters, undefined);
  });
});
