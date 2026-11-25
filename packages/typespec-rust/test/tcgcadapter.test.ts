/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell:disable

import * as rust from '../src/codemodel/index.js';
import * as helpers from '../src/tcgcadapter/helpers.js';
import { Adapter, formatVisibility } from '../src/tcgcadapter/adapter.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import { RustEmitterOptions } from '../src/lib.js';
import { compile, NodeHost } from '@typespec/compiler';
import { createPerfReporter } from '@typespec/compiler/utils';
import * as naming from '../src/tcgcadapter/naming.js';
import { Visibility } from '@typespec/http';
import { deepEqual, strictEqual } from 'assert';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

describe('operation status response sources', () => {
  let crate: rust.Crate;
  let createAdapter: () => Promise<Adapter>;
  beforeAll(async () => {
    const program = await compile(NodeHost, resolve('test/tsp/lro-status/main.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const options: RustEmitterOptions = {
      'crate-name': 'lro_status',
      'omit-constructors': false,
      'overwrite-cargo-toml': false,
      'overwrite-lib-rs': false,
      'temp-omit-doc-links': false,
      'emit-error-traits': false,
    };
    createAdapter = () => Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    const adapter = await createAdapter();
    crate = adapter.tcgcToCrate();
  });

  it('does not interpret an unrelated resource status as operation status', () => {
    const method = crate.clients.flatMap(client => client.methods).find(method => method.name === 'begin_status_flow');
    expect(method?.kind).toBe('lro');
    if (method?.kind !== 'lro') {
      throw new Error('expected LRO');
    }
    expect(method.initialMonitorStatusCodes).toEqual([]);
  });

  it('recognizes the actual monitor when returned by the initial operation', () => {
    const method = crate.clients.flatMap(client => client.methods).find(method => method.name === 'begin_monitor');
    expect(method?.kind).toBe('lro');
    if (method?.kind !== 'lro') {
      throw new Error('expected LRO');
    }
    expect(method.initialMonitorStatusCodes).toEqual([200]);
    const content = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('clients/lro_status_test_snapshots_client.rs'))!.content;
    expect(content).not.toContain('struct OperationStatus');
    expect(content).toContain('let res: LroStatusTestSnapshotsClientBeginMonitorOperationStatus = body.json()?');
    expect(content).toContain('res.status()');
    expect(content).not.toContain('status_from_response');
    expect(content).toContain('PollerStatus::Failed | PollerStatus::Canceled');
    expect(content).toContain('_ => PollerResult::InProgress');
    expect(content).not.toContain('serde_json');
    expect(content).not.toContain('std::borrow::Cow');
    expect(content).not.toContain('#[serde(rename = "status")]');
  });

  it('selects only the modeled initial monitor and avoids shadowing operation inputs', () => {
    const method = crate.clients.flatMap(client => client.methods).find(method => method.name === 'begin_mixed');
    if (method?.kind !== 'lro') {
      throw new Error('expected LRO');
    }
    expect(method.initialMonitorStatusCodes).toEqual([202]);
    const content = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('clients/lro_status_test_snapshots_client.rs'))!.content;
    expect(content).toContain('let is_initial_response = matches!');
    expect(content).toContain('if !is_initial_response ||');
    expect(content).toContain('StatusCode::from(202)');
  });

  it('preserves TCGC status ranges and rejects overlapping incompatible response roles', async () => {
    const adapter = await createAdapter();
    const clients = [...adapter['ctx'].sdkPackage.clients];
    for (const client of clients) {
      clients.push(...client.children ?? []);
    }
    const methods = clients.flatMap(client => client.methods);
    const monitor = methods.find(method => method.name === 'monitor');
    const resource = methods.find(method => method.name === 'statusFlow');
    if (monitor?.kind !== 'lro' || resource?.kind !== 'lro') {
      throw new Error('expected LRO metadata');
    }
    const ranged = {
      ...monitor,
      operation: { ...monitor.operation, responses: [{ ...monitor.operation.responses[0], statusCodes: { start: 202, end: 203 } }] },
    };
    expect(adapter['adaptInitialMonitorStatusCodes'](ranged)).toEqual([202, 203]);
    ranged.operation.responses.push({ ...resource.operation.responses[0], statusCodes: { start: 201, end: 202 } });
    expect(() => adapter['adaptInitialMonitorStatusCodes'](ranged)).toThrow('ambiguous initial response roles for HTTP 202');
  });
});

describe('fixed non-body inputs', () => {
  let crate: rust.Crate;
  let files: Array<{ name: string; content: string }>;
  beforeAll(async () => {
    const program = await compile(NodeHost, resolve('test/tsp/MiscTests/main.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const options: RustEmitterOptions = {
      'crate-name': 'misc_tests',
      'omit-constructors': false,
      'overwrite-cargo-toml': false,
      'overwrite-lib-rs': false,
      'temp-omit-doc-links': false,
      'emit-error-traits': false,
    };
    const adapter = await Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    crate = adapter.tcgcToCrate();
    files = new CodeGenerator(crate).emitContent();
  }, 30000);

  function content(suffix: string): string {
    const file = files.find(file => file.name.endsWith(suffix));
    expect(file).toBeDefined();
    return file!.content;
  }

  it('omits fixed group fields while retaining dynamic fields and wire constants', () => {
    const options = content('models/method_options.rs');
    const group = options.match(/pub struct FixedInputs<'a> \{([^}]+)\}/)![1];
    expect(group.match(/pub \w+:/g)).toEqual(['pub name:', 'pub color:']);
    expect(group).toContain("name: &'a str");
    expect(group).toContain('color: Colors');
    const method = crate.clients.flatMap(c => c.methods).find(m => m.name === 'fixed_inputs')!;
    const fixed = method.params.filter(p => ['fixed', 'fixed_header', 'segment'].includes(p.name));
    expect(fixed).toHaveLength(3);
    expect(fixed.every(p => !('group' in p) || !p.group)).toBe(true);
    const client = content('clients/misc_tests_client.rs');
    expect(client).toContain("inputs: FixedInputs<'_>");
    expect(client).toContain('query_builder.set_pair("fixed", "fixed")');
    expect(client).toContain('request.insert_header("x-fixed", Colors::Blue.to_string())');
    expect(client).toContain('path.replace("{segment}", "constant")');
  });

  it('eliminates fixed-only groups and does not expose ungrouped or client constants', () => {
    expect(files.some(f => f.content.includes('struct OnlyFixedInputs'))).toBe(false);
    const client = content('clients/misc_tests_client.rs');
    for (const name of ['only_fixed_inputs', 'ungrouped_fixed_inputs']) {
      const signature = client.match(new RegExp(`pub async fn ${name}\\(([^]*?)\\) ->`))![1];
      expect(signature.replace(/\s+/g, ' ')).toMatch(/^&self, options: Option<\w+<'_>>$/);
    }
    expect(client).not.toContain('client_fixed:');
    expect(client).not.toContain('self.client_fixed');
    expect(client).toContain('query_builder.set_pair("clientFixed", "client")');
  });

  it('preserves optional fixed enum presence checks and literal serialization', () => {
    const options = content('models/method_options.rs');
    expect(options).toContain('pub optional_fixed: Option<String>');
    expect(options).toContain('pub optional_color: Option<Colors>');
    expect(options).toContain('pub optional_header: Option<Colors>');
    const client = content('clients/misc_tests_client.rs');
    expect(client).not.toContain('options.optional_fixed.is_some()');
    expect(client).toMatch(/if options.optional_color.is_some\(\) \{\s*query_builder.set_pair\("optionalColor", Colors::Blue.to_string\(\)\);/);
    expect(client).toMatch(/if options.optional_header.is_some\(\) \{\s*request.insert_header\("x-optional-fixed", Colors::Green.to_string\(\)\);/);
    expect(client).not.toContain('let Some(optional_fixed)');
    expect(client).not.toContain('let Some(optional_header)');
    expect(client).toContain('query_builder.set_pair("optionalFixed", "optional")');
    expect(client).toContain('request.insert_header("x-optional-fixed", Colors::Green.to_string())');
  });

  it('preserves optional-only group models referenced by body and response models', () => {
    const models = content('models/models.rs');
    const options = content('models/method_options.rs');
    const client = content('clients/misc_tests_client.rs');
    for (const name of ['OptionalBodyInputs', 'OptionalResponseInputs']) {
      expect(models).toContain(`pub struct ${name} {`);
      expect(models).toContain(`pub inputs: Option<${name}>`);
      expect(options).not.toContain(`pub struct ${name}`);
    }
    for (const name of ['optional_body_inputs', 'optional_response_inputs']) {
      const signature = client.match(new RegExp(`pub async fn ${name}\\(([^]*?)\\) ->`))![1];
      expect(signature.replace(/\s+/g, ' ')).toMatch(/^&self, options: Option<\w+<'_>>$/);
    }
    expect(client).toContain('body: RequestContent<SharedOptionalBody>');
    expect(client).toContain('Response<SharedOptionalResponse>');
  });

  it('preserves body-model and spread-body literal fields', () => {
    const model = content('models/models.rs').match(/pub struct FixedBody \{([^]*?)\n\}/)![1];
    expect(model).toContain('pub fixed: Option<String>');
    expect(model).toContain('pub fixed_enum: Option<Colors>');
    expect(model).toContain('pub optional_fixed: Option<String>');
    expect(model).toContain('serialize_with');
    const client = content('clients/misc_tests_client.rs');
    expect(client).toContain('body: RequestContent<FixedBody>');
    expect(client).toMatch(/pub async fn fixed_spread_body\([^]*?fixed: String,[^]*?fixed_enum: Colors,/);
  });
});

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

    it('formatVisibility', () => {
      // undefined or empty visibility means unrestricted
      strictEqual(formatVisibility(undefined), undefined);
      strictEqual(formatVisibility([]), undefined);

      // all lifecycle flags means unrestricted
      strictEqual(formatVisibility([Visibility.All]), undefined);
      strictEqual(formatVisibility([Visibility.Read, Visibility.Create, Visibility.Update, Visibility.Delete, Visibility.Query]), undefined);

      // single visibility
      strictEqual(formatVisibility([Visibility.Read]), 'Read');
      strictEqual(formatVisibility([Visibility.Create]), 'Create');
      strictEqual(formatVisibility([Visibility.Update]), 'Update');
      strictEqual(formatVisibility([Visibility.Delete]), 'Delete');
      strictEqual(formatVisibility([Visibility.Query]), 'Query');

      // multiple visibilities are sorted alphabetically
      strictEqual(formatVisibility([Visibility.Create, Visibility.Update]), 'Create, Update');
      strictEqual(formatVisibility([Visibility.Read, Visibility.Create]), 'Create, Read');
      strictEqual(formatVisibility([Visibility.Create, Visibility.Update, Visibility.Delete]), 'Create, Delete, Update');
    });
  });
});
