// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// cspell:ignore tcgcadapter

import { compile, createSourceFile, NodeHost } from '@typespec/compiler';
import { createPerfReporter } from '@typespec/compiler/utils';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Adapter } from '../src/tcgcadapter/adapter.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import * as rust from '../src/codemodel/index.js';
import { RustEmitterOptions } from '../src/lib.js';

async function compileFixture(version?: string, transform?: (source: string) => string): Promise<rust.Crate> {
  const main = resolve('test/tsp/ResourceManager/main.tsp');
  const program = await compile({
    ...NodeHost,
    async readFile(path) {
      const file = await NodeHost.readFile(path);
      return transform && path === main ? createSourceFile(transform(file.text), path) : file;
    },
  }, main, { noEmit: true });
  expect(program.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  const options: RustEmitterOptions = {
    'crate-name': 'azure_resourcemanager_test',
    'omit-constructors': false,
    'overwrite-cargo-toml': false,
    'overwrite-lib-rs': false,
    'temp-omit-doc-links': false,
    'emit-error-traits': false,
  };
  const commonOptions = { ...options, 'api-version': version };
  const adapter = await Adapter.create({ program, options: commonOptions, emitterOutputDir: '', perf: createPerfReporter() });
  return adapter.tcgcToCrate();
}

describe('Resource Manager generation', () => {
  let crate: rust.Crate;
  let files: Array<{ name: string; content: string }>;
  beforeAll(async () => {
    crate = await compileFixture('2026-05-15');
    files = new CodeGenerator(crate).emitContent();
  }, 30000);

  function content(suffix: string): string {
    const file = files.find(file => file.name.endsWith(suffix));
    expect(file).toBeDefined();
    return file!.content;
  }

  function method(name: string): rust.LroMethod {
    const method = crate.clients.flatMap(client => client.methods).find(method => method.name === name);
    expect(method?.kind).toBe('lro');
    return method as rust.LroMethod;
  }

  it('distinguishes omitted and explicit final-state selectors on empty outputs', () => {
    expect(method('begin_empty_result').resourceManagerFinalState).toBeUndefined();
    expect(method('begin_explicit_empty_result').resourceManagerFinalState).toEqual({ selector: 'AzureAsyncOperation', resultPath: [] });
    expect(method('begin_empty_result').returns.type.resultType).toBeUndefined();
    expect(method('begin_explicit_empty_result').returns.type.resultType).toBeUndefined();
  });

  it('adapts all helper selectors and serialized inline-result paths', () => {
    expect(method('begin_inline_result').resourceManagerFinalState).toEqual({ selector: 'OperationLocation', resultPath: ['result'] });
    expect(method('begin_original_result').resourceManagerFinalState?.selector).toBe('OriginalUrl');
    expect(method('begin_async_result').resourceManagerFinalState?.selector).toBe('AzureAsyncOperation');
    const vaults = crate.clients.find(client => client.name === 'ResourceManagerVaultsClient')!;
    expect((vaults.methods.find(method => method.name === 'begin_create_or_update') as rust.LroMethod).resourceManagerFinalState).toBeUndefined();
    expect((vaults.methods.find(method => method.name === 'begin_purge') as rust.LroMethod).resourceManagerFinalState).toEqual({ selector: 'Location', resultPath: [] });
  });

  it('adapts selectors inherited through public decorator metadata', async () => {
    const inherited = await compileFixture('2026-05-15', source => source.replace(
      'op originalResult is LongRunningRpcOperation<{}, InlineMonitor, InlineResult>;',
      'op OriginalResultTemplate<Parameters extends {}> is LongRunningRpcOperation<Parameters, InlineMonitor, InlineResult>;\n'
      + 'op originalResult is OriginalResultTemplate<{}>;',
    ));
    const original = inherited.clients.flatMap(client => client.methods).find(method => method.name === 'begin_original_result') as rust.LroMethod;
    expect(original.resourceManagerFinalState).toEqual({ selector: 'OriginalUrl', resultPath: [] });
  }, 30000);

  it('borrows the default cloud and delegates endpoint and scope resolution', () => {
    const client = content('clients/resource_manager_client.rs');
    expect(client).toContain('CloudConfigurationExt as _');
    expect(client).toContain('options.client_options.cloud.as_deref().unwrap_or_default()');
    expect(client).toContain('cloud.endpoint()');
    expect(client).toContain('Url::parse(endpoint)?');
    expect(client).toContain('cloud.default_scope()?.into_owned()');
    expect(client).not.toContain('CloudConfiguration::');
    expect(client).not.toContain('audiences.get');
    expect(client).toContain('[`Audience`](azure_core::cloud::resource_manager::Audience)');
    expect(content('generated/mod.rs')).not.toContain('struct Audience');
  });

  it('delegates polling without inline state machines or synthesized status bodies', () => {
    const clients = files.filter(file => file.name.includes('/clients/') && !file.name.includes('/fake/')).map(file => file.content).join('\n');
    expect(clients).toContain('Ok(new_poller(');
    expect(clients).not.toContain('PollerState');
    expect(clients).not.toContain('get_retry_after');
    expect(clients).not.toContain('PollerResult');
    expect(content('models/method_options.rs')).toContain('poller::resource_manager::PollerOptions');
    expect(files.some(file => file.content.includes('type Format = NoFormat;'))).toBe(true);
    expect(content('clients/resource_manager_client.rs')).toContain('.try_into()?');
  });

  it('extracts inline results from the original response bytes', () => {
    const client = content('clients/resource_manager_client.rs');
    expect(client).toContain("&'a serde_json::value::RawValue");
    expect(client).toContain('bytes.slice_ref(envelope.value.get().as_bytes())');
    expect(client).toContain('RawResponse::from_bytes(status, headers, result)');
    expect(client).not.toContain('serde_json::from_str');
    expect(new CodeGenerator(crate).emitCargoToml()).toContain('features = ["raw_value"]');
  });

  it('uses serialized names for nested inline extraction', () => {
    const inline = method('begin_inline_result');
    const original = inline.resourceManagerFinalState;
    try {
      inline.resourceManagerFinalState = { selector: 'OperationLocation', resultPath: ['payload', '@result'] };
      const generated = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('clients/resource_manager_client.rs'))!.content;
      expect(generated).toContain('rename = "payload"');
      expect(generated).toContain('rename = "@result"');
      expect(generated).toContain('bytes.slice_ref(envelope.value.value.get().as_bytes())');
    } finally {
      inline.resourceManagerFinalState = original;
    }
  });

  it('adapts serialized inline result names through TypeSpec metadata', async () => {
    const serialized = await compileFixture('2026-05-15', source => source
      .replace(
        'op inlineResult is LongRunningRpcOperation<{}, InlineMonitor, InlineResult>;',
        '@post\nop inlineResult(): AcceptedResponse & {\n'
        + '  @header("operation-location")\n'
        + '  @pollingLocation(StatusMonitorPollingOptions<InlineMonitor>)\n'
        + '  monitor: string;\n};',
      )
      + '\n@@encodedName(InlineMonitor.result, "application/json", "@result");\n');
    const inline = serialized.clients.flatMap(client => client.methods).find(method => method.name === 'begin_inline_result') as rust.LroMethod;
    expect(inline.resourceManagerFinalState).toEqual({ selector: 'OperationLocation', resultPath: ['@result'] });
    const generated = new CodeGenerator(serialized).emitContent().find(file => file.name.endsWith('clients/resource_manager_client.rs'))!.content;
    expect(generated).toContain('rename = "@result"');
  }, 30000);

  it('preserves the whole response for an empty extraction path', () => {
    const inline = method('begin_inline_result');
    const original = inline.resourceManagerFinalState;
    try {
      inline.resourceManagerFinalState = { selector: 'OperationLocation', resultPath: [] };
      const generated = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('clients/resource_manager_client.rs'))!.content;
      expect(generated).toContain('Ok(response.to_raw_response().into())');
      expect(generated).not.toContain('ResultEnvelope');
    } finally {
      inline.resourceManagerFinalState = original;
    }
  });

  it('rejects custom polling headers that the ARM helper cannot follow', async () => {
    await expect(compileFixture('2026-05-15', source => source
      .replace('@header("azure-asyncoperation")', '@header("custom-status")')
      .replace('@useFinalStateVia("azure-async-operation")\nop explicitEmptyResult', 'op explicitEmptyResult')
    )).rejects.toThrow('unsupported Resource Manager final-state selector');
  }, 30000);

  it('merges ARM dependency features without enabling default transport implicitly', () => {
    crate.addDependency(new rust.CrateDependency('azure_core', ['xml']));
    const manifest = new CodeGenerator(crate).emitCargoToml();
    expect(manifest).toContain('exclude.workspace = true');
    expect(manifest).toContain('default = ["azure_core/default"]');
    expect(manifest).toContain('azure_core = { workspace = true, default-features = false, features = ["unstable_resource_manager", "xml"] }');
    expect(manifest).not.toContain('path =');
  });

  it('uses the common api-version option for generated defaults', async () => {
    expect(content('clients/resource_manager_client.rs')).toContain('"2026-05-15"');
    const newer = new CodeGenerator(await compileFixture('2026-06-01')).emitContent();
    expect(newer.find(file => file.name.endsWith('clients/resource_manager_client.rs'))?.content).toContain('"2026-06-01"');
    const latest = new CodeGenerator(await compileFixture()).emitContent();
    expect(latest.find(file => file.name.endsWith('clients/resource_manager_client.rs'))?.content).toContain('"2026-06-01"');
  }, 30000);
});
