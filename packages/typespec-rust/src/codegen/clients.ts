/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import * as helpers from './helpers.js';
import queryString from 'query-string';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/** a file to emit */
export interface File {
  /** the name of the file. can contain sub-directories */
  readonly name: string;

  /** the contents of the file */
  readonly content: string;
}

/** the client files and modules */
export interface ClientsContent {
  /** the list of client files */
  clients: Array<File>;

  /** the list of client modules */
  modules: Array<rust.Module>;
}

/**
 * emits the content for all client files
 * 
 * @param crate the crate for which to emit clients
 * @param targetDir the directory to contain the client content
 * @returns client content or undefined if the crate contains no clients
 */
export function emitClients(crate: rust.Crate, targetDir: string): ClientsContent | undefined {
  if (crate.clients.length === 0) {
    return undefined;
  }

  const clientFiles = new Array<File>();
  const clientMods = new Array<rust.Module>();

  // emit the clients, one file per client
  for (const client of crate.clients) {
    const use = new Use();
    const indent = new helpers.indentation();

    let pubInClients = '';
    if (!client.constructable) {
      // the constructable client will need access to these fields
      pubInClients = 'pub(crate) ';
    }

    let body = `pub struct ${client.name} {\n`;
    for (const field of client.fields) {
      use.addForType(field.type);
      body += `${indent.get()}${pubInClients}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
    }
    body += '}\n\n'; // end client

    if (client.constructable) {
      // if client options contains only one field (the azure_core::ClientOptions type)
      // then we can simply derive Default and elide the manual implementation.
      let deriveDefault = ', Default';
      if (client.constructable.options.type.fields.length > 1) {
        deriveDefault = '';
      }
      body += `#[derive(Clone, Debug${deriveDefault})]\n`;
      body += `pub struct ${client.constructable.options.type.name}`;
      if (client.constructable.options.type.fields.length > 0) {
        body += ' {\n';
        for (const field of client.constructable.options.type.fields) {
          use.addForType(field.type);
          body += `${indent.get()}${helpers.emitPub(field.pub)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
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
        body += `${indent.get()}pub fn ${constructor.name}(${getConstructorParamsSig(constructor.parameters, client.constructable.options, use)}) -> Result<Self> {\n`;
        body += `${indent.get()}let options = options.unwrap_or_default();\n`;
        // by convention, the endpoint param is always the first ctor param
        const endpointParamName = constructor.parameters[0].name;
        body += `${indent.push().get()}let mut ${endpointParamName} = Url::parse(${endpointParamName})?;\n`;
        body += `${indent.get()}${endpointParamName}.set_query(None);\n`;

        // construct the supplemental path and join it to the endpoint
        if (client.constructable.endpoint) {
          const supplementalEndpoint = client.constructable.endpoint;
          body += `${indent.get()}let mut host = String::from("${supplementalEndpoint.path}");\n`;
          for (const param of supplementalEndpoint.parameters) {
            body += `${indent.get()}host = host.replace("{${param.segment}}", ${getClientEndpointParamValue(param)});\n`;
          }
          body += `${indent.push().get()}${endpointParamName} = ${endpointParamName}.join(&host)?;\n`;
        }

        // if there's a credential param, create the necessary auth policy
        const authPolicy = getAuthPolicy(constructor, use);
        if (authPolicy) {
          body += `${indent.get()}${authPolicy}\n`;
        }
        body += `${indent.get()}Ok(Self {\n`;

        indent.push();

        // propagate the required client params to the initializer
        // NOTE: we do this on a sorted copy of the client params as we must preserve their order.
        // exclude endpoint params as they aren't propagated to clients (they're consumed when creating the complete endpoint)
        const sortedParams = values([...constructor.parameters]
          .sort((a: rust.ClientParameter, b: rust.ClientParameter) => { return helpers.sortAscending(a.name, b.name); }))
          .where((each) => each.kind !== 'clientEndpoint').toArray();

        for (const param of sortedParams) {
          if (param.optional) {
            continue;
          } else if (isCredential(param.type)) {
            // credential params aren't persisted on the client so skip them
            continue;
          }

          if (!client.fields.find((v: rust.StructField) => { return v.name === param.name; })) {
            throw new Error(`didn't find field in client ${client.name} for param ${param.name}`);
          }

          // by convention, the param field and param name are the
          // same so we can use shorthand initialization syntax
          body += `${indent.get()}${param.name},\n`;
        }

        // propagate any optional client params to the client initializer
        for (const param of sortedParams) {
          if (!param.optional) {
            continue;
          }

          if (!client.fields.find((v: rust.StructField) => { return v.name === param.name; })) {
            throw new Error(`didn't find field in client ${client.name} for param ${param.name}`);
          }

          if (!client.constructable.options.type.fields.find((v: rust.StructField) => { return v.name === param.name; })) {
            throw new Error(`didn't find field in client options ${client.constructable.options.type.name} for optional param ${param.name}`);
          }

          body += `${indent.get()}${param.name}: options.${param.name},\n`;
        }

        body += `${indent.get()}pipeline: Pipeline::new(\n`;
        body += `${indent.push().get()}option_env!("CARGO_PKG_NAME"),\n`;
        body += `${indent.get()}option_env!("CARGO_PKG_VERSION"),\n`;
        body += `${indent.get()}options.client_options,\n`;
        body += `${indent.get()}Vec::default(),\n`;
        body += `${indent.get()}${authPolicy ? 'vec![auth_policy]' : 'Vec::default()'},\n`;
        body += `${indent.pop().get()}),\n`; // end Pipeline::new
        body += `${indent.pop().get()}})\n`; // end Ok
        body += `${indent.pop().get()}}\n`; // end constructor

        // ensure extra new-line between ctors and/or client methods
        if (i + 1 < client.constructable.constructors.length || client.methods.length > 0) {
          body += '\n';
        }
      }
    }

    // emit the endpoint method before the rest of the methods.
    // we don't model this as the implementation isn't dynamic.
    body += `${indent.get()}/// Returns the Url associated with this client.\n`;
    body += `${indent.get()}pub fn endpoint(&self) -> &Url {\n`;
    body += `${indent.push().get()}&self.${getEndpointFieldName(client)}\n`;
    body += `${indent.pop().get()}}\n\n`;

    for (let i = 0; i < client.methods.length; ++i) {
      const method = client.methods[i];
      const returnType = helpers.getTypeDeclaration(method.returns);
      let async = '';
      // NOTE: when methodBody is called, the starting indentation
      // will be correct for the current scope, so there's no need
      // for the callee to indent right away.
      let methodBody: (indentation: helpers.indentation) => string;
      use.addForType(method.returns);
      switch (method.kind) {
        case 'async':
          async = 'async ';
          methodBody = (indentation: helpers.indentation): string => {
            return getAsyncMethodBody(indentation, use, client, method);
          };
          break;
        case 'pageable':
          methodBody = (indentation: helpers.indentation): string => {
            return getPageableMethodBody(indentation, use, client, method);
          };
          break;
        case 'clientaccessor':
          methodBody = (indentation: helpers.indentation): string => {
            return getClientAccessorMethodBody(indentation, client, method);
          };
          break;
      }
      body += `${indent.get()}${helpers.formatDocComment(method.docs)}`;
      body += `${indent.get()}${helpers.emitPub(method.pub)}${async}fn ${method.name}(${getMethodParamsSig(method, use)}) -> ${returnType} {\n`;
      body += `${indent.push().get()}${methodBody(indent)}\n`;
      body += `${indent.pop().get()}}\n`; // end method
      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    body += '}\n\n'; // end client impl

    // only implement Default when there's more than one field.
    // for the single-case field we just derive Default.
    if (client.constructable && client.constructable.options.type.fields.length > 1) {
      // emit default trait impl for client options type
      const clientOptionsType = client.constructable.options;
      body += `impl Default for ${clientOptionsType.type.name} {\n`;
      body += `${indent.get()}fn default() -> Self {\n`;
      body += `${indent.push().get()}Self {\n`;
      indent.push();
      for (const field of clientOptionsType.type.fields) {
        if (!field.defaultValue) {
          throw new Error(`missing default value for struct field ${clientOptionsType.type.name}.${field.name}`);
        }
        body += `${indent.get()}${field.name}: ${field.defaultValue},\n`;
      }
      body += `${indent.pop().get()}}\n`;
      body += `${indent.pop().get()}}\n`;
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
        body += `${indent.get()}${helpers.emitPub(field.pub)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
      }
      body += '}\n\n'; // end options

      if (method.kind === 'pageable') {
        body += `impl ${helpers.getTypeDeclaration(method.options.type, true)} {\n`;
        body += `${indent.get()}pub fn into_owned(self) -> ${method.options.type.name}<'static> {\n`;
        body += `${indent.push().get()}${method.options.type.name} {\n`;
        indent.push();
        for (const field of method.options.type.fields) {
          if (isClientMethodOptions(field.type)) {
            body += `${indent.get()}${field.name}: ClientMethodOptions {\n`;
            body += `${indent.push().get()}context: self.${field.name}.context.into_owned(),\n`;
            body += `${indent.pop().get()}},\n`;
            continue;
          }
          body += `${indent.get()}${field.name}: self.${field.name},\n`;
        }
        body += `${indent.pop().get()}}\n`;
        body += `${indent.pop().get()}}\n`;
        body += '}\n';
      }

      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    body += '\n';

    let content = helpers.contentPreamble();
    content += use.text();
    content += body;

    const clientMod = codegen.deconstruct(client.name).join('_');
    clientFiles.push({name: `${targetDir}/${clientMod}.rs`, content: content});
    clientMods.push(new rust.Module(clientMod, true));
  }

  return {clients: clientFiles, modules: clientMods};
}

/**
 * creates the parameter signature for a client constructor
 * e.g. "foo: i32, bar: String, options: ClientOptions"
 * 
 * @param params the params to include in the signature. can be empty
 * @param options the client options type. will always be the last parameter
 * @param use the use statement builder currently in scope
 * @returns the client constructor params sig
 */
function getConstructorParamsSig(params: Array<rust.ClientParameter>, options: rust.ClientOptions, use: Use): string {
  const paramsSig = new Array<string>();
  for (const param of params) {
    if (param.optional) {
      // optional params will be in the client options type
      continue;
    }

    use.addForType(param.type);
    let ref = '';
    if (param.kind === 'clientMethod' && param.ref) {
      ref = '&';
    }
    paramsSig.push(`${param.name}: ${ref}${helpers.getTypeDeclaration(param.type)}`);
  }
  paramsSig.push(`options: ${helpers.getTypeDeclaration(options)}`);
  return paramsSig.join(', ');
}

/**
 * creates the parameter signature for a client method
 * e.g. "foo: i32, bar: String, options: MethodOptions"
 * 
 * @param method the Rust method for which to create the param sig
 * @param use the use statement builder currently in scope
 * @returns the method params sig
 */
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

/**
 * returns the auth policy instantiation code if the ctor contains a credential param.
 * the policy will be a local var named auth_policy.
 * 
 * @param ctor the constructor for which to instantiate an auth policy
 * @param use the use statement builder currently in scope
 * @returns the auth policy instantiation code or undefined if not required
 */
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

/**
 * returns the complete text for the provided parameter's type
 * e.g. self, &String, mut SomeStruct
 * 
 * @param param the parameter for which to create the
 * @returns the parameter's type declaration
 */
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
      const field = methodParam.type.type.fields.find(f => { return f.name === methodParam.name; });
      if (!field) {
        throw new Error(`didn't find spread param field ${methodParam.name} in type ${methodParam.type.type.name}`);
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

/**
 * returns the name of the endpoint field within the client
 * 
 * @param client the client in which to find the endpoint field
 * @returns the name of the endpoint field
 */
function getEndpointFieldName(client: rust.Client): string {
  // find the endpoint field. it's the only one that's
  // a Url. the name will be uniform across clients
  let endpointFieldName: string | undefined;
  for (const field of client.fields) {
    if (field.type.kind === 'Url' ) {
      if (endpointFieldName) {
        throw new Error(`found multiple URL fields in client ${client.name} which is unexpected`);
      }
      endpointFieldName = field.name;
    }
  }
  if (!endpointFieldName) {
    throw new Error(`didn't find URI field for client ${client.name}`);
  }
  return endpointFieldName;
}

/**
 * constructs the body for a client accessor method
 * 
 * @param indent the indentation helper currently in scope
 * @param clientAccessor the client accessor for which to construct the body
 * @returns the contents of the method body
 */
function getClientAccessorMethodBody(indent: helpers.indentation, client: rust.Client, clientAccessor: rust.ClientAccessor): string {
  let body = `${clientAccessor.returns.name} {\n`;
  indent.push();
  for (const field of client.fields) {
    body += `${indent.get()}${field.name}: self.${field.name}${nonCopyableType(field.type) ? '.clone()' : ''},\n`;
  }
  body += `${indent.pop().get()}}`;
  return body;
}

type ClientMethod = rust.AsyncMethod | rust.PageableMethod;
type HeaderParamType = rust.HeaderCollectionParameter | rust.HeaderHashMapParameter | rust.HeaderParameter;
type QueryParamType = rust.QueryCollectionParameter | rust.QueryParameter;

/** groups method parameters based on their kind */
interface methodParamGroups {
  /** the body parameter if applicable */
  body?: rust.BodyParameter;

  /** header parameters. can be empty */
  header: Array<HeaderParamType>;

  /** partial body parameters. can be empty */
  partialBody: Array<rust.PartialBodyParameter>;

  /** path parameters. can be empty */
  path: Array<rust.PathParameter>;

  /** query parameters. can be empty */
  query: Array<QueryParamType>;
}

/**
 * enumerates method parameters and returns them based on groups
 * 
 * @param method the method containing the parameters to group
 * @returns the groups parameters
 */
function getMethodParamGroup(method: ClientMethod): methodParamGroups {
  // collect and sort all the header/path/query params
  const headerParams = new Array<HeaderParamType>();
  const pathParams = new Array<rust.PathParameter>();
  const queryParams = new Array<QueryParamType>();
  const partialBodyParams = new Array<rust.PartialBodyParameter>();

  for (const param of method.params) {
    switch (param.kind) {
      case 'header':
      case 'headerCollection':
      case 'headerHashMap':
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

  let bodyParam: rust.BodyParameter | undefined;
  for (const param of method.params) {
    if (param.kind === 'body') {
      if (bodyParam) {
        throw new Error(`method ${method.name} has multiple body parameters`);
      }
      bodyParam = param;
    }
  }

  return {
    body: bodyParam,
    header: headerParams,
    partialBody: partialBodyParams,
    path: pathParams,
    query: queryParams,
  };
}

/**
 * wraps the emitted code emitted by setter in a "let Some" block
 * if the parameter is optional, else the value of setter is returned.
 * 
 * NOTE: for optional params, by convention, we'll create a local named param.name.
 * setter MUST reference by param.name so it works for optional and required params.
 * 
 * @param indent the indentation helper currently in scope
 * @param param the parameter to which the contents of setter apply
 * @param setter the callback that emits the code to read from a param var
 * @returns 
 */
function getParamValueHelper(indent: helpers.indentation, param: rust.MethodParameter, setter: () => string): string {
  if (param.optional) {
    // optional params are in the unwrapped options local var
    const op = indent.get() + helpers.buildIfBlock(indent, {
      condition: `let Some(${param.name}) = options.${param.name}`,
      body: setter,
    });
    return op + '\n';
  }
  return setter();
}

/**
 * emits the code for building the request URL.
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param method the method for which we're building the body
 * @param paramGroups the param groups for the provided method
 * @param urlVarName the name of the var that contains the azure_core::Url. defaults to 'url'
 * @returns the URL construction code
 */
function constructUrl(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: methodParamGroups, urlVarName: string = 'url'): string {
  // for paths that contain query parameters, we must set the query params separately.
  // including them in the call to set_path() causes the chars to be path-escaped.
  const pathChunks = method.httpPath.split('?');
  if (pathChunks.length > 2) {
    throw new Error('too many HTTP path chunks');
  }
  let body = '';

  // if path is just "/" no need to set it again, we're already there
  if (pathChunks[0] !== '/') {
    let path = `"${pathChunks[0]}"`;
    if (paramGroups.path.length === 0) {
      // no path params, just a static path
      body += `${indent.get()}${urlVarName} = ${urlVarName}.join(${path})?;\n`;
    } else if (paramGroups.path.length === 1 && pathChunks[0] === `{${paramGroups.path[0].segment}}`) {
      // for a single path param (i.e. "{foo}") we can directly join the path param's value
      body += `${indent.get()}${urlVarName} = ${urlVarName}.join(&${getHeaderPathQueryParamValue(use, paramGroups.path[0], true)})?;\n`;
    } else {
      // we have path params that need to have their segments replaced with the param values
      body += `${indent.get()}let mut path = String::from(${path});\n`;
      for (const pathParam of paramGroups.path) {
        body += `${indent.get()}path = path.replace("{${pathParam.segment}}", &${getHeaderPathQueryParamValue(use, pathParam, true)});\n`;
      }
      path = '&path';
      body += `${indent.get()}${urlVarName} = ${urlVarName}.join(${path})?;\n`;
    }
  }

  if (pathChunks.length === 2) {
    body += `${indent.get()}${urlVarName}.query_pairs_mut()`;
    // set the query params that were in the path
    const qps = queryString.parse(pathChunks[1]);
    for (const qp of Object.keys(qps)) {
      const val = qps[qp];
      if (val) {
        if (typeof val === 'string') {
          body += `.append_pair("${qp}", "${val}")`;
        } else {
          for (const v of val) {
            body += `.append_pair("${qp}", "${v}")`;
          }
        }
      } else {
        body += `.append_key_only("${qp}")`;
      }
    }
    body += ';\n';
  }

  for (const queryParam of paramGroups.query) {
    if (queryParam.kind === 'queryCollection' && queryParam.format === 'multi') {
      body += getParamValueHelper(indent, queryParam, () => {
        const valueVar = queryParam.name[0];
        let text = `${indent.get()}for ${valueVar} in ${queryParam.name}.iter() {\n`;
        text += `${indent.push().get()}${urlVarName}.query_pairs_mut().append_pair("${queryParam.key}", ${valueVar});\n`;
        text += `${indent.pop().get()}}\n`;
        return text;
      });
    } else {
      body += getParamValueHelper(indent, queryParam, () => {
        let borrow = '&';
        if (queryParam.type.kind === 'enum') {
          // for enums we call .as_ref() which elides the need to borrow
          borrow = '';
        }
        return `${indent.get()}${urlVarName}.query_pairs_mut().append_pair("${queryParam.key}", ${borrow}${getHeaderPathQueryParamValue(use, queryParam, !queryParam.optional)});\n`;
      });
    }
  }

  return body;
}

/**
 * emits the code for building the HTTP request.
 * assumes that there's a local var 'url' which is the Url.
 * creates a mutable local 'request' which is the Request instance.
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param method the method for which we're building the body
 * @param paramGroups the param groups for the provided method
 * @param fromSelf applicable for client params. when true, the prefix "self." is included
 * @returns the request construction code
 */
function constructRequest(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: methodParamGroups, fromSelf = true): string {
  let body = `${indent.get()}let mut request = Request::new(url, Method::${codegen.capitalize(method.httpMethod)});\n`;

  for (const headerParam of paramGroups.header) {
    body += getParamValueHelper(indent, headerParam, () => {
      if (headerParam.kind === 'headerHashMap') {
        let setter = `for (k, v) in &${headerParam.name} {\n`;
        setter += `${indent.push().get()}request.insert_header(format!("${headerParam.header}-{}", k), v);\n`;
        setter += `${indent.pop().get()}}\n`;
        return setter;
      }
      const borrow = headerParam.location === 'client' && nonCopyableType(headerParam.type) ? '&' : '';
      return `${indent.get()}request.insert_header("${headerParam.header.toLowerCase()}", ${borrow}${getHeaderPathQueryParamValue(use, headerParam, fromSelf)});\n`;
    });
  }

  const bodyParam = paramGroups.body;
  if (bodyParam) {
    body += getParamValueHelper(indent, bodyParam, () => {
      return `${indent.get()}request.set_body(${bodyParam.name});\n`;
    });
  } else if (paramGroups.partialBody.length > 0) {
    // all partial body params should point to the same underlying model type.
    const requestContentType = paramGroups.partialBody[0].type;
    use.addForType(requestContentType);
    body += `${indent.get()}let body: ${helpers.getTypeDeclaration(requestContentType)} = ${requestContentType.type.name} {\n`;
    indent.push();
    for (const partialBodyParam of paramGroups.partialBody) {
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
      body += `${indent.get()}${initializer},\n`;
    }
    body += `${indent.pop().get()}}.try_into()?;\n`;
    body += `${indent.get()}request.set_body(body);\n`;
  }

  return body;
}

/**
 * Returns 'mut ' if the Url local var needs to be mutable, else the empty string.
 * @param paramGroups the param groups associated with the Url being constructed.
 * @param method the method associated with the Url being constructed.
 * @returns 'mut ' or the empty string
 */
function urlVarNeedsMut(paramGroups: methodParamGroups, method: ClientMethod): string {
  if (paramGroups.path.length > 0 || paramGroups.query.length > 0 || method.httpPath !== '/') {
    return 'mut ';
  }
  return '';
}

/**
 * constructs the body for an async client method
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param client the client to which the method belongs
 * @param method the method for the body to build
 * @returns the contents of the method body
 */
function getAsyncMethodBody(indent: helpers.indentation, use: Use, client: rust.Client, method: rust.AsyncMethod): string {
  use.addTypes('azure_core', ['Context', 'Method', 'Request']);
  const paramGroups = getMethodParamGroup(method);
  let body = 'let options = options.unwrap_or_default();\n';
  body += `${indent.get()}let ctx = Context::with_context(&options.method_options.context);\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}url = self.${getEndpointFieldName(client)}.clone();\n`;

  body += constructUrl(indent, use, method, paramGroups);
  body += constructRequest(indent, use, method, paramGroups);
  body += `${indent.get()}self.pipeline.send(&ctx, &mut request).await\n`;
  return body;
}

/**
 * constructs the body for a pageable client method
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param client the client to which the method belongs
 * @param method the method for the body to build
 * @returns the contents of the method body
 */
function getPageableMethodBody(indent: helpers.indentation, use: Use, client: rust.Client, method: rust.PageableMethod): string {
  if (!method.strategy) {
    throw new Error('paged method with no strategy NYI');
  } else if (method.strategy.kind !== 'nextLink') {
    throw new Error('paged methods other than nextLink NYI');
  }

  const nextLinkName = method.strategy.nextLinkName;
  use.addTypes('azure_core', ['Method', 'Pager', 'Request', 'Response', 'Result', 'Url']);
  use.addType('typespec_client_core::http', 'PagerResult');
  use.addType('typespec_client_core', 'json');
  use.addForType(method.returns.type.type);

  const paramGroups = getMethodParamGroup(method);
  const urlVar = 'first_url';

  let body = 'let options = options.unwrap_or_default().into_owned();\n';
  body += `${indent.get()}let pipeline = self.pipeline.clone();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVar} = self.${getEndpointFieldName(client)}.clone();\n`;
  body += constructUrl(indent, use, method, paramGroups, urlVar);
  body += `${indent.get()}Ok(Pager::from_callback(move |${nextLinkName}: Option<Url>| {\n`;

  body += `${indent.push().get()}let url = ` + helpers.buildMatch(indent, nextLinkName, [{
    pattern: `Some(${nextLinkName})`,
    body: (indent) => `${indent.get()} ${nextLinkName}\n`
  }, {
    pattern: 'None',
    body: (indent) => `${indent.get()}${urlVar}.clone()\n`
  }]);
  body += ';\n';

  // here we want the T in Pager<T>
  const returnType = helpers.getTypeDeclaration(method.returns.type.type);

  body += constructRequest(indent, use, method, paramGroups, false);
  body += `${indent.get()}let ctx = options.method_options.context.clone();\n`;
  body += `${indent.get()}let pipeline = pipeline.clone();\n`;
  body += `${indent.get()}async move {\n`;
  body += `${indent.push().get()}let rsp: Response<${returnType}> = pipeline.send(&ctx, &mut request).await?;\n`;
  body += `${indent.get()}let (status, headers, body) = rsp.deconstruct();\n`;
  body += `${indent.get()}let bytes = body.collect().await?;\n`;
  body += `${indent.get()}let res: ${returnType} = json::from_json(bytes.clone())?;\n`;
  body += `${indent.get()}let rsp = Response::from_bytes(status, headers, bytes);\n`;

  body += `${indent.get()}Ok(${helpers.buildMatch(indent, `res.${nextLinkName}`, [{
    pattern: `Some(${nextLinkName})`,
    returns: 'PagerResult::Continue',
    body: (indent) => `${indent.get()}response: rsp,\n${indent.get()}continuation: ${nextLinkName}.parse()?,\n`
  }, {
    pattern: 'None',
    returns: 'PagerResult::Complete',
    body: () => `${indent.get()}response: rsp,\n`
  }])}`;
  body += ')\n'; // end Ok
  body += `${indent.pop().get()}}\n`; // end async move
  body += `${indent.pop().get()}}))`; // end Ok/Pager::from_callback

  return body;
}

/**
 * contains the code to use when populating a client endpoint parameter value
 * from a parameter of that type.
 * @param param the param for which to get the value
 * @returns the code to use for the param's value
 */
function getClientEndpointParamValue(param: rust.ClientEndpointParameter): string {
  let paramName = param.name;
  if (param.optional) {
    paramName = 'options.' + paramName;
  }

  switch (param.type.kind) {
    case 'String':
      return `&${paramName}`;
    case 'enum':
      return `${paramName}.as_ref()`;
    case 'offsetDateTime':
    case 'scalar':
      return `&${paramName}.to_string()`;
    default:
      throw new Error(`unhandled ${param.kind} param type kind ${param.type.kind}`);
  }
}

/**
 * contains the code to use when populating a header/path/query value
 * from a parameter of that type.
 * 
 * if the param's type is a String, then the return value is simply the
 * param's name. the non-String cases require some kind of conversion.
 * this could simply be a to_string() call, e.g. "paramName.to_string()".
 * other cases might be more complex.
 * 
 * @param use the use statement builder currently in scope
 * @param param the param for which to get the value
 * @param fromSelf applicable for client params. when true, the prefix "self." is included
 * @returns the code to use for the param's value
 */
function getHeaderPathQueryParamValue(use: Use, param: HeaderParamType | rust.PathParameter | QueryParamType, fromSelf: boolean): string {
  let paramName = param.name;
  // when fromSelf is false we assume that there's a local with the same name.
  // e.g. in pageable methods where we need to clone the params so they can be
  // passed to a future that can outlive the calling method.
  if (param.location === 'client' && fromSelf) {
    paramName = 'self.' + paramName;
  }

  const encodeBytes = function(type: rust.EncodedBytes, param?: string): string {
    use.addType('azure_core', 'base64');
    let encoding: string;
    switch (type.encoding) {
      case 'std':
        encoding = 'base64::encode';
        break;
      case 'url':
        encoding = 'base64::encode_url_safe';
        break;
    }
    if (param) {
      return `${encoding}(${param})`;
    }
    return encoding;
  };

  const encodeDateTime = function(type: rust.OffsetDateTime, param: string): string {
    use.addType('azure_core', 'date');
    switch (type.encoding) {
      case 'rfc3339':
      case 'rfc7231':
        return `date::to_${type.encoding}(&${param})`;
      case 'unix_time':
        return `${param}.unix_timestamp().to_string()`;
    }
  };

  if (param.kind === 'headerCollection' || param.kind === 'queryCollection') {
    if (param.format === 'multi') {
      throw new Error('multi should have been handled outside getHeaderPathQueryParamValue');
    } else if (param.type.type.kind === 'String') {
      return `${paramName}.join("${getCollectionDelimiter(param.format)}")`;
    }

    // convert the items to strings
    let strConv: string;
    switch (param.type.type.kind) {
      case 'encodedBytes':
        strConv = encodeBytes(param.type.type);
        break;
      case 'offsetDateTime':
        strConv = `|i| ${encodeDateTime(param.type.type, 'i')}`;
        break;
      default:
        strConv = '|i| i.to_string()';
    }

    return `${param.name}.iter().map(${strConv}).collect::<Vec<String>>().join("${getCollectionDelimiter(param.format)}")`;
  }

  switch (param.type.kind) {
    case 'String':
      return paramName;
    case 'encodedBytes':
      return encodeBytes(param.type, paramName);
    case 'enum':
    case 'scalar':
      if (param.type.kind === 'enum' && param.kind === 'query') {
        // append_pair wants a reference to the string
        // TODO: https://github.com/Azure/typespec-rust/issues/25
        return `${paramName}.as_ref()`;
      }
      return `${paramName}.to_string()`;
    case 'implTrait':
      return `${paramName}.into()`;
    case 'literal':
      return `"${param.type.value}"`;
    case 'offsetDateTime':
      return encodeDateTime(param.type, param.name);
    default:
      throw new Error(`unhandled ${param.kind} param type kind ${param.type.kind}`);
  }
}

/**
 * returns the delimiter character for the provided format type
 * 
 * @param format the format collection type
 * @returns the delimiter character
 */
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
  }
}

/** returns true if the type isn't copyable thus nees to be cloned */
function nonCopyableType(type: rust.Type): boolean {
  const unwrappedType = helpers.unwrapOption(type);
  switch (unwrappedType.kind) {
    case 'String':
    case 'Url':
    case 'external':
    case 'hashmap':
    case 'vector':
      return true;
    default:
      return false;
  }
}

/** returns true if the type is the azure_core::ClientMethodOptions type */
function isClientMethodOptions(type: rust.Type): boolean {
  return type.kind === 'external' && type.name === 'ClientMethodOptions';
}

/** returns true if the type is a credential */
function isCredential(type: rust.Type): boolean {
  const unwrappedType = helpers.unwrapType(type);
  return unwrappedType.kind === 'tokenCredential';
}
