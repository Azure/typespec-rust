/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore tcgcadapter

import * as rust from '../src/codemodel/index.js';
import * as helpers from '../src/tcgcadapter/helpers.js';
import { deepEqual, strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: tcgcadapter', () => {
  describe('helpers', () => {
    it('fixUpEnumValueName', () => {
      strictEqual(helpers.fixUpEnumValueNameWorker('fooBar', 'string'), 'FooBar');
      strictEqual(helpers.fixUpEnumValueNameWorker('foo_bar', 'string'), 'FooBar');
      strictEqual(helpers.fixUpEnumValueNameWorker('V2022_12_01_preview', 'string'), 'V2022_12_01Preview');
      strictEqual(helpers.fixUpEnumValueNameWorker('V7.6_preview.1', 'string'), 'V7Dot6Preview1');
      strictEqual(helpers.fixUpEnumValueNameWorker('RSA_AES_KEY_WRAP_256', 'string'), 'RsaAesKeyWrap256');
      strictEqual(helpers.fixUpEnumValueNameWorker('CKM_AES_KEY_WRAP', 'string'), 'CkmAesKeyWrap');
      strictEqual(helpers.fixUpEnumValueNameWorker('RSA1_5', 'string'), 'RSA1_5');
      strictEqual(helpers.fixUpEnumValueNameWorker('RSA-OAEP', 'string'), 'RsaOaep');
      strictEqual(helpers.fixUpEnumValueNameWorker('RSA-OAEP-256', 'string'), 'RsaOaep256');
      strictEqual(helpers.fixUpEnumValueNameWorker('RSA_OAEP256', 'string'), 'RsaOaep256');
      strictEqual(helpers.fixUpEnumValueNameWorker('P-256K', 'string'), 'P256K');
      strictEqual(helpers.fixUpEnumValueNameWorker('42', 'integer'), 'IntegerValue42');
      strictEqual(helpers.fixUpEnumValueNameWorker('3.14', 'float'), 'FloatValue3Point14');
      strictEqual(helpers.fixUpEnumValueNameWorker('42', 'int32'), 'Int32Value42');
      strictEqual(helpers.fixUpEnumValueNameWorker('3.14', 'float64'), 'Float64Value3Point14');
      // Test cases for consistent PascalCase (issue #480)
      strictEqual(helpers.fixUpEnumValueNameWorker('A128CBC', 'string'), 'A128Cbc');
      strictEqual(helpers.fixUpEnumValueNameWorker('A128CBCPAD', 'string'), 'A128Cbcpad');
      
      // More thorough test cases for word boundary detection
      strictEqual(helpers.fixUpEnumValueNameWorker('aaBBcc', 'string'), 'AaBBcc');
      strictEqual(helpers.fixUpEnumValueNameWorker('aa12BBB', 'string'), 'Aa12Bbb');
      strictEqual(helpers.fixUpEnumValueNameWorker('XMLHttpRequest', 'string'), 'XmlHttpRequest');
      strictEqual(helpers.fixUpEnumValueNameWorker('HTTPSConnection', 'string'), 'HttpsConnection');
      strictEqual(helpers.fixUpEnumValueNameWorker('IOError', 'string'), 'IoError');
      strictEqual(helpers.fixUpEnumValueNameWorker('URLParser', 'string'), 'UrlParser');
      strictEqual(helpers.fixUpEnumValueNameWorker('HTMLElement', 'string'), 'HtmlElement');
      strictEqual(helpers.fixUpEnumValueNameWorker('myVarName', 'string'), 'MyVarName');
      strictEqual(helpers.fixUpEnumValueNameWorker('someHTTPConnection', 'string'), 'SomeHttpConnection');
      strictEqual(helpers.fixUpEnumValueNameWorker('value123ABC', 'string'), 'Value123Abc');
      strictEqual(helpers.fixUpEnumValueNameWorker('ABC123DEF', 'string'), 'Abc123Def');
      strictEqual(helpers.fixUpEnumValueNameWorker('testABC123DEF456', 'string'), 'TestAbc123Def456');
      
      // Test cases with separators (should use existing logic)
      strictEqual(helpers.fixUpEnumValueNameWorker('a-1-bb-BB', 'string'), 'A1BbBb');
      strictEqual(helpers.fixUpEnumValueNameWorker('test_123_ABC', 'string'), 'Test123Abc');
      strictEqual(helpers.fixUpEnumValueNameWorker('my-var-NAME', 'string'), 'MyVarName');
      strictEqual(helpers.fixUpEnumValueNameWorker('RSA_OAEP256', 'string'), 'RsaOaep256');
      strictEqual(helpers.fixUpEnumValueNameWorker('A256_CBCPAD', 'string'), 'A256Cbcpad');
      strictEqual(helpers.fixUpEnumValueNameWorker('CKM_AES256_WRAP', 'string'), 'CkmAes256Wrap');
      
      // Edge cases
      strictEqual(helpers.fixUpEnumValueNameWorker('ABCD', 'string'), 'ABCD'); // No clear boundaries
      strictEqual(helpers.fixUpEnumValueNameWorker('abcd', 'string'), 'Abcd'); // All lowercase
      strictEqual(helpers.fixUpEnumValueNameWorker('A', 'string'), 'A'); // Single character
      strictEqual(helpers.fixUpEnumValueNameWorker('123', 'string'), 'StringValue123'); // Numbers only
      strictEqual(helpers.fixUpEnumValueNameWorker('a1b2c3', 'string'), 'A1B2C3'); // Alternating letters/numbers
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
