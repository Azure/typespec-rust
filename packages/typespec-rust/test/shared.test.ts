/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../src/codemodel/index.js';
import * as shared from '../src/shared/shared.js';
import { describe, expect, it } from 'vitest';

describe('typespec-rust: shared', () => {
  it('unwraps named types', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    expect(shared.asTypeOf<rust.StringType>(new rust.Etag(crate), 'String')).toBeUndefined();
    expect(shared.asTypeOf<rust.StringType>(new rust.StringType(), 'String')).toHaveProperty('kind', 'String');
    expect(shared.asTypeOf<rust.StringSlice>(new rust.Ref(new rust.StringSlice()), 'str')).toBeUndefined();
    expect(shared.asTypeOf<rust.StringSlice>(new rust.Ref(new rust.StringSlice()), 'str', 'ref')).toHaveProperty('kind', 'str');
    expect(shared.asTypeOf<rust.StringSlice>(new rust.Ref(new rust.Slice(new rust.Ref(new rust.StringSlice()))), 'str', 'ref', 'slice', 'ref')).toHaveProperty('kind', 'str');
  });
});
