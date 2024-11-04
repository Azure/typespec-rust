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

    let body = `pub struct ${client.name} {\n`;
    for (const field of client.fields) {
      use.addForType(field.type);
      body += `${indentation.get()}${pubInClients}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
    }
    use.addType('azure_core', 'Pipeline');
    body += `${indentation.get()}${pubInClients}pipeline: Pipeline,\n`;
    body += '}\n\n'; // end client

    if (client.constructable) {
      body += '#[derive(Clone, Debug)]\n';
      body += `pub struct ${client.constructable.options.type.name}`;
      if (client.constructable.options.type.fields.length > 0) {
        body += ' {\n';
        for (const field of client.constructable.options.type.fields) {
          use.addForType(field.type);
          body += `${indentation.get()}${helpers.emitPub(field.pub)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
        }
        body += '}\n\n'; // end client options
      } else {
        body += ';\n\n';
      }
    }

    body += `impl ${client.name} {\n`;

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
        // if there's a credential param, create the necessary auth policy
        const authPolicy = getAuthPolicy(constructor, use);
        if (authPolicy) {
          body += `${indentation.get()}${authPolicy}\n`;
        }
        body += `${indentation.get()}let options = options.unwrap_or_default();\n`;
        body += `${indentation.get()}Ok(Self {\n`;

        // propagate any client option fields to the client initializer
        indentation.push();
        for (const field of getClientOptionsFields(client.constructable.options)) {
          body += `${indentation.get()}${field.name}: options.${field.name},\n`;
        }

        body += `${indentation.get()}${endpointParamName},\n`;
        body += `${indentation.get()}pipeline: Pipeline::new(\n`;
        body += `${indentation.push().get()}option_env!("CARGO_PKG_NAME"),\n`;
        body += `${indentation.get()}option_env!("CARGO_PKG_VERSION"),\n`;
        body += `${indentation.get()}options.client_options,\n`;
        body += `${indentation.get()}Vec::default(),\n`;
        body += `${indentation.get()}${authPolicy ? 'vec![auth_policy]' : 'Vec::default()'},\n`;
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
      // NOTE: when methodBody is called, the starting indentation
      // will be correct for the current scope, so there's no need
      // for the callee to indent right away.
      let methodBody: (indentation: helpers.indentation) => string;
      use.addForType(method.returns);
      switch (method.kind) {
        case 'async':
          returnType = helpers.getTypeDeclaration(method.returns);
          methodBody = (indentation: helpers.indentation): string => {
            return getAsyncMethodBody(indentation, use, client, method);
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
      body += `${indentation.get()}${helpers.formatDocComment(method.docs)}`;
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
      const clientOptionsType = client.constructable.options;
      body += `impl Default for ${clientOptionsType.type.name} {\n`;
      body += `${indentation.get()}fn default() -> Self {\n`;
      body += `${indentation.push().get()}Self {\n`;
      indentation.push();
      for (const field of clientOptionsType.type.fields) {
        if (!field.defaultValue) {
          throw new Error(`missing default value for struct field ${clientOptionsType.type.name}.${field.name}`);
        }
        body += `${indentation.get()}${field.name}: ${field.defaultValue},\n`;
      }
      body += `${indentation.pop().get()}}\n`;
      body += `${indentation.pop().get()}}\n`;
      body += '}\n\n'; // end impl
    }

    // emit method options
    for (let i = 0; i < client.methods.length; ++i) {
      const method = client.methods[i];
      if (method.kind === 'clientaccessor') {
        continue;
      }

      body += '#[derive(Clone, Debug, Default)]\n';
      body += `${helpers.emitPub(method.pub)}struct ${helpers.getTypeDeclaration(method.options.type)} {\n`;
      for (const field of method.options.type.fields) {
        use.addForType(field.type);
        body += `${indentation.get()}${helpers.emitPub(field.pub)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
      }
      body += '}\n\n'; // end options

      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    body += '\n';

    let content = helpers.contentPreamble();
    content += use.text();
    content += body;

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
  // check if we have any internal models
  for (const model of crate.models) {
    if (model.internal) {
      content += 'mod internal_models;\n';
      break;
    }
  }
  clientFiles.push({name: 'mod.rs', content: content});

  return clientFiles;
}

function getConstructorParamsSig(params: Array<rust.ClientParameter>, options: rust.ClientOptions, use: Use): string {
  const paramsSig = new Array<string>();
  for (const param of params) {
    use.addForType(param.type);
    paramsSig.push(`${param.name}: ${param.ref ? '&' : ''}${helpers.getTypeDeclaration(param.type)}`);
  }
  paramsSig.push(`options: ${helpers.getTypeDeclaration(options)}`);
  return paramsSig.join(', ');
}

function getMethodParamsSig(method: rust.MethodType, use: Use): string {
  const paramsSig = new Array<string>();
  paramsSig.push(formatParamTypeName(method.self));

  // client accessors only have a self param so skip checking for params
  if (method.kind !== 'clientaccessor') {
    for (const param of method.params) {
      if (param.type.kind === 'literal') {
        // literal params are embedded directly in the code (e.g. accept header param)
        continue;
      }

      // don't add client or optional params to the method param sig
      if (param.location === 'method' && !param.optional) {
        use.addForType(param.type);
        paramsSig.push(`${param.name}: ${formatParamTypeName(param)}`);
      }
    }

    paramsSig.push(`options: ${helpers.getTypeDeclaration(method.options, true)}`);
  }

  return paramsSig.join(', ');
}

// creates the auth policy if the ctor contains a credential param.
// the policy will be named auth_policy.
function getAuthPolicy(ctor: rust.Constructor, use: Use): string | undefined {
  for (const param of ctor.parameters) {
    if (param.type.kind === 'arc' && param.type.type.kind === 'tokenCredential') {
      use.addTypes('azure_core', ['BearerTokenCredentialPolicy', 'Policy']);
      const scopes = new Array<string>();
      for (const scope of param.type.type.scopes) {
        scopes.push(`"${scope}"`);
      }
      return `let auth_policy: Arc<dyn Policy> = Arc::new(BearerTokenCredentialPolicy::new(credential, vec![${scopes.join(', ')}]));`;
    }
  }
  return undefined;
}

function formatParamTypeName(param: rust.MethodParameter | rust.Self): string {
  let format = '';
  if (param.ref) {
    format = '&';
  }
  if (param.mut) {
    format += 'mut ';
  }
  if ((<rust.MethodParameter>param).kind) {
    const methodParam = <rust.MethodParameter>param;
    let paramType = methodParam.type;
    if (methodParam.kind === 'partialBody') {
      // for partial body params, methodParam.type is the model type that's
      // sent in the request. we want the field within the model for this param.
      const field = methodParam.type.type.fields.find(f => { return f.serde === methodParam.serde; });
      if (!field) {
        throw new Error(`didn't find field ${methodParam.serde} for spread param ${methodParam.name}`);
      }
      paramType = field.type;
      if (paramType.kind === 'option') {
        // this is the case where the spread param maps to a non-internal model.
        // for this case, we unwrap the Option<T> to get the underlying type.
        paramType = paramType.type;
      }
    }
    format += helpers.getTypeDeclaration(paramType);
  } else {
    format += param.name;
  }
  return format;
}

// returns a filtered array of struct fields from the client options types
function getClientOptionsFields(option: rust.ClientOptions): Array<rust.StructField> {
  const fields = new Array<rust.StructField>();
  for (const field of option.type.fields) {
    if (helpers.getTypeDeclaration(field.type) === 'ClientOptions') {
      // azure_core::ClientOptions is passed to Pipeline::new so skip it
      continue;
    }
    fields.push(field);
  }
  return fields;
}

function getEndpointFieldName(client: rust.Client): string {
  // find the endpoint field. it's the only one that's
  // a Url. the name will be uniform across clients
  let endpointFieldName: string | undefined;
  for (const field of client.fields) {
    if (field.type.kind === 'Url' ) {
      endpointFieldName = field.name;
    } else if (endpointFieldName) {
      throw new Error(`found multiple URL fields in client ${client.name} which is unexpected`);
    }
  }
  if (!endpointFieldName) {
    throw new Error(`didn't find URI field for client ${client.name}`);
  }
  return endpointFieldName;
}

function getClientAccessorMethodBody(indentation: helpers.indentation, clientAccessor: rust.ClientAccessor): string {
  let body = `${clientAccessor.returns.name} {\n`;
  const endpointFieldName = getEndpointFieldName(clientAccessor.returns);
  body += `${indentation.push().get()}${endpointFieldName}: self.${endpointFieldName}.clone(),\n`;
  body += `${indentation.get()}pipeline: self.pipeline.clone(),\n`;
  body += `${indentation.pop().get()}}`;
  return body;
}

type HeaderParamType = rust.HeaderCollectionParameter | rust.HeaderParameter;
type QueryParamType = rust.QueryCollectionParameter | rust.QueryParameter;

function getAsyncMethodBody(indentation: helpers.indentation, use: Use, client: rust.Client, method: rust.AsyncMethod): string {
  use.addTypes('azure_core', ['AsClientMethodOptions', 'Method', 'Request']);
  const unwrappedOptionsVarName = 'options';
  let body = `let ${unwrappedOptionsVarName} = options.unwrap_or_default();\n`;
  body += `${indentation.get()}let mut ctx = options.method_options.context();\n`;
  body += `${indentation.get()}let mut url = self.${getEndpointFieldName(client)}.clone();\n`;

  // collect and sort all the header/path/query params
  const headerParams = new Array<HeaderParamType>();
  const pathParams = new Array<rust.PathParameter>();
  const queryParams = new Array<QueryParamType>();
  const partialBodyParams = new Array<rust.PartialBodyParameter>();
  for (const param of method.params) {
    switch (param.kind) {
      case 'header':
      case 'headerCollection':
        headerParams.push(param);
        break;
      case 'partialBody':
        partialBodyParams.push(param);
        break;
      case 'path':
        pathParams.push(param);
        break;
      case 'query':
      case 'queryCollection':
        queryParams.push(param);
        break;
    }
  }
  headerParams.sort((a: HeaderParamType, b: HeaderParamType) => { return helpers.sortAscending(a.header, b.header); });
  pathParams.sort((a: rust.PathParameter, b: rust.PathParameter) => { return helpers.sortAscending(a.segment, b.segment); });
  queryParams.sort((a: QueryParamType, b: QueryParamType) => { return helpers.sortAscending(a.key, b.key); });

  // for optional params, by convention, we'll create a local named param.name.
  // setter MUST reference by param.name so it works for optional and required params.
  const getParamValueHelper = function(param: rust.MethodParameter, setter: () => string): string {
    if (param.optional) {
      // optional params are in the unwrapped options local var
      let op = `${indentation.get()}if let Some(${param.name}) = ${unwrappedOptionsVarName}.${param.name} {\n`;
      indentation.push();
      op += setter();
      op += `${indentation.pop().get()}}\n`;
      return op;
    }
    return setter();
  };

  let path = `"${method.httpPath}"`;
  if (pathParams.length > 0) {
    // we have path params that need to have their segments replaced with the param values
    body += `${indentation.get()}let mut path = String::from(${path});\n`;
    for (const pathParam of pathParams) {
      body += `${indentation.get()}path = path.replace("{${pathParam.segment}}", &${getHeaderPathQueryParamValue(pathParam)});\n`;
    }
    path = '&path';
  }

  body += `${indentation.get()}url.set_path(${path});\n`;

  for (const queryParam of queryParams) {
    if (queryParam.kind === 'queryCollection' && queryParam.format === 'multi') {
      body += getParamValueHelper(queryParam, () => {
        const valueVar = queryParam.name[0];
        let text = `${indentation.get()}for ${valueVar} in ${queryParam.name}.iter() {\n`;
        text += `${indentation.push().get()}url.query_pairs_mut().append_pair("${queryParam.key}", ${valueVar});\n`;
        text += `${indentation.pop().get()}}\n`;
        return text;
      });
    } else {
      body += getParamValueHelper(queryParam, () => {
        return `${indentation.get()}url.query_pairs_mut().append_pair("${queryParam.key}", &${getHeaderPathQueryParamValue(queryParam)});\n`;
      });
    }
  }

  body += `${indentation.get()}let mut request = Request::new(url, Method::${codegen.capitalize(method.httpMethod)});\n`;

  for (const headerParam of headerParams) {
    body += getParamValueHelper(headerParam, () => {
      return `${indentation.get()}request.insert_header("${headerParam.header.toLowerCase()}", ${getHeaderPathQueryParamValue(headerParam)});\n`;
    });
  }

  const bodyParam = getBodyParameter(method);
  if (bodyParam) {
    body += getParamValueHelper(bodyParam, () => {
      return `${indentation.get()}request.set_body(${bodyParam.name});\n`;
    });
  } else if (partialBodyParams.length > 0) {
    // all partial body params should point to the same underlying model type.
    const requestContentType = partialBodyParams[0].type;
    use.addForType(requestContentType);
    body += `${indentation.get()}let body: ${helpers.getTypeDeclaration(requestContentType)} = ${requestContentType.type.name} {\n`;
    indentation.push();
    for (const partialBodyParam of partialBodyParams) {
      if (partialBodyParam.type.type !== requestContentType.type) {
        throw new Error(`spread param ${partialBodyParam.name} has conflicting model type ${partialBodyParam.type.type.name}, expected model type ${requestContentType.type.name}`);
      }
      let initializer = partialBodyParam.name;
      if (partialBodyParam.optional) {
        initializer = `${partialBodyParam.name}: options.${partialBodyParam.name}`;
      } else if (!requestContentType.type.internal) {
        // spread param maps to a non-internal model, so it must be wrapped in Some()
        initializer = `${partialBodyParam.name}: Some(${partialBodyParam.name})`;
      }
      body += `${indentation.get()}${initializer},\n`;
    }
    body += `${indentation.pop().get()}}.try_into()?;\n`;
    body += `${indentation.get()}request.set_body(body);\n`;
  }

  body += `${indentation.get()}self.pipeline.send(&mut ctx, &mut request).await\n`;
  return body;
}

function getBodyParameter(method: rust.AsyncMethod): rust.BodyParameter | undefined {
  let bodyParam: rust.BodyParameter | undefined;
  for (const param of method.params) {
    if (param.kind === 'body') {
      if (bodyParam) {
        throw new Error(`method ${method.name} has multiple body parameters`);
      }
      bodyParam = param;
    }
  }
  return bodyParam;
}

function getHeaderPathQueryParamValue(param: HeaderParamType | rust.PathParameter | QueryParamType): string {
  let paramName = '';
  if (param.location === 'client') {
    paramName = 'self.';
  }

  if (param.kind === 'headerCollection' || param.kind === 'queryCollection') {
    if (param.format === 'multi') {
      throw new Error('multi should have been handled outside getHeaderPathQueryParamValue');
    }
    if (param.type.type.kind === 'String') {
      return `${param.name}.join("${getCollectionDelimiter(param.format)}")`;
    }
    // convert the items to strings
    return `${param.name}.iter().map(|i| i.to_string()).collect::<Vec<String>>().join("${getCollectionDelimiter(param.format)}")`;
  }

  switch (param.type.kind) {
    case 'String':
      paramName += param.name;
      break;
    case 'enum':
    case 'offsetDateTime':
    case 'scalar':
      paramName += `${param.name}.to_string()`;
      break;
    case 'implTrait':
      // only done for method params so no need to include paramName prefix
      return `${param.name}.into()`;
    case 'literal':
      return `"${param.type.value}"`;
    default:
      throw new Error(`unhandled ${param.kind} param type kind ${param.type.kind}`);
  }

  return paramName;
}

function getCollectionDelimiter(format: rust.CollectionFormat): string {
  switch (format) {
    case 'csv':
      return ',';
    case 'pipes':
      return '|';
    case 'ssv':
      return ' ';
    case 'tsv':
      return '\t';
    default:
      throw new Error(`unhandled collection format ${format}`);
  }
}
