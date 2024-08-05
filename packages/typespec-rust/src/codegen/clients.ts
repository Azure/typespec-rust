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
    const indentation = new helpers.indentation();

    let pubInClients = '';
    if (!client.constructable) {
      // the constructable client will need access to these fields
      pubInClients = 'pub(in crate::generated::clients) ';
    }

    let refWithLifetime = '';
    if (client.lifetime) {
      refWithLifetime = `&${client.lifetime.name} `;
    }

    let body = `pub struct ${client.name}${getLifetimeAnnotation(client)}{\n`;
    for (const field of client.fields) {
      use.addForType(field.type);
      body += `${indentation.get()}${pubInClients}${field.name}: ${refWithLifetime}${helpers.getTypeDeclaration(field.type)},\n`;
    }
    use.addType('azure_core', 'Pipeline');
    body += `${indentation.get()}${pubInClients}pipeline: ${refWithLifetime}Pipeline,\n`;
    body += '}\n\n'; // end client

    if (client.constructable) {
      body += '#[derive(Clone, Debug)]\n';
      body += `pub struct ${client.constructable.options.type.name}`;
      if (client.constructable.options.type.fields.length > 0) {
        body += ' {\n';
        for (const field of client.constructable.options.type.fields) {
          use.addForType(field.type);
          body += `${indentation.get()}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
        }
        body += '}\n\n'; // end client options
      } else {
        body += ';\n\n';
      }
    }

    body += `impl${getLifetimeAnnotation(client)} ${client.name}${getLifetimeAnnotation(client)}{\n`;

    if (client.constructable) {
      // this is an instantiable client, so we need to emit client options and constructors
      use.addType('azure_core', 'Result');

      for (let i = 0; i < client.constructable.constructors.length; ++i) {
        const constructor = client.constructable.constructors[i];
        body += `${indentation.get()}pub fn ${constructor.name}(${getConstructorParamsSig(constructor.parameters, client.constructable.options, use)}) -> Result<Self> {\n`;
        // by convention, the endpoint param is always the first ctor param
        const endpointParamName = constructor.parameters[0].name;
        body += `${indentation.push().get()}let mut ${endpointParamName} = Url::parse(${endpointParamName}.as_ref())?;\n`;
        body += `${indentation.get()}${endpointParamName}.query_pairs_mut().clear();\n`;
        body += `${indentation.get()}let options = options.unwrap_or_default();\n`;
        body += `${indentation.get()}Ok(Self {\n`;
        body += `${indentation.push().get()}${endpointParamName},\n`;
        body += `${indentation.get()}pipeline: Pipeline::new(\n`;
        body += `${indentation.push().get()}option_env!("CARGO_PKG_NAME"),\n`;
        body += `${indentation.get()}option_env!("CARGO_PKG_VERSION"),\n`;
        body += `${indentation.get()}options.client_options,\n`;
        body += `${indentation.get()}Vec::default(),\n`;
        body += `${indentation.get()}Vec::default(),\n`;
        body += `${indentation.pop().get()}),\n`; // end Pipeline::new
        body += `${indentation.pop().get()}})\n`; // end Ok
        body += `${indentation.pop().get()}}\n`; // end constructor

        // ensure extra new-line between ctors and/or client methods
        if (i + 1 < client.constructable.constructors.length || client.methods.length > 0) {
          body += '\n';
        }
      }
    }

    for (let i = 0; i < client.methods.length; ++i) {
      const method = client.methods[i];
      let returnType: string;
      let async = 'async ';
      let methodBody: (indentation: helpers.indentation) => string;
      use.addForType(method.returns);
      switch (method.kind) {
        case 'async':
          returnType = helpers.getTypeDeclaration(method.returns);
          methodBody = (indentation: helpers.indentation): string => {
            return getAsyncMethodBody(indentation, method);
          };
          break;
        case 'clientaccessor':
          async = '';
          returnType = method.returns.name;
          methodBody = (indentation: helpers.indentation): string => {
            return getClientAccessorMethodBody(indentation, method);
          };
          break;
      }
      body += `${indentation.get()}${helpers.emitPub(method.pub)}${async}fn ${method.name}(${getMethodParamsSig(method, use)}) -> ${returnType} {\n`;
      body += `${indentation.push().get()}${methodBody(indentation)}\n`;
      body += `${indentation.pop().get()}}\n`; // end method
      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    body += '}\n\n'; // end client impl

    if (client.constructable) {
      // emit default trait impl for client options type
      body += `impl Default for ${client.constructable.options.type.name} {\n`;
      body += `${indentation.get()}fn default() -> Self {\n`;
      body += `${indentation.push().get()}Self {\n`;
      body += `${indentation.push().get()}client_options: ClientOptions::default(),\n`;
      body += `${indentation.pop().get()}}\n`;
      body += `${indentation.pop().get()}}\n`;
      body += '}\n\n'; // end impl
    }

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
      body += `${helpers.emitPub(method.pub)}struct ${helpers.getTypeDeclaration(method.options.type)} {\n`;
      for (const field of method.options.type.fields) {
        use.addForType(field.type);
        body += `${indentation.get()}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
      }
      body += '}\n\n'; // end options

      body += `impl${getLifetimeAnnotation(method.options.type)}${helpers.getTypeDeclaration(method.options.type)} {\n`;
      body += `${indentation.get()}pub fn builder() -> builders::${getOptionsBuilderTypeName(method.options, true)} {\n`;
      body += `${indentation.push().get()}builders::${getOptionsBuilderTypeName(method.options, false)}::new()\n`;
      body += `${indentation.pop().get()}}\n`; // end builder()
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

function getConstructorParamsSig(params: Array<rust.ClientParameter>, options: rust.ClientOptions, use: Use): string {
  const paramsSig = new Array<string>();
  for (const param of params) {
    use.addForType(param.type);
    paramsSig.push(`${param.name}: ${helpers.getTypeDeclaration(param.type)}`);
  }
  paramsSig.push(`options: ${helpers.getTypeDeclaration(options)}`);
  return paramsSig.join(', ');
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
    paramsSig.push(`${param.name}: ${formatParamTypeName(param)}`);
  }
  if (method.kind !== 'clientaccessor') {
    paramsSig.push(`options: ${helpers.getTypeDeclaration(method.options, true)}`);
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
  const indentation = new helpers.indentation();

  use.addType('azure_core', 'Context');
  use.addType('azure_core::builders', 'ClientMethodOptionsBuilder');

  let body = 'pub mod builders {\n';
  body += `${indentation.get()}use super::*;\n`;

  for (let i = 0; i < client.methods.length; ++i) {
    const method = client.methods[i];
    if (method.kind === 'clientaccessor') {
      continue;
    }

    const optionsBuilderTypeName = getOptionsBuilderTypeName(method.options, true);

    body += `${indentation.get()}pub struct ${optionsBuilderTypeName} {\n`;
    body += `${indentation.push().get()}options: ${helpers.getTypeDeclaration(method.options.type)},\n`;
    body += `${indentation.pop().get()}}\n\n`; // end struct

    body += `${indentation.get()}impl ${getOptionsBuilderTypeName(method.options, 'anonymous')} {\n`;

    body += `${indentation.push().get()}pub(super) fn new() -> Self {\n`;
    body += `${indentation.push().get()}Self {\n`;
    body += `${indentation.push().get()}options: ${method.options.type.name}::default(),\n`;
    body += `${indentation.pop().get()}}\n`;
    body += `${indentation.pop().get()}}\n\n`; // end new()

    body += `${indentation.get()}pub fn build(&self) -> ${method.options.type.name} {\n`;
    body += `${indentation.push().get()}self.options.clone()\n`;
    body += `${indentation.pop().get()}}\n`;// end build()

    body += `${indentation.pop().get()}}\n\n`; // end impl

    body += `${indentation.get()}impl${getLifetimeAnnotation(method.options.type)}ClientMethodOptionsBuilder${getLifetimeAnnotation(method.options.type)}for ${optionsBuilderTypeName} {\n`;

    body += `${indentation.push().get()}fn with_context(mut self, context: &${getLifetimeName(method.options.type)}Context) -> Self {\n`;
    body += `${indentation.push().get()}self.options.${getClientMethodOptionsFieldName(method.options)}.set_context(context);\n`;
    body += `${indentation.get()}self\n`;
    body += `${indentation.pop().get()}}\n`; // end with_context

    body += `${indentation.pop().get()}}\n`; // end ClientMethodOptionsBuilder impl

    if (i + 1 < client.methods.length) {
      body += '\n';
    }
  }

  body += '}\n'; // end pub mod builders
  return body;
}

function getOptionsBuilderTypeName(option: rust.MethodOptions, withLifetime: true | false | 'anonymous'): string {
  if (!withLifetime || !option.type.lifetime) {
    return `${option.type.name}Builder`;
  } else if (withLifetime === 'anonymous') {
    return `${option.type.name}Builder${helpers.AnonymousLifetimeAnnotation}`;  
  }
  return `${option.type.name}Builder${helpers.getGenericLifetimeAnnotation(option.type.lifetime)}`;
}

function getClientMethodOptionsFieldName(option: rust.MethodOptions): string {
  for (const field of option.type.fields) {
    // startsWith to ignore possible lifetime annotation suffix
    if (helpers.getTypeDeclaration(field.type).startsWith('ClientMethodOptions')) {
      return field.name;
    }
  }
  throw new Error(`didn't find ClientMethodOptions field in ${option.type.name}`);
}

function getLifetimeAnnotation(type: rust.Client | rust.Struct): string {
  if (type.lifetime) {
    return `${helpers.getGenericLifetimeAnnotation(type.lifetime)} `;
  }
  return ' ';
}

function getLifetimeName(type: rust.Struct): string {
  if (type.lifetime) {
    return `${type.lifetime.name} `;
  }
  return ' ';
}

function getClientAccessorMethodBody(indentation: helpers.indentation, clientAccessor: rust.ClientAccessor): string {
  let body = `${clientAccessor.returns.name} {\n`;
  // find the endpoint field. it's the only one that's
  // a URI. the name will be uniform across clients
  let endpointFieldName: string | undefined;
  for (const field of clientAccessor.returns.fields) {
    if (field.kind === 'uri' ) {
      endpointFieldName = field.name;
    } else if (endpointFieldName) {
      throw new Error(`found multiple URI fields in client ${clientAccessor.returns.name} which is unexpected`);
    }
  }
  if (!endpointFieldName) {
    throw new Error(`didn't find URI field for client ${clientAccessor.returns.name}`);
  }
  body += `${indentation.push().get()}${endpointFieldName}: &self.${endpointFieldName},\n`;
  body += `${indentation.get()}pipeline: &self.pipeline,\n`;
  body += `${indentation.pop().get()}}`;
  return body;
}

function getAsyncMethodBody(indentation: helpers.indentation, asyncMethod: rust.AsyncMethod): string {
  return 'unimplemented!();';
}
