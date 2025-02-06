/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../src/codemodel/index.js';
import * as helpers from '../src/tcgcadapter/helpers.js';
import { deepEqual, strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: tcgcadapter', () => {
  describe('helpers', () => {
    it('fixUpEnumValueName', () => {
      strictEqual(helpers.fixUpEnumValueName('fooBar'), 'FooBar');
      strictEqual(helpers.fixUpEnumValueName('foo_bar'), 'FooBar');
      strictEqual(helpers.fixUpEnumValueName('V2022_12_01_preview'), 'V2022_12_01Preview');
      strictEqual(helpers.fixUpEnumValueName('V7.6_preview.1'), 'V7Dot6Preview1');
      strictEqual(helpers.fixUpEnumValueName('RSA_AES_KEY_WRAP_256'), 'RsaAesKeyWrap256');
      strictEqual(helpers.fixUpEnumValueName('CKM_AES_KEY_WRAP'), 'CkmAesKeyWrap');
      strictEqual(helpers.fixUpEnumValueName('RSA1_5'), 'RSA1_5');
      strictEqual(helpers.fixUpEnumValueName('RSA-OAEP'), 'RsaOaep');
      strictEqual(helpers.fixUpEnumValueName('RSA-OAEP-256'), 'RsaOaep256');
      strictEqual(helpers.fixUpEnumValueName('P-256K'), 'P256K');
    });

    it('sortClientParameters', () => {
      const endpointParam = new rust.ClientMethodParameter('endpoint', new rust.StringType(), true);
      const credentialParam = new rust.ClientMethodParameter('credential', new rust.StringType(), true);
      const someOtherParam = new rust.ClientEndpointParameter('something', new rust.StringType(), true, 'segment');

      let params = new Array<rust.ClientParameter>(endpointParam, credentialParam, someOtherParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, credentialParam, someOtherParam]);

      params = new Array<rust.ClientParameter>(credentialParam, endpointParam, someOtherParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, credentialParam, someOtherParam]);

      params = new Array<rust.ClientParameter>(someOtherParam, credentialParam, endpointParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, credentialParam, someOtherParam]);

      params = new Array<rust.ClientParameter>(endpointParam, credentialParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, credentialParam]);

      params = new Array<rust.ClientParameter>(credentialParam, endpointParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, credentialParam]);

      params = new Array<rust.ClientParameter>(endpointParam, someOtherParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, someOtherParam]);

      params = new Array<rust.ClientParameter>(someOtherParam, endpointParam);
      helpers.sortClientParameters(params);
      deepEqual(params, [endpointParam, someOtherParam]);
    });

    it('formatDocs', () => {
      strictEqual(helpers.formatDocs('does not change'), 'does not change');
      strictEqual(helpers.formatDocs('https://contoso.com/some-link becomes a hyperlink'), '<https://contoso.com/some-link> becomes a hyperlink');
      strictEqual(helpers.formatDocs('hyperlink https://contoso.com/some-link'), 'hyperlink <https://contoso.com/some-link>');
      strictEqual(helpers.formatDocs('make https://contoso.com/some-link a hyperlink'), 'make <https://contoso.com/some-link> a hyperlink');
      strictEqual(helpers.formatDocs('skip the period https://contoso.com/some-link.'), 'skip the period <https://contoso.com/some-link>.');
      strictEqual(helpers.formatDocs('already angled <https://contoso.com/some-link>'), 'already angled <https://contoso.com/some-link>');
      strictEqual(helpers.formatDocs('anchor <a href="https://contoso.com/fake/link">to markdown.</a> inline'), 'anchor [to markdown.](https://contoso.com/fake/link) inline');
      strictEqual(helpers.formatDocs('anchor <a href="https://contoso.com/fake/link">to markdown.</a> and https://contoso.com/some-link'), 'anchor [to markdown.](https://contoso.com/fake/link) and <https://contoso.com/some-link>');
      strictEqual(helpers.formatDocs('https://contoso.com/some-link anchor <a href="https://contoso.com/fake/link">to markdown.</a>'), '<https://contoso.com/some-link> anchor [to markdown.](https://contoso.com/fake/link)');
      strictEqual(helpers.formatDocs('https://contoso.com/some-link-one https://contoso.com/some-link-two https://contoso.com/some-link-three'), '<https://contoso.com/some-link-one> <https://contoso.com/some-link-two> <https://contoso.com/some-link-three>');
    });
  });
});
