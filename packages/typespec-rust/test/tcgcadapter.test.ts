/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell:disable

import * as rust from '../src/codemodel/index.js';
import * as helpers from '../src/tcgcadapter/helpers.js';
import * as naming from '../src/tcgcadapter/naming.js';
import { deepEqual, strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: tcgcadapter', () => {
  describe('helpers', () => {
    it('fixUpEnumValueName', () => {
      strictEqual(naming.fixUpEnumValueNameWorker('fooBar'), 'FooBar');
      strictEqual(naming.fixUpEnumValueNameWorker('foo_bar'), 'FooBar');
      strictEqual(naming.fixUpEnumValueNameWorker('V2022_12_01_preview'), 'V2022_12_01Preview');
      strictEqual(naming.fixUpEnumValueNameWorker('V7.6_preview.1'), 'V7_6Preview1');
      strictEqual(naming.fixUpEnumValueNameWorker('RSA_AES_KEY_WRAP_256'), 'RsaAesKeyWrap256');
      strictEqual(naming.fixUpEnumValueNameWorker('CKM_AES_KEY_WRAP'), 'CkmAesKeyWrap');
      strictEqual(naming.fixUpEnumValueNameWorker('RSA1_5'), 'Rsa1_5');
      strictEqual(naming.fixUpEnumValueNameWorker('RSA'), 'Rsa');
      strictEqual(naming.fixUpEnumValueNameWorker('RSA-OAEP'), 'RsaOaep');
      strictEqual(naming.fixUpEnumValueNameWorker('RSA-OAEP-256'), 'RsaOaep256');
      strictEqual(naming.fixUpEnumValueNameWorker('P-256K'), 'P256K');
      strictEqual(naming.fixUpEnumValueNameWorker('42'), 'INVLD_IDENTIFIER_42');
      strictEqual(naming.fixUpEnumValueNameWorker('3.14'), 'INVLD_IDENTIFIER_3_14');
      strictEqual(naming.fixUpEnumValueNameWorker('42'), 'INVLD_IDENTIFIER_42');
      strictEqual(naming.fixUpEnumValueNameWorker('3.14'), 'INVLD_IDENTIFIER_3_14');
      strictEqual(naming.fixUpEnumValueNameWorker('A128CBC'), 'A128Cbc');
      strictEqual(naming.fixUpEnumValueNameWorker('A128CBCPAD'), 'A128Cbcpad');
      strictEqual(naming.fixUpEnumValueNameWorker('aaBBcc'), 'AaBBcc');
      strictEqual(naming.fixUpEnumValueNameWorker('aa12BBB'), 'Aa12Bbb');
      strictEqual(naming.fixUpEnumValueNameWorker('XMLHttpRequest'), 'XmlHttpRequest');
      strictEqual(naming.fixUpEnumValueNameWorker('HTTPSConnection'), 'HttpsConnection');
      strictEqual(naming.fixUpEnumValueNameWorker('IOError'), 'IoError');
      strictEqual(naming.fixUpEnumValueNameWorker('URLParser'), 'UrlParser');
      strictEqual(naming.fixUpEnumValueNameWorker('HTMLElement'), 'HtmlElement');
      strictEqual(naming.fixUpEnumValueNameWorker('myVarName'), 'MyVarName');
      strictEqual(naming.fixUpEnumValueNameWorker('someHTTPConnection'), 'SomeHttpConnection');
      strictEqual(naming.fixUpEnumValueNameWorker('value123ABC'), 'Value123Abc');
      strictEqual(naming.fixUpEnumValueNameWorker('ABC123DEF'), 'Abc123Def');
      strictEqual(naming.fixUpEnumValueNameWorker('testABC123DEF456'), 'TestAbc123Def456');
      strictEqual(naming.fixUpEnumValueNameWorker('a-1-bb-BB'), 'A1BbBb');
      strictEqual(naming.fixUpEnumValueNameWorker('test_123_ABC'), 'Test123Abc');
      strictEqual(naming.fixUpEnumValueNameWorker('my-var-NAME'), 'MyVarName');
      strictEqual(naming.fixUpEnumValueNameWorker('RSA_OAEP256'), 'RsaOaep256');
      strictEqual(naming.fixUpEnumValueNameWorker('A256_CBCPAD'), 'A256Cbcpad');
      strictEqual(naming.fixUpEnumValueNameWorker('CKM_AES256_WRAP'), 'CkmAes256Wrap');
      strictEqual(naming.fixUpEnumValueNameWorker('ABCD'), 'Abcd');
      strictEqual(naming.fixUpEnumValueNameWorker('abcd'), 'Abcd');
      strictEqual(naming.fixUpEnumValueNameWorker('A'), 'A');
      strictEqual(naming.fixUpEnumValueNameWorker('123ABC'), 'INVLD_IDENTIFIER_123Abc');
      strictEqual(naming.fixUpEnumValueNameWorker('a1b2c3'), 'A1B2C3');
    });

    it('sortClientParameters', () => {
      const endpointParam = new rust.ClientEndpointParameter('endpoint');
      const credentialParam = new rust.ClientCredentialParameter('credential', new rust.StringType());
      const someOtherParam = new rust.ClientSupplementalEndpointParameter('something', new rust.StringType(), true, 'segment');

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
