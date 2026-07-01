/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore ifblock

import * as rust from '../src/codemodel/index.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import * as helpers from '../src/codegen/helpers.js';
import { strictEqual } from 'assert';
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

function createMethodOptionsStruct(crate: rust.Crate, name: string, methodOptionsType: rust.ClientMethodOptions | rust.PagerOptions | rust.PollerOptions): rust.ParameterGroup<rust.Option<rust.Struct>> {
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
        '\n' +
        '[features]\n' +
        'default = ["azure_core/default"]\n' +
        '\n' +
        '[dependencies]\n' +
        'azure_core = { workspace = true }\n';

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

  it('emits a Monitor helper struct for pollers with status fields', () => {
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

    strictEqual(clientContent.includes('struct WidgetClientBeginCreateMonitor {'), true);
    strictEqual(clientContent.includes('let res: WidgetClientBeginCreateMonitor = json::from_json(&body)?;'), true);
    strictEqual(clientContent.includes('let poller_status: PollerStatus = match &res.status {'), true);
  });

  it('uses PollerStatus::Succeeded directly when the poller status model has no status field', () => {
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
    strictEqual(clientContent.includes('let poller_status: PollerStatus = PollerStatus::Succeeded;'), true);
    strictEqual(clientContent.includes('let res: WidgetClientBeginDeleteMonitor = json::from_json(&body)?;'), false);
  });
});
