// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// cspell:ignore tcgcadapter

import { compile, NodeHost } from '@typespec/compiler';
import { createPerfReporter } from '@typespec/compiler/utils';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Adapter } from '../src/tcgcadapter/adapter.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import { RustEmitterOptions } from '../src/lib.js';

describe('fake generation', () => {
  let files: Array<{ name: string; content: string }>;
  let generator: CodeGenerator;
  beforeAll(async () => {
    const program = await compile(NodeHost, resolve('test/tsp/Fakes/main.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const options: RustEmitterOptions = {
      'crate-name': 'fake_tests',
      'generate-fakes': true,
      'omit-constructors': false,
      'overwrite-cargo-toml': false,
      'overwrite-lib-rs': false,
      'temp-omit-doc-links': false,
      'emit-error-traits': false,
    };
    const adapter = await Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    generator = new CodeGenerator(adapter.tcgcToCrate());
    files = generator.emitContent();
  }, 30000);

  function content(name: string): string {
    const file = files.find(f => f.name.endsWith(name));
    expect(file).toBeDefined();
    return file!.content;
  }

  it.each([undefined, false])('omits all fake output when generate-fakes is %s', async generateFakes => {
    const program = await compile(NodeHost, resolve('test/tsp/Fakes/main.tsp'), { noEmit: true });
    expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
    const options: RustEmitterOptions = {
      'crate-name': 'fake_tests',
      'omit-constructors': false,
      'overwrite-cargo-toml': false,
      'overwrite-lib-rs': false,
      'temp-omit-doc-links': false,
      'emit-error-traits': false,
      ...(generateFakes === undefined ? {} : { 'generate-fakes': generateFakes }),
    };
    const adapter = await Adapter.create({ program, options, emitterOutputDir: '', perf: createPerfReporter() });
    const disabled = new CodeGenerator(adapter.tcgcToCrate());
    const output = disabled.emitContent();
    expect(output.some(file => file.name.includes('/fake/'))).toBe(false);
    const clients = output.filter(file => file.name.includes('/clients/')).map(file => file.content).join('\n');
    expect(clients).not.toContain('pub mod fake;');
    expect(clients).not.toContain('capture_fakes_');
    expect(clients).not.toContain('unstable_fake');
    expect(disabled.emitCargoToml()).not.toContain('azure_core/test');
    expect(disabled.emitCargoToml()).not.toContain('unstable_fake');
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
    expect(fake).toContain('_content: Body');
    expect(fake).toContain('_state: PollerState');
    expect(fake).toContain('_request: &Request');
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
