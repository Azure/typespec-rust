// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// cspell:ignore tcgcadapter

import { compile, NodeHost, Program } from '@typespec/compiler';
import { createPerfReporter } from '@typespec/compiler/utils';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Adapter } from '../src/tcgcadapter/adapter.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import { RustEmitterOptions } from '../src/lib.js';
import * as rust from '../src/codemodel/index.js';
import { snakeCaseName } from '../src/utils/utils.js';

type Param = { name: string; type: string };
type ModelMap = Record<string, Array<Param>>;

function splitParams(text: string): Array<string> {
  const result: Array<string> = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if ('<([{'.includes(text[i])) depth++;
    if ('>)]}'.includes(text[i])) depth--;
    if (text[i] === ',' && depth === 0) {
      result.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return result.concat(text.slice(start).trim()).filter(Boolean);
}

function parameters(text: string): Array<Param> {
  return splitParams(text).map(value => {
    if (value === '&self') return { name: 'self', type: '&Self' };
    const colon = value.indexOf(':');
    return { name: value.slice(0, colon).trim(), type: value.slice(colon + 1).replace(/'[a-z]\w*/g, "'_").replace(/\s+/g, '') };
  });
}

function signature(text: string, method: string): { params: Array<Param>; returns: string } {
  const match = text.match(new RegExp(`(?:pub )?(?:async )?fn ${method}(?:<[^>]+>)?\\(([^]*?)\\)\\s*->\\s*([^]*?)\\{`));
  expect(match, method).not.toBeNull();
  return { params: parameters(match![1]), returns: match![2].replace(/\s+/g, '') };
}

function compareParameters(normal: Array<Param>, fake: Array<Param>, equivalents: Record<string, string> = {}, models: ModelMap = {}): void {
  for (const [from, to] of Object.entries(equivalents)) {
    expect(models[from], `missing model ${from}`).toBeDefined();
    expect(models[to], `missing model ${to}`).toBeDefined();
    expect(models[to]).toEqual(models[from]);
  }
  const normalize = (type: string): string => type.replace(/\b[A-Za-z_]\w*\b/g, name =>
    Object.entries(equivalents).find(([, to]) => to === name)?.[0] ?? name);
  expect(fake.map(p => ({ ...p, type: normalize(p.type) }))).toEqual(normal);
}

describe('fake generation', () => {
  const options: RustEmitterOptions = {
    'crate-name': 'fake_tests',
    'generate-fakes': true,
    'omit-constructors': false,
    'overwrite-cargo-toml': false,
    'overwrite-lib-rs': false,
    'temp-omit-doc-links': false,
    'emit-error-traits': false,
  };
  let program: Program;
  let files: Array<{ name: string; content: string }>;
  let generator: CodeGenerator;
  let crate: rust.Crate;
  beforeAll(async () => {
    program = await compile(NodeHost, resolve('test/tsp/Fakes/main.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const adapter = await Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    crate = adapter.tcgcToCrate();
    expect(crate.clients.map(client => client.name).sort()).toEqual([
      'EndpointClient', 'EndpointEndpointChildClient', 'FakesApiKeyChildClient',
      'FakesApiKeyClient', 'FakesChildClient', 'FakesClient',
    ]);
    generator = new CodeGenerator(crate);
    files = generator.emitContent();
  }, 30000);

  function content(name: string): string {
    const file = files.find(f => f.name.endsWith(name));
    expect(file).toBeDefined();
    return file!.content;
  }

  function compareGenerated(module: rust.ModuleContainer, output: Array<{ name: string; content: string }>): number {
    let count = 0;
    for (const client of module.clients) {
      const filename = `${snakeCaseName(client.name)}.rs`;
      const normal = output.find(f => f.name.endsWith(`/clients/${filename}`))!.content;
      const fake = output.find(f => f.name.endsWith(`/fake/${filename}`))!.content;
      for (const method of client.methods) {
        if (method.kind === 'clientaccessor' || method.visibility !== 'pub') continue;
        const ordinary = signature(normal, method.name);
        const server = signature(fake, method.name);
        expect(server.returns).toBe('Result<AsyncRawResponse>');
        const additions = server.params.filter(p => p.type === 'PagerState' || p.type === 'PollerState' || p.type === '&Request');
        expect(additions.map(p => p.type)).toEqual(method.kind === 'pageable' ? ['PagerState'] : method.kind === 'lro' ? ['PollerState', '&Request'] : []);
        let expected = ordinary.params;
        let actual = server.params.filter(p => !additions.includes(p));
        const spread = method.params.filter(p => p.kind === 'partialBody');
        if (spread.length) {
          expect(actual.filter(p => p.type === 'Body')).toHaveLength(1);
          expected = expected.filter(p => !spread.some(s => s.name === p.name));
          actual = actual.filter(p => p.type !== 'Body');
        }
        // These generators deliberately reuse the exact same public option/group
        // models, so no type substitution or field-shape normalization is needed.
        compareParameters(expected, actual);
        count++;
      }
    }
    for (const sub of module.subModules) count += compareGenerated(sub, output);
    return count;
  }

  it('matches emitted data-plane parameter names, order, borrowing, groups, and options', () => {
    expect(compareGenerated(crate, files)).toBeGreaterThan(10);
    const models = content('models/method_options.rs');
    expect(models).toContain('payload: Option<RequestContent<Bytes, NoFormat>>');
    const fake = content('fake/fakes_client.rs');
    expect(fake).toContain('inputs: GroupedInputs');
    expect(fake).not.toContain('content_0');
    expect(fake).toContain('body_present: bool');
    expect(fake).toContain('payload: if arguments.body_present');
    expect(signature(fake, 'list_optional').params.map(p => p.name)).toEqual(['self', 'state', 'options']);
  });

  it('reconstructs the same mixed and fixed-only groups exposed by normal clients', () => {
    const models = content('models/method_options.rs');
    const group = models.match(/pub struct GroupedInputs<'a> \{([^]*?)\n\}/)![1];
    expect(group).not.toContain('fixed');
    expect(files.some(file => file.content.includes('struct FixedInputs'))).toBe(false);
    const fake = content('fake/fakes_client.rs');
    expect(signature(fake, 'grouped').params.map(p => p.name)).toEqual(['self', 'inputs', 'options']);
    expect(signature(fake, 'fixed_group').params.map(p => p.name)).toEqual(['self', 'options']);
    expect(fake).toContain('GroupedInputs { name: (arguments.name).as_str(), label: (arguments.label).clone() }');
    expect(fake).not.toContain('arguments.fixed');
    for (const fragment of ['query_builder.set_pair("fixed", "fixed")', 'request.insert_header("x-fixed", Mode::First.to_string())']) {
      expect(content('clients/fakes_client.rs')).toContain(fragment);
    }
  });

  it('matches emitted ARM methods including client-scoped inputs and optional bodies', async () => {
    const program = await compile(NodeHost, resolve('test/tsp/ResourceManager/main.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const options: RustEmitterOptions = {
      'crate-name': 'azure_resourcemanager_test',
      'generate-fakes': true,
      'omit-constructors': false, 'overwrite-cargo-toml': false, 'overwrite-lib-rs': false,
      'temp-omit-doc-links': false, 'emit-error-traits': false,
    };
    const adapter = await Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    const arm = adapter.tcgcToCrate();
    const generated = new CodeGenerator(arm).emitContent();
    expect(compareGenerated(arm, generated)).toBeGreaterThan(15);
    for (const client of arm.clients.filter(c => c.constructable)) {
      for (const constructor of client.constructable!.constructors) {
        expect(constructor.params.filter(p => p.kind !== 'clientCredential')).toEqual(client.constructable!.parameters);
      }
    }
  }, 30000);

  it('allows only equivalent model shapes and rejects signature drift', () => {
    const normal = parameters('&self, name: &str, options: Option<Options>');
    const fake = parameters('&self, name: &str, options: Option<FakeOptions>');
    const fields = parameters('body: Option<RequestContent<Payload>>, count: Option<i32>');
    compareParameters(normal, fake, { Options: 'FakeOptions' }, { Options: fields, FakeOptions: fields });
    for (const wrong of [
      '&self, renamed: &str, options: Option<Options>',
      '&self, options: Option<Options>, name: &str',
      '&self, name: String, options: Option<Options>',
      '&self, name: &str, options: Options',
    ]) expect(() => compareParameters(normal, parameters(wrong))).toThrow();
    for (const wrong of ['count: Option<i32>', 'body: RequestContent<Payload>, count: Option<i32>', 'body: Option<RequestContent<Other>>, count: Option<i32>']) {
      expect(() => compareParameters(normal, fake, { Options: 'FakeOptions' }, { Options: fields, FakeOptions: parameters(wrong) })).toThrow();
    }
  });

  it('registers fake dependencies before sorting the generated manifest', () => {
    const dependencies = generator.emitCargoToml().split('[dependencies]\n')[1].trim().split('\n').map(line => line.split(' = ')[0]);
    expect(dependencies).toContain('async-trait');
    expect(dependencies).toEqual([...dependencies].sort());
  });

  it('shares constructor inputs and fixed or templated supplemental endpoint joins', async () => {
    const supported = crate.clients.filter(client => ['EndpointClient', 'EndpointEndpointChildClient'].includes(client.name));
    expect(supported).toHaveLength(2);
    for (const client of supported) {
      const filename = `${snakeCaseName(client.name)}.rs`;
      const normal = content(`clients/${filename}`);
      const fake = content(`fake/${filename}`);
      compareParameters(signature(normal, 'with_no_credential').params, signature(fake, 'with_fake').params.filter(p => !p.type.startsWith('Arc<')));
      expect(signature(fake, 'with_fake').params.filter(p => p.name.startsWith('server')).map(p => p.name)).toEqual(['server_0', 'server']);
      expect(fake).toContain('server: server_0');
      for (const fragment of ['host.replace("{tenant}", &tenant)', 'host.replace("{server}", &server)', 'host.replace("{version}", &options.version)', 'endpoint.join(&host)?']) {
        expect(normal).toContain(fragment);
        expect(fake).toContain(fragment);
      }
    }
    // Keep the synthetic fixed-suffix case out of the shared generated fixture.
    const adapter = await Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    const endpoints = adapter.tcgcToCrate();
    for (const client of endpoints.clients.filter(client => supported.some(endpoint => endpoint.name === client.name))) {
      client.constructable!.endpoint = { path: 'fixed/suffix', parameters: [] };
    }
    const fixed = new CodeGenerator(endpoints).emitContent();
    expect(fixed.filter(f => f.name.includes('/clients/') && f.content.includes('endpoint.join("fixed/suffix")?'))).toHaveLength(supported.length * 2);
  }, 30000);

  it('emits credential-free constructors with modeled inputs when API-key authentication has no real constructor', () => {
    const keyed = crate.clients.filter(client => ['FakesApiKeyClient', 'FakesApiKeyChildClient'].includes(client.name));
    expect(keyed).toHaveLength(2);
    expect(keyed.every(client => client.constructable!.constructors.length === 0)).toBe(true);
    for (const client of keyed) {
      const fake = content(`fake/${snakeCaseName(client.name)}.rs`);
      const params = signature(fake, 'with_fake').params;
      expect(params.map(p => p.name)).toEqual([
        'endpoint', 'server_0', 'tenant', 'server', 'resource', 'options',
      ]);
      expect(fake).not.toContain('credential:');
      expect(fake).toContain('host.replace("{server}", &server)');
      expect(fake).toContain('server: server_0');
    }
  });

  it.each([undefined, false])('omits all fake output when generate-fakes is %s', async generateFakes => {
    const baseOptions = { ...options };
    delete baseOptions['generate-fakes'];
    const adapter = await Adapter.create({
      program,
      options: { ...baseOptions, ...(generateFakes === undefined ? {} : { 'generate-fakes': generateFakes }) },
      emitterOutputDir: '', perf: createPerfReporter(),
    });
    const disabled = new CodeGenerator(adapter.tcgcToCrate());
    const output = disabled.emitContent();
    expect(output.some(file => file.name.includes('/fake/'))).toBe(false);
    const clients = output.filter(file => file.name.includes('/clients/')).map(file => file.content).join('\n');
    expect(clients).not.toContain('pub mod fake;');
    expect(clients).not.toContain('capture_fakes_');
    expect(clients).not.toContain('unstable_fake');
    expect(disabled.emitCargoToml()).not.toContain('azure_core/test');
    expect(disabled.emitCargoToml()).not.toContain('unstable_fake');
    expect(disabled.emitCargoToml()).toContain('async-trait');
  }, 30000);

  it('omits fake-only dependencies when no pageable operation requires them', async () => {
    const program = await compile(NodeHost, resolve('test/tsp/Fakes/endpoints.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const adapter = await Adapter.create({
      program, options: { ...options, 'generate-fakes': false },
      emitterOutputDir: '', perf: createPerfReporter(),
    });
    const disabled = new CodeGenerator(adapter.tcgcToCrate());
    disabled.emitContent();
    expect(disabled.emitCargoToml()).not.toContain('async-trait');
  }, 30000);

  it('composes child servers and routes their original API identifiers', () => {
    const fake = content('fake/fakes_client.rs');
    expect(fake).toContain('crate::clients::fake::FakesChildServer');
    expect(fake).toContain('"Fakes.Child.get"');
    expect(fake).toContain('fakes_child_client::dispatch_get');
    expect(fake).toContain('impl FakesClient');
    expect(fake).toContain("Arc<impl FakesServer + ?Sized + 'static>");
    expect(fake).not.toContain('pub struct FakesClient');
  });

  it('captures owned typed arguments before constructing pagers', () => {
    const client = content('clients/fakes_client.rs');
    expect(client.indexOf('capture_fakes_client_list')).toBeLessThan(client.indexOf('Ok(Pager::new'));
    expect(client).toContain('#[cfg(all(feature = "test", feature = "unstable_fake"))]');
    const fake = content('fake/fakes_client.rs');
    expect(fake).toContain('struct FakesClientGetArguments');
    expect(fake).toContain('tags: Option<Vec<String>>');
    expect(fake).toContain('mode: Option<Mode>');
    expect(fake).not.toContain('derive(Debug');
    expect(fake).not.toContain('pub struct FakesClientGetArguments');
    expect(fake).not.toContain('percent_decode');
  });

  it('forwards opaque bodies and exposes request-aware LRO callbacks', () => {
    const fake = content('fake/fakes_client.rs');
    expect(fake).toContain('RequestContent<Bytes, NoFormat>');
    expect(fake).toContain('request.body().clone().into()');
    expect(fake).toContain('content: Body');
    expect(fake).toContain('state: PollerState');
    expect(fake).toContain('request: &Request');
    expect(fake).toContain('frequency: arguments.frequency');
    expect(fake).not.toContain('DeserializeOwned');
    expect(fake).not.toContain('json::from_json');
    expect(fake).not.toContain('.reset(');
  });

  it('uses core metadata and feature forwarding without parsing HTTP routes', () => {
    const fake = content('fake/fakes_client.rs');
    expect(fake).toContain('azure_core::http::fake::get_api_name(context)');
    expect(fake).toContain('missing operation arguments');
    expect(fake).toContain('missing operation state');
    expect(fake).toContain('unknown API name');
    expect(fake).not.toContain('request.url()');
    expect(fake).not.toContain('request.method()');
    expect(fake).not.toContain('context.insert(PagerState');
    expect(generator.emitCargoToml()).toContain('unstable_fake = ["test", "azure_core/unstable_fake"]');
  });

  it('disambiguates capture helper parameters from original operation arguments', () => {
    const fake = content('fake/fakes_client.rs');
    expect(fake).toContain("context_0: &mut azure_core::http::Context<'_>");
    expect(fake).toContain('context_0.insert(FakesClientCollisionsArguments');
  });
});
