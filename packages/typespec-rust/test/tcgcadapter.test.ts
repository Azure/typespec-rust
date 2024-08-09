/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from '../src/tcgcadapter/helpers.js';
import { strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: tcgcadapter', () => {
  describe('helpers', () => {
    it('fixUpEnumValueName', async () => {
      strictEqual(helpers.fixUpEnumValueName('fooBar'), 'FooBar');
      strictEqual(helpers.fixUpEnumValueName('foo_bar'), 'FooBar');
      strictEqual(helpers.fixUpEnumValueName('V2022_12_01_preview'), 'V2022_12_01Preview');
      strictEqual(helpers.fixUpEnumValueName('V7.6_preview.1'), 'V7Dot6Preview1');
    });
  });
});
