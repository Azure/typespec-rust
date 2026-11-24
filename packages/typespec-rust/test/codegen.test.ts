/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore ifblock

import * as rust from '../src/codemodel/index.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import * as helpers from '../src/codegen/helpers.js';
import { strictEqual, throws } from 'assert';
import { describe, it } from 'vitest';

function createClient(crate: rust.Crate, name: string): rust.Client {
  const client = new rust.Client(name, crate);
  client.languageIndependentName = name;
  client.endpoint = new rust.StructField('endpoint', 'pubCrate', new rust.Url(crate));
  client.fields.push(client.endpoint);
  client.fields.push(new rust.StructField('pipeline', 'pubCrate', new rust.ExternalType(crate, 'Pipeline', 'azure_core::http')));
  crate.clients.push(client);
  return client;
}

// Kept generic instead of enumerating a poller-specific union member. Add that
// explicit branch here if poller helper generation needs it.
function createMethodOptionsStruct<T extends rust.Type & { lifetime: rust.Lifetime }>(
  crate: rust.Crate,
  name: string,
  methodOptionsType: T
): rust.ParameterGroup<rust.Option<rust.Struct>> {
  const optionsStruct = new rust.Struct(name, 'pub');
  optionsStruct.lifetime = methodOptionsType.lifetime;
  const methodOptionsField = new rust.StructField('method_options', 'pub', methodOptionsType);
  optionsStruct.fields.push(methodOptionsField);
  return new rust.ParameterGroup('options', new rust.Option(optionsStruct));
}

function getClientContent(crate: rust.Crate, fileName: string): string {
  const codegen = new CodeGenerator(crate);
  const clientFile = codegen.emitContent().find((file) => file.name.endsWith(fileName));
  if (!clientFile) {
    throw new Error(`missing generated client file ${fileName}`);
  }
  return clientFile.content;
}

describe('typespec-rust: codegen', () => {
  describe('generateCargoTomlFile', () => {
    it('default Cargo.toml file', () => {
      const expected = '[package]\n' +
        'name = "test_crate"\n' +
        'version = "1.2.3"\n' +
        'authors.workspace = true\n' +
        'edition.workspace = true\n' +
        'license.workspace = true\n' +
        'repository.workspace = true\n' +
        'rust-version.workspace = true\n' +
        'exclude.workspace = true\n' +
        '\n' +
        '[features]\n' +
        'default = ["azure_core/default"]\n';

      const codegen = new CodeGenerator(new rust.Crate('test_crate', '1.2.3', 'azure-arm'));
      const cargoToml = codegen.emitCargoToml();
      strictEqual(cargoToml, expected);
    });

    it('default Cargo.toml file with dependencies', () => {
      const expected = '[package]\n' +
        'name = "test_crate"\n' +
        'version = "1.2.3"\n' +
        'authors.workspace = true\n' +
        'edition.workspace = true\n' +
        'license.workspace = true\n' +
        'repository.workspace = true\n' +
        'rust-version.workspace = true\n' +
        'exclude.workspace = true\n' +
        '\n' +
        '[features]\n' +
        'default = ["azure_core/default"]\n' +
        '\n' +
        '[dependencies]\n' +
        'azure_core = { workspace = true, default-features = false }\n';

      const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
      crate.dependencies.push(new rust.CrateDependency('azure_core'));
      const codegen = new CodeGenerator(crate);
      const cargoToml = codegen.emitCargoToml();
      strictEqual(cargoToml, expected);
    });
  });

  describe('helpers', () => {
    it('annotationDerive', () => {
      strictEqual(helpers.annotationDerive(true), '#[derive(Clone, Deserialize, SafeDebug, Serialize)]\n');
      strictEqual(helpers.annotationDerive(true, 'Copy'), '#[derive(Clone, Copy, Deserialize, SafeDebug, Serialize)]\n');
      strictEqual(helpers.annotationDerive(true, '', 'Copy'), '#[derive(Clone, Copy, Deserialize, SafeDebug, Serialize)]\n');
      strictEqual(helpers.annotationDerive(false), '#[derive(Clone, SafeDebug)]\n');
      strictEqual(helpers.annotationDerive(false, 'Copy'), '#[derive(Clone, Copy, SafeDebug)]\n');
      strictEqual(helpers.annotationDerive(false, '', 'Copy'), '#[derive(Clone, Copy, SafeDebug)]\n');
    });

    it('emitVisibility', () => {
      strictEqual(helpers.emitVisibility('pub'), 'pub ');
      strictEqual(helpers.emitVisibility('pubCrate'), 'pub(crate) ');
    });

    it('indent', () => {
      const indent = new helpers.indentation();
      strictEqual(indent.get(), '    ');
      strictEqual(indent.push().get(), '        ');
      strictEqual(indent.push().get(), '            ');
      strictEqual(indent.pop().get(), '        ');
      strictEqual(indent.pop().get(), '    ');
      strictEqual(indent.get(), '    ');
    });

    it('buildIfBlock', () => {
      const indent = new helpers.indentation(0);
      const ifblock = helpers.buildIfBlock(indent, {
        condition: 'foo == bar',
        body: (indent) => { return `${indent.get()}bing = bong;\n`; }
      });
      const expected =
        'if foo == bar {\n' +
        '    bing = bong;\n' +
        '}';
      strictEqual(ifblock, expected);
    });

    it('buildMatch', () => {
      const indent = new helpers.indentation(0);
      const match = helpers.buildMatch(indent, 'cond', [
        {
          pattern: 'Some(foo)',
          body: (ind) => {
            return `${ind.get()}${helpers.buildIfBlock(ind, {
              condition: 'foo == bar',
              body: (ind) => `${ind.get()}bing = bong;\n`
            })}\n`;
          }
        },
        {
          pattern: 'None',
          body: (ind) => { return `${ind.get()}the none branch;\n`; }
        }
      ]);
      const expected =
        'match cond {\n' +
        '    Some(foo) => {\n' +
        '        if foo == bar {\n' +
        '            bing = bong;\n' +
        '        }\n' +
        '    },\n' +
        '    None => {\n' +
        '        the none branch;\n' +
        '    },\n' +
        '}';
      strictEqual(match, expected);
    });

    it('buildMatch with return types', () => {
      const indent = new helpers.indentation(0);
      const match = helpers.buildMatch(indent, 'cond', [
        {
          pattern: 'Some(foo)',
          returns: 'Returns1',
          body: (ind) => {
            return `${ind.get()}${helpers.buildIfBlock(ind, {
              condition: 'foo == bar',
              body: (ind) => `${ind.get()}bing = bong;\n`
            })}\n`;
          }
        },
        {
          pattern: 'None',
          returns: 'Returns2',
          body: (ind) => { return `${ind.get()}the none branch;\n`; }
        }
      ]);
      const expected =
        'match cond {\n' +
        '    Some(foo) => Returns1 {\n' +
        '        if foo == bar {\n' +
        '            bing = bong;\n' +
        '        }\n' +
        '    },\n' +
        '    None => Returns2 {\n' +
        '        the none branch;\n' +
        '    },\n' +
        '}';
      strictEqual(match, expected);
    });
  });

  describe('serde defaults', () => {
    for (const visibility of ['pub', 'pubCrate'] as const) {
      for (const flags of [rust.ModelFlags.Input, rust.ModelFlags.Output, rust.ModelFlags.Input | rust.ModelFlags.Output]) {
        it(`defaults non-optional fields for ${visibility} models with usage ${flags}`, () => {
          const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
          const ranges = new rust.Model('Ranges', visibility, flags, crate);
          ranges.fields.push(new rust.ModelField('range', 'Range', visibility, new rust.Vector(new rust.StringType()), false));
          const layout = new rust.Model('Layout', visibility, flags, crate);
          layout.fields.push(new rust.ModelField('ranges', 'Ranges', visibility, ranges, false));
          layout.fields.push(new rust.ModelField('name', 'Name', visibility, new rust.Option(new rust.StringType()), true));
          crate.models.push(layout, ranges);

          const models = new CodeGenerator(crate).emitContent().find((file) => file.name === 'generated/models/models.rs');
          strictEqual(models?.content.includes('#[serde(default, rename = "Ranges")]'), true);
          strictEqual(models?.content.includes('#[serde(default, rename = "Range")]'), true);
          strictEqual(models?.content.includes('#[serde(rename = "Name", skip_serializing_if = "Option::is_none")]'), true);
        });
      }
    }

    it('does not default required fields in spread parameter helpers', () => {
      const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
      const model = new rust.Model('SpreadParams', 'pubCrate', rust.ModelFlags.Unspecified, crate);
      model.fields.push(new rust.ModelField('name', 'name', 'pubCrate', new rust.StringType(), false));
      crate.models.push(model);

      const models = new CodeGenerator(crate).emitContent().find((file) => file.name === 'generated/models/models.rs');
      strictEqual(models?.content.includes('pub(crate) name: String,'), true);
      strictEqual(models?.content.includes('#[serde(default'), false);
    });
  });

  it('emits custom serialize_with for offsetDateTime fields', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const model = new rust.Model('Sample', 'pub', rust.ModelFlags.Output, crate);
    const field = new rust.ModelField(
      'time',
      'time',
      'pub',
      new rust.Option(new rust.OffsetDateTime(crate, 'rfc3339', false)),
      true
    );
    field.customizations.push(new rust.SerializeWith('crate::models::serialize_time'));
    model.fields.push(field);
    crate.models.push(model);

    const codegen = new CodeGenerator(crate);
    const models = codegen.emitContent().find((file) => file.name === 'generated/models/models.rs');

    strictEqual(models?.content.includes('deserialize_with = "azure_core::time::rfc3339::option::deserialize"'), true);
    strictEqual(models?.content.includes('serialize_with = "crate::models::serialize_time"'), true);
    strictEqual(models?.content.includes('with = "azure_core::time::rfc3339::option"'), false);
  });

  it('emits a Page helper struct for nextLink pagers', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const client = createClient(crate, 'WidgetClient');
    const lifetime = new rust.Lifetime('a');
    const options = createMethodOptionsStruct(
      crate,
      'WidgetClientListWidgetsOptions',
      new rust.PagerOptions(crate, lifetime, 'nextLink')
    );
    const responseModel = new rust.Model('WidgetPage', 'pub', rust.ModelFlags.Output, crate);
    const itemsField = new rust.ModelField('items', 'items', 'pub', new rust.Vector(new rust.StringType()), false);
    itemsField.flags = rust.ModelFieldFlags.PageItems;
    const nextLinkField = new rust.ModelField('next_link', '@nextLink', 'pub', new rust.Option(new rust.StringType()), true);
    responseModel.fields.push(itemsField, nextLinkField);
    crate.models.push(responseModel);

    const method = new rust.PageableMethod('list_widgets', 'WidgetClient.listWidgets', client, 'pub', options, 'get', '/widgets');
    method.returns = new rust.Result(
      crate,
      new rust.Pager(crate, new rust.Response(crate, responseModel, 'JsonFormat'), 'nextLink')
    );
    method.strategy = new rust.PageableStrategyNextLink([nextLinkField]);
    method.statusCodes = [];
    client.methods.push(method);

    const clientContent = getClientContent(crate, 'generated/clients/widget_client.rs');

    strictEqual(clientContent.includes('struct WidgetClientListWidgetsPage {'), true);
    strictEqual(clientContent.includes('#[serde(rename = "@nextLink")]'), true);
    strictEqual(clientContent.includes('let res: WidgetClientListWidgetsPage = json::from_json(&body)?;'), true);
  });

  describe('LRO output formats', () => {
    for (const [crateType, hasResult, format] of [
      ['azure-arm', false, 'NoFormat'],
      ['data-plane', false, 'JsonFormat'],
      ['azure-arm', true, 'JsonFormat'],
    ] as const) {
      it(`uses ${format} for ${crateType} ${hasResult ? 'resource' : 'empty'} results`, () => {
        const crate = new rust.Crate('test_crate', '1.2.3', crateType);
        const client = createClient(crate, 'WidgetClient');
        const options = createMethodOptionsStruct(
          crate,
          'WidgetClientBeginCreateOptions',
          new rust.PollerOptions(crate, new rust.Lifetime('a'))
        );
        const status = new rust.Model('CreateStatus', 'pub', rust.ModelFlags.Output, crate);
        status.fields.push(new rust.ModelField('status', 'status', 'pub', new rust.Option(new rust.StringType()), true));
        crate.models.push(status);
        const poller = new rust.Poller(crate, new rust.Response(crate, status, 'JsonFormat'));
        if (hasResult) {
          const resource = new rust.Model('Widget', 'pub', rust.ModelFlags.Output, crate);
          crate.models.push(resource);
          poller.resultType = new rust.Response(crate, resource, 'JsonFormat');
        }
        const method = new rust.LroMethod(
          'begin_create', 'WidgetClient.beginCreate', client, 'pub', options, 'post', '/widgets',
          new rust.LroFinalResultStrategyOriginalUri()
        );
        method.returns = new rust.Result(crate, poller);
        method.statusCodes = [];
        client.methods.push(method);

        const implementations = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('models/models_impl.rs'))?.content;
        strictEqual(implementations?.includes(`type Format = ${format};`), true);
        strictEqual(implementations?.includes(`type Output = ${hasResult ? 'Widget' : '()'};`), true);
      });
    }
  });

  it('classifies LRO wire statuses case-insensitively and keeps unknown values in progress', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const client = createClient(crate, 'WidgetClient');
    const options = createMethodOptionsStruct(
      crate,
      'WidgetClientBeginCreateOptions',
      new rust.PollerOptions(crate, new rust.Lifetime('a'))
    );
    const statusEnum = new rust.Enum('OperationState', 'pub', true, 'String', crate);
    const succeeded = new rust.EnumValue('Succeeded', statusEnum, 'Succeeded');
    succeeded.lroTerminalStatus = 'Succeeded';
    const needsReview = new rust.EnumValue('NeedsReview', statusEnum, 'NeedsReview');
    needsReview.lroTerminalStatus = 'Failed';
    statusEnum.values.push(succeeded, needsReview);
    crate.enums.push(statusEnum);

    const statusModel = new rust.Model('CreateStatus', 'pub', rust.ModelFlags.Output, crate);
    statusModel.fields.push(new rust.ModelField('status', 'status', 'pub', new rust.Option(statusEnum), true));
    crate.models.push(statusModel);
    const method = new rust.LroMethod(
      'begin_create',
      'WidgetClient.beginCreate',
      client,
      'pub',
      options,
      'put',
      '/widgets',
      new rust.LroFinalResultStrategyOriginalUri()
    );
    method.returns = new rust.Result(
      crate,
      new rust.Poller(crate, new rust.Response(crate, statusModel, 'JsonFormat'))
    );
    method.statusMetadata = {
      initial: { path: ['properties', 'status'] },
      polling: { path: ['status'], statusEnum },
      pollingKinds: ['OriginalUrl'],
    };
    method.statusCodes = [];
    client.methods.push(method);

    const codegen = new CodeGenerator(crate);
    const implementations = codegen.emitContent().find(file => file.name.endsWith('models/models_impl.rs'))?.content ?? '';
    const clientContent = getClientContent(crate, 'generated/clients/widget_client.rs');
    strictEqual(implementations.includes('status.eq_ignore_ascii_case("NeedsReview")'), true);
    strictEqual(implementations.includes('PollerStatus::Failed'), true);
    strictEqual(implementations.includes('Self::lro_status_from_str(value.as_ref())'), true);
    strictEqual(clientContent.includes('StatusResponseKind::Initial'), true);
    strictEqual(clientContent.includes('StatusResponseKind::OriginalUrl'), true);
    strictEqual(clientContent.includes('<CreateStatus as StatusMonitor>::status_from_response(&raw, kind)?'), true);
    strictEqual(clientContent.includes('status_body'), false);
    strictEqual(clientContent.includes('azure_core::Value'), false);
    strictEqual(clientContent.includes('PollerStatus::InProgress | PollerStatus::UnknownValue(_)'), true);
  });

  it('overrides ARM response classification for nested custom statuses by response source', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'azure-arm');
    const client = createClient(crate, 'WidgetClient');
    const options = createMethodOptionsStruct(
      crate,
      'WidgetClientBeginCreateOptions',
      new rust.PollerOptions(crate, new rust.Lifetime('a'))
    );
    const statusEnum = new rust.Enum('OperationState', 'pub', true, 'String', crate);
    const needsReview = new rust.EnumValue('NeedsReview', statusEnum, 'NeedsReview');
    needsReview.lroTerminalStatus = 'Failed';
    statusEnum.values.push(needsReview);
    crate.enums.push(statusEnum);

    const properties = new rust.Model('StatusProperties', 'pub', rust.ModelFlags.Output, crate);
    properties.fields.push(new rust.ModelField('status', 'status', 'pub', new rust.Option(statusEnum), true));
    const statusModel = new rust.Model('CreateStatus', 'pub', rust.ModelFlags.Output, crate);
    statusModel.fields.push(
      new rust.ModelField('properties', 'properties', 'pub', new rust.Option(properties), true),
      new rust.ModelField('status', 'status', 'pub', new rust.Option(statusEnum), true),
    );
    crate.models.push(properties, statusModel);

    const method = new rust.LroMethod(
      'begin_create',
      'WidgetClient.beginCreate',
      client,
      'pub',
      options,
      'put',
      '/widgets',
      new rust.LroFinalResultStrategyOriginalUri()
    );
    method.returns = new rust.Result(
      crate,
      new rust.Poller(crate, new rust.Response(crate, statusModel, 'JsonFormat'))
    );
    method.statusMetadata = {
      initial: { path: ['properties', 'status'], statusEnum },
      polling: { path: ['status'], statusEnum },
      pollingKinds: ['AzureAsyncOperation', 'OperationLocation', 'Location', 'OriginalUrl'],
    };
    method.statusCodes = [];
    client.methods.push(method);

    const implementations = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('models/models_impl.rs'))?.content ?? '';
    strictEqual(implementations.includes('StatusResponseKind::Initial'), true);
    strictEqual(implementations.includes('StatusResponseKind::AzureAsyncOperation'), true);
    strictEqual(implementations.includes('StatusResponseKind::OperationLocation'), true);
    strictEqual(implementations.includes('StatusResponseKind::Location'), true);
    strictEqual(implementations.includes('StatusResponseKind::OriginalUrl'), true);
    strictEqual(implementations.includes('StatusResponseKind::Location => {'), true);
    strictEqual(implementations.includes('StatusResponseKind::OriginalUrl => {'), true);
    strictEqual(implementations.includes('StatusResponseKind::OperationLocation => {'), true);
    strictEqual(implementations.includes('StatusResponseKind::AzureAsyncOperation => {'), true);
    strictEqual(implementations.includes('struct CreateStatusLocationStatusResponse'), true);
    strictEqual(implementations.includes('#[serde(rename = "properties")]'), true);
    strictEqual(implementations.includes('eq_ignore_ascii_case("NeedsReview")'), true);
    strictEqual(implementations.includes('Self::lro_status_from_str(status.0.as_ref())'), true);
    strictEqual(implementations.includes('azure_core::Value'), false);

    method.statusMetadata.polling = method.statusMetadata.initial;
    const nested = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('models/models_impl.rs'))!.content;
    strictEqual(nested.includes('        {\n            let Some(status_parent_0) = self.properties.as_ref()'), true);
    strictEqual(nested.includes('            match &status_parent_0.status'), true);
    strictEqual(nested.includes('\n        }\n    }\n    fn status_from_response('), true);
  });

  it('keeps phase-specific mappings and borrows optional custom status paths', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const client = createClient(crate, 'WidgetClient');
    const initial = new rust.Enum('InitialState', 'pub', true, 'String', crate);
    const polling = new rust.Enum('PollingState', 'pub', true, 'String', crate);
    for (const [type, role] of [[initial, 'Failed'], [polling, 'Succeeded']] as const) {
      const value = new rust.EnumValue('Complete', type, 'Complete');
      value.lroTerminalStatus = role;
      type.values.push(value);
      crate.enums.push(type);
    }
    const model = new rust.Model('CreateStatus', 'pub', rust.ModelFlags.Output, crate);
    model.fields.push(new rust.ModelField('status', 'status', 'pub', new rust.Option(polling), true));
    crate.models.push(model);
    const method = new rust.LroMethod(
      'begin_create', 'WidgetClient.beginCreate', client, 'pub',
      createMethodOptionsStruct(crate, 'BeginOptions', new rust.PollerOptions(crate, new rust.Lifetime('a'))),
      'put', '/widgets', new rust.LroFinalResultStrategyHeader('location'),
    );
    method.returns = new rust.Result(crate, new rust.Poller(crate, new rust.Response(crate, model, 'JsonFormat')));
    method.statusMetadata = {
      initial: { path: ['properties', 'initialStatus'], optional: [true, true], statusEnum: initial },
      polling: { path: ['status'], optional: [false], statusEnum: polling },
      pollingKinds: ['Location'],
    };
    method.statusCodes = [];
    client.methods.push(method);
    const files = new CodeGenerator(crate).emitContent();
    const impl = files.find(file => file.name.endsWith('models/models_impl.rs'))!.content;
    strictEqual(impl.includes("std::borrow::Cow<'a, str>"), true);
    strictEqual(impl.includes("Option<CreateStatusStatusValue<'a>>"), true);
    strictEqual(impl.includes("Option<CreateStatusInitialStatusResponseProperties<'a>>"), true);
    strictEqual(impl.includes('StatusResponseLevel'), false);
    strictEqual(impl.includes("struct CreateStatusInitialStatusResponseProperties<'a> {\n    #[serde"), true);
    strictEqual(impl.includes("impl CreateStatus {\n    fn lro_status_from_str"), true);
    strictEqual(impl.includes('serde_json::from_slice(response.body())?'), true);
    strictEqual(impl.includes('else { return Ok(Some(PollerStatus::InProgress)); }'), true);
    strictEqual(impl.includes('Self::lro_initial_status_from_str(initial_status.0.as_ref())'), true);
    strictEqual(impl.includes('Self::lro_status_from_str(status.0.as_ref())'), true);
    strictEqual(impl.includes('let status = response.status;'), true);
    strictEqual(impl.includes('azure_core::Value'), false);
    strictEqual(crate.dependencies.some(dependency => dependency.name === 'serde_json'), true);

    const originalInitial = method.statusMetadata.initial;
    method.statusMetadata.initial = {
      ...originalInitial,
      path: ['properties', 'properties', 'initialStatus'],
      fieldNames: ['properties', 'properties', 'initial_status'],
      optional: [true, true, true],
    };
    const repeated = new CodeGenerator(crate).emitContent().find(file => file.name.endsWith('models/models_impl.rs'))!.content;
    strictEqual(repeated.includes("struct CreateStatusInitialStatusResponsePropertiesProperties<'a>"), true);
    strictEqual(repeated.includes("properties: Option<CreateStatusInitialStatusResponsePropertiesProperties<'a>>"), true);
    method.statusMetadata.initial = originalInitial;

    const other = new rust.LroMethod(
      'begin_other', 'WidgetClient.beginOther', client, 'pub', method.options,
      'put', '/other', new rust.LroFinalResultStrategyHeader('location'),
    );
    other.returns = method.returns;
    other.statusMetadata = { ...method.statusMetadata, initial: { ...method.statusMetadata.initial!, statusEnum: polling } };
    client.methods.push(other);
    throws(() => new CodeGenerator(crate).emitContent(), error => {
      const message = (error as Error).message;
      return /Shared LRO monitor.*incompatible status metadata/.test(message)
        && message.includes('WidgetClient.beginCreate')
        && message.includes('WidgetClient.beginOther');
    });
  });

  it('pollers still deserialize the full status model when status is present', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const client = createClient(crate, 'WidgetClient');
    const lifetime = new rust.Lifetime('a');
    const options = createMethodOptionsStruct(
      crate,
      'WidgetClientBeginCreateOptions',
      new rust.PollerOptions(crate, lifetime)
    );
    const statusModel = new rust.Model('CreateStatus', 'pub', rust.ModelFlags.Output, crate);
    statusModel.fields.push(new rust.ModelField('status', 'status', 'pub', new rust.Option(new rust.StringType()), true));
    crate.models.push(statusModel);

    const method = new rust.LroMethod(
      'begin_create',
      'WidgetClient.beginCreate',
      client,
      'pub',
      options,
      'post',
      '/widgets',
      new rust.LroFinalResultStrategyOriginalUri()
    );
    method.returns = new rust.Result(
      crate,
      new rust.Poller(crate, new rust.Response(crate, statusModel, 'JsonFormat'))
    );
    method.statusCodes = [];
    client.methods.push(method);

    const clientContent = getClientContent(crate, 'generated/clients/widget_client.rs');

    strictEqual(clientContent.includes('struct WidgetClientBeginCreateMonitor {'), false);
    strictEqual(clientContent.includes('let res: CreateStatus = json::from_json(&body)?;'), true);
    strictEqual(clientContent.includes('let poller_status:'), false);
    strictEqual(clientContent.includes('Ok(match res.status() {'), true);
  });

  it('canonical enum pollers retain full typed model decoding', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const client = createClient(crate, 'WidgetClient');
    const lifetime = new rust.Lifetime('a');
    const options = createMethodOptionsStruct(
      crate,
      'WidgetClientBeginCreateOptions',
      new rust.PollerOptions(crate, lifetime)
    );
    const statusEnum = new rust.Enum('OperationState', 'pub', true, 'String', crate);
    const succeeded = new rust.EnumValue('Succeeded', statusEnum, 'Succeeded');
    succeeded.lroTerminalStatus = 'Succeeded';
    statusEnum.values.push(succeeded);
    crate.enums.push(statusEnum);

    const statusModel = new rust.Model('CreateStatus', 'pub', rust.ModelFlags.Output, crate);
    statusModel.fields.push(new rust.ModelField('status', 'status', 'pub', new rust.Option(statusEnum), true));
    crate.models.push(statusModel);

    const method = new rust.LroMethod(
      'begin_create',
      'WidgetClient.beginCreate',
      client,
      'pub',
      options,
      'post',
      '/widgets',
      new rust.LroFinalResultStrategyOriginalUri()
    );
    method.returns = new rust.Result(
      crate,
      new rust.Poller(crate, new rust.Response(crate, statusModel, 'JsonFormat'))
    );
    method.statusMetadata = {
      initial: { path: ['properties', 'differentInitialStatus'], statusEnum },
      polling: { path: ['status'], statusEnum },
      pollingKinds: ['OperationLocation'],
    };
    method.statusCodes = [];
    client.methods.push(method);

    const files = new CodeGenerator(crate).emitContent();
    const clientContent = getClientContent(crate, 'generated/clients/widget_client.rs');
    const implementations = files.find(file => file.name.endsWith('models/models_impl.rs'))?.content ?? '';

    strictEqual(clientContent.includes('struct WidgetClientBeginCreateMonitor {'), false);
    strictEqual(clientContent.includes('let res: CreateStatus = json::from_json(&body)?;'), true);
    strictEqual(clientContent.includes('let poller_status:'), false);
    strictEqual(clientContent.includes('status_from_response'), false);
    strictEqual(clientContent.includes('StatusResponseKind'), false);
    strictEqual(clientContent.includes('let is_initial'), false);
    strictEqual(clientContent.includes('Ok(match res.status() {'), true);
    strictEqual(implementations.includes('lro_status_from_str'), false);
    strictEqual(implementations.includes('Some(v) => PollerStatus::from(v.as_ref())'), true);
    strictEqual(crate.dependencies.some(dependency => dependency.name === 'serde_json'), false);
  });

  it('pollers still deserialize the full status model when no status field is present', () => {
    const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
    const client = createClient(crate, 'WidgetClient');
    const lifetime = new rust.Lifetime('a');
    const options = createMethodOptionsStruct(
      crate,
      'WidgetClientBeginDeleteOptions',
      new rust.PollerOptions(crate, lifetime)
    );
    const statusModel = new rust.Model('DeleteStatus', 'pub', rust.ModelFlags.Output, crate);
    statusModel.fields.push(new rust.ModelField('operation_id', 'operationId', 'pub', new rust.StringType(), false));
    crate.models.push(statusModel);

    const method = new rust.LroMethod(
      'begin_delete',
      'WidgetClient.beginDelete',
      client,
      'pub',
      options,
      'delete',
      '/widgets',
      new rust.LroFinalResultStrategyOriginalUri()
    );
    method.returns = new rust.Result(
      crate,
      new rust.Poller(crate, new rust.Response(crate, statusModel, 'JsonFormat'))
    );
    method.statusCodes = [];
    client.methods.push(method);

    const clientContent = getClientContent(crate, 'generated/clients/widget_client.rs');

    strictEqual(clientContent.includes('struct WidgetClientBeginDeleteMonitor {'), false);
    strictEqual(clientContent.includes('let poller_status:'), false);
    strictEqual(clientContent.includes('let res: DeleteStatus = json::from_json(&body)?;'), true);
    strictEqual(clientContent.includes('Ok(match res.status() {'), true);
  });
});
