/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

// the files and their content to emit
export interface ClientFiles {
  readonly name: string;
  readonly content: string;
}

// emits the content for all client files
export function emitClients(crate: rust.Crate): Array<ClientFiles> {
  const clientFiles = new Array<ClientFiles>();
  if (crate.clients.length === 0) {
    return clientFiles;
  }

  const clientMods = new Array<string>();

  // emit the clients, one file per client
  for (const client of crate.clients) {
    const use = new Use();

    let body = `pub struct ${client.name} {\n`;
    for (const field of client.fields) {
      use.addForType(field.type);
      body += `${helpers.indent(1)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
    }
    body += '}\n\n'; // end client

    body += `impl ${client.name} {\n`;

    for (let i = 0; i < client.methods.length; ++i) {
      const method = client.methods[i];
      let returnType: string;
      let async = 'async ';
      use.addForType(method.returns);
      switch (method.kind) {
        case 'async':
          returnType = helpers.getTypeDeclaration(method.returns);
          break;
        case 'clientaccessor':
          async = '';
          returnType = method.returns.name;
          break;
      }
      body += `${helpers.indent(1)}${helpers.emitPub(method.pub)}${async}fn ${method.name}(${getMethodParamsSig(method, use)}) -> ${returnType} {\n`;
      body += `${helpers.indent(2)}unimplemented!();\n`;
      body += `${helpers.indent(1)}}\n`; // end method
      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    body += '}\n\n'; // end client impl

    // builders aren't needed if there are only client accessors
    let needBuilders = false;

    // emit method options
    for (let i = 0; i < client.methods.length; ++i) {
      const method = client.methods[i];
      if (method.kind === 'clientaccessor') {
        continue;
      }

      needBuilders = true;

      body += '#[derive(Clone, Debug, Default)]\n';
      body += `${helpers.emitPub(method.pub)}struct ${method.options.type.name} {\n`;
      for (const field of method.options.type.fields) {
        use.addForType(field.type);
        body += `${helpers.indent(1)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
      }
      body += '}\n\n'; // end options

      body += `impl ${method.options.type.name} {\n`;
      body += `${helpers.indent(1)}pub fn builder() -> builders::${getOptionsBuilderTypeName(method.options)} {\n`;
      body += `${helpers.indent(2)}builders::${getOptionsBuilderTypeName(method.options)}::new()`;
      body += `${helpers.indent(1)}}\n`; // end builder()
      body += '}\n'; // end options impl

      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    let pubModBuilders = '';
    if (needBuilders) {
      body += '\n';
      pubModBuilders = createPubModBuilders(client, use);
    }

    let content = helpers.contentPreamble();
    content += use.text();
    content += body;
    content += pubModBuilders;

    const clientMod = codegen.deconstruct(client.name).join('_');
    clientFiles.push({name: `${clientMod}.rs`, content: content});
    clientMods.push(clientMod);
  }

  // now emit the mod.rs file for the clients
  let content = helpers.contentPreamble();
  const sortedMods = clientMods.sort((a: string, b: string) => { return helpers.sortAscending(a, b); });
  for (const clientMod of sortedMods) {
    content += `pub mod ${clientMod};\n`;
  }
  clientFiles.push({name: 'mod.rs', content: content});

  return clientFiles;
}

function getMethodParamsSig(method: rust.MethodType, use: Use): string {
  const paramsSig = new Array<string>();
  paramsSig.push(formatParamTypeName(method.self));
  for (const param of method.params) {
    if (param.type.kind === 'literal') {
      // literal params are embedded directly in the code (e.g. accept header param)
      continue;
    }
    use.addForType(param.type);
    // TODO: remove leading underscore once param is used
    paramsSig.push(`_${param.name}: ${formatParamTypeName(param)}`);
  }
  if (method.kind !== 'clientaccessor') {
    // TODO: remove leading underscore once param is used
    paramsSig.push(`_options: ${helpers.getTypeDeclaration(method.options)}`);
  }
  return paramsSig.join(', ');
}

function formatParamTypeName(param: rust.Parameter | rust.Self): string {
  let format = '';
  if (param.ref) {
    format = '&';
  }
  if (param.mut) {
    format += 'mut ';
  }
  if ((<rust.Parameter>param).type) {
    format += helpers.getTypeDeclaration((<rust.Parameter>param).type);
  } else {
    format += param.name;
  }
  return format;
}

function createPubModBuilders(client: rust.Client, use: Use): string {
  use.addTypes('azure_core', ['ClientMethodOptionsBuilder', 'Context']);

  let body = 'pub mod builders {\n';
  body += `${helpers.indent(1)}use super::*;\n`;

  for (let i = 0; i < client.methods.length; ++i) {
    const method = client.methods[i];
    if (method.kind === 'clientaccessor') {
      continue;
    }

    const optionsBuilderTypeName = getOptionsBuilderTypeName(method.options);

    body += `${helpers.indent(1)}pub struct ${optionsBuilderTypeName} {\n`;
    body += `${helpers.indent(2)}options: ${method.options.type.name},\n`;
    body += `${helpers.indent(1)}}\n\n`; // end struct

    body += `${helpers.indent(1)}impl ${optionsBuilderTypeName} {\n`;

    body += `${helpers.indent(2)}pub(super) fn new() -> Self {\n`;
    body += `${helpers.indent(3)}Self {\n`;
    body += `${helpers.indent(4)}options: ${method.options.type.name}::default(),\n`;
    body += `${helpers.indent(3)}}\n`;
    body += `${helpers.indent(2)}}\n\n`; // end new()

    body += `${helpers.indent(2)}pub fn build(&self) -> ${method.options.type.name} {\n`;
    body += `${helpers.indent(3)}self.options.clone()\n`;
    body += `${helpers.indent(2)}}\n`;// end build()

    body += `${helpers.indent(1)}}\n\n`; // end impl

    body += `${helpers.indent(1)}impl ClientMethodOptionsBuilder for ${optionsBuilderTypeName} {\n`;

    body += `${helpers.indent(2)}fn with_context(mut self, context: &Context) -> Self {\n`;
    body += `${helpers.indent(3)}self.options.${getClientMethodOptionsFieldName(method.options)}.set_context(context);\n`;
    body += `${helpers.indent(3)}self\n`;
    body += `${helpers.indent(2)}}\n`; // end with_context

    body += `${helpers.indent(1)}}\n`; // end ClientMethodOptionsBuilder impl

    if (i + 1 < client.methods.length) {
      body += '\n';
    }
  }

  body += '}\n'; // end pub mod builders
  return body;
}

function getOptionsBuilderTypeName(option: rust.MethodOptions): string {
  return `${option.type.name}Builder`;
}

function getClientMethodOptionsFieldName(option: rust.MethodOptions): string {
  for (const field of option.type.fields) {
    if (helpers.getTypeDeclaration(field.type) === 'ClientMethodOptions') {
      return field.name;
    }
  }
  throw new Error(`didn't find ClientMethodOptions field in ${option.type.name}`);
}
