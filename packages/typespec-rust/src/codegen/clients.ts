/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore conv

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import { CodegenError } from './errors.js';
import * as helpers from './helpers.js';
import queryString from 'query-string';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';
import * as shared from '../shared/shared.js';

/** the client modules */
export interface ClientModules {
  /** the list of client modules */
  modules: Array<helpers.Module>;

  /** the client method options module */
  options: helpers.Module;
}

/**
 * emits the content for all client files
 * 
 * @param crate the crate for which to emit clients
 * @returns client content or undefined if the crate contains no clients
 */
export function emitClients(crate: rust.Crate): ClientModules | undefined {
  if (crate.clients.length === 0) {
    return undefined;
  }

  // returns true if the client options type needs to explicitly implement Default
  const clientOptionsImplDefault = function (constructable: rust.ClientConstruction): boolean {
    // only implement Default when there's more than one field (i.e. more than just client_options)
    // and the field(s) contain a client default value.
    return constructable.options.type.fields.length > 1 && values(constructable.options.type.fields)
      .where((field) => field.name !== 'client_options')
      .where((field) => field.defaultValue !== undefined).any();
  };

  const clientModules = new Array<helpers.Module>();

  // emit the clients, one file per client
  for (const client of crate.clients) {
    const use = new Use('clients');
    const indent = new helpers.indentation();

    let body = helpers.formatDocComment(client.docs);
    use.add('azure_core', 'tracing');
    body += '#[tracing::client]\n';
    body += `pub struct ${client.name} {\n`;
    for (const field of client.fields) {
      use.addForType(field.type);
      body += `${indent.get()}${helpers.emitVisibility(field.visibility)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
    }
    body += '}\n\n'; // end client

    if (client.constructable) {
      // if client options doesn't require an impl for Default then just derive it
      let deriveDefault = 'Default, ';
      if (clientOptionsImplDefault(client.constructable)) {
        deriveDefault = '';
      }
      body += helpers.formatDocComment(client.constructable.options.type.docs);
      use.add('azure_core::fmt', 'SafeDebug');
      body += `#[derive(Clone, ${deriveDefault}SafeDebug)]\n`;
      body += `pub struct ${client.constructable.options.type.name}`;
      if (client.constructable.options.type.fields.length > 0) {
        body += ' {\n';
        for (const field of client.constructable.options.type.fields) {
          use.addForType(field.type);
          body += helpers.formatDocComment(field.docs);
          body += `${indent.get()}${helpers.emitVisibility(field.visibility)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
        }
        body += '}\n\n'; // end client options
      } else {
        body += ';\n\n';
      }
    }

    body += `impl ${client.name} {\n`;

    if (client.constructable) {
      // this is an instantiable client, so we need to emit client options and constructors
      use.add('azure_core', 'Result');

      for (let i = 0; i < client.constructable.constructors.length; ++i) {
        const constructor = client.constructable.constructors[i];
        body += `${indent.get()}${helpers.formatDocComment(constructor.docs)}`;
        const paramsDocs = getParamsBlockDocComment(indent, constructor);
        if (paramsDocs) {
          body += paramsDocs;
        }
        body += `${indent.get()}#[tracing::new("${crate.name}")]\n`;
        body += `${indent.get()}pub fn ${constructor.name}(${getConstructorParamsSig(constructor.params, client.constructable.options, use)}) -> Result<Self> {\n`;
        body += `${indent.get()}let options = options.unwrap_or_default();\n`;
        // by convention, the endpoint param is always the first ctor param
        const endpointParamName = constructor.params[0].name;
        body += `${indent.push().get()}let mut ${endpointParamName} = Url::parse(${endpointParamName})?;\n`;
        body += `${indent.get()}${helpers.buildIfBlock(indent, {
          condition: `!${endpointParamName}.scheme().starts_with("http")`,
          body: (indent) => `${indent.get()}return Err(azure_core::Error::message(azure_core::error::ErrorKind::Other, format!("{${endpointParamName}} must use http(s)")));\n`,
        })}`
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
        const sortedParams = values([...constructor.params]
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
            throw new CodegenError('InternalError', `didn't find field in client ${client.name} for param ${param.name}`);
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
            throw new CodegenError('InternalError', `didn't find field in client ${client.name} for param ${param.name}`);
          }

          if (!client.constructable.options.type.fields.find((v: rust.StructField) => { return v.name === param.name; })) {
            throw new CodegenError('InternalError', `didn't find field in client options ${client.constructable.options.type.name} for optional param ${param.name}`);
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
      let isPublicApi = false;
      let isSubclientNew = false;
      switch (method.kind) {
        case 'async':
          isPublicApi = true;
          async = 'async ';
          methodBody = (indentation: helpers.indentation): string => {
            return getAsyncMethodBody(indentation, use, client, method);
          };
          break;
        case 'pageable':
          isPublicApi = true;
          methodBody = (indentation: helpers.indentation): string => {
            return getPageableMethodBody(indentation, use, client, method);
          };
          break;
        case 'lro_begin':
          isPublicApi = true;
          methodBody = (indentation: helpers.indentation): string => {
            return getLroBeginMethodBody(indentation, use, client, method);
          };
          break;
        case 'lro_resume':
          isPublicApi = true;
          methodBody = (indentation: helpers.indentation): string => {
            return getLroResumeMethodBody(indentation, use, client, method);
          };
          break;
        case 'clientaccessor':
          isSubclientNew = true;
          methodBody = (indentation: helpers.indentation): string => {
            return getClientAccessorMethodBody(indentation, client, method);
          };
          break;
      }
      body += `${indent.get()}${helpers.formatDocComment(method.docs)}`;
      const paramsDocs = getParamsBlockDocComment(indent, method);
      if (paramsDocs) {
        body += paramsDocs;
      }
      if (isPublicApi) {
        if (method.kind === 'lro_resume') {
          body += `${indent.get()}#[tracing::function("${client.name.replace("Client", "")}.${method.returns.type.type.content.name}.resume")]\n`;
        } else {
          body += `${indent.get()}#[tracing::function("${method.languageIndependentName}")]\n`;
        }
      } else if (isSubclientNew) {
        body += `${indent.get()}#[tracing::subclient]\n`;
      }
      body += `${indent.get()}${helpers.emitVisibility(method.visibility)}${async}fn ${method.name}(${getMethodParamsSig(method, use)}) -> ${returnType} {\n`;
      body += `${indent.push().get()}${methodBody(indent)}\n`;
      body += `${indent.pop().get()}}\n`; // end method
      if (i + 1 < client.methods.length) {
        body += '\n';
      }
    }

    body += '}\n\n'; // end client impl

    // only implement Default when there's more than one field.
    // for the single-case field we just derive Default.
    if (client.constructable && clientOptionsImplDefault(client.constructable)) {
      // emit default trait impl for client options type
      const clientOptionsType = client.constructable.options;
      body += `impl Default for ${clientOptionsType.type.name} {\n`;
      body += `${indent.get()}fn default() -> Self {\n`;
      body += `${indent.push().get()}Self {\n`;
      indent.push();
      for (const field of clientOptionsType.type.fields) {
        if (field.defaultValue) {
          body += `${indent.get()}${field.name}: ${field.defaultValue},\n`;
        } else {
          body += `${indent.get()}${field.name}: ${helpers.getTypeDeclaration(field.type)}::default(),\n`;
        }
      }
      body += `${indent.pop().get()}}\n`;
      body += `${indent.pop().get()}}\n`;
      body += '}\n\n'; // end impl
    }

    body += '\n';

    // add using for method_options as required
    for (const method of client.methods) {
      if (method.kind !== 'clientaccessor') {
        use.add('crate::generated::models', method.options.type.name);
      }
    }

    let content = helpers.contentPreamble();
    content += use.text();
    content += body;

    const clientMod = codegen.deconstruct(client.name).join('_');
    clientModules.push({ name: clientMod, content: content });
  }

  return {
    modules: clientModules,
    options: getMethodOptions(crate),
  };
}

function getMethodOptions(crate: rust.Crate): helpers.Module {
  const use = new Use('modelsOther');
  const indent = new helpers.indentation();

  let body = '';
  for (const client of crate.clients) {
    for (let i = 0; i < client.methods.length; ++i) {
      const method = client.methods[i];
      if (method.kind === 'clientaccessor') {
        continue;
      }

      body += helpers.formatDocComment(method.options.type.docs);
      use.add('azure_core::fmt', 'SafeDebug');
      body += '#[derive(Clone, Default, SafeDebug)]\n';
      body += `${helpers.emitVisibility(method.visibility)}struct ${helpers.getTypeDeclaration(method.options.type)} {\n`;
      for (let i = 0; i < method.options.type.fields.length; ++i) {
        const field = method.options.type.fields[i];
        use.addForType(field.type);
        const fieldDocs = helpers.formatDocComment(field.docs);
        if (fieldDocs.length > 0) {
          body += `${indent.get()}${fieldDocs}`;
        }
        body += `${indent.get()}${helpers.emitVisibility(method.visibility)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n`;
        if (i + 1 < method.options.type.fields.length) {
          body += '\n';
        }
      }
      body += '}\n\n'; // end options

      if (method.kind === 'pageable' || method.kind === 'lro_begin' || method.kind === 'lro_resume') {
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
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'method_options',
    content: content,
  };
}

/**
 * builds the block of doc comments for a callable's parameters.
 * if the callable has no parameters, undefined is returned.
 * 
 * @param indent the indentation helper currently in scope
 * @param callable the callable containing parameters to document
 * @returns the parameters doc comments or undefined
 */
function getParamsBlockDocComment(indent: helpers.indentation, callable: rust.Constructor | rust.MethodType): string | undefined {
  const formatParamBullet = function (paramName: string): string {
    return `* \`${paramName}\` - `;
  };

  let paramsContent = '';
  for (const param of callable.params) {
    let optional = false;
    if ('optional' in param) {
      optional = param.optional;
    }

    let location: rust.ParameterLocation = 'method';
    if ('location' in param) {
      location = param.location;
    }

    if (optional || param.type.kind === 'enumValue' || param.type.kind === 'literal' || location === 'client') {
      // none of these are in the method sig so skip them
      continue;
    }

    paramsContent += helpers.formatDocComment(param.docs, false, formatParamBullet(param.name), indent);
  }

  if (callable.kind === 'constructor') {
    paramsContent += helpers.formatDocComment({ summary: 'Optional configuration for the client.' }, false, formatParamBullet('options'), indent);
  } else if (callable.kind !== 'clientaccessor') {
    paramsContent += helpers.formatDocComment({ summary: 'Optional parameters for the request.' }, false, formatParamBullet('options'), indent);
  }

  if (paramsContent.length === 0) {
    return undefined;
  }

  let paramsBlock = `${indent.get()}///\n`;
  paramsBlock += `${indent.get()}/// # Arguments\n`;
  paramsBlock += `${indent.get()}///\n`;
  paramsBlock += paramsContent;

  return paramsBlock;
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
    paramsSig.push(`${param.name}: ${helpers.getTypeDeclaration(param.type)}`);
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

  if (method.kind === 'clientaccessor') {
    // client accessor params don't have a concept
    // of optionality nor do they contain literals
    for (const param of method.params) {
      use.addForType(param.type);
      paramsSig.push(`${param.name}: ${formatParamTypeName(param)}`);
    }
  } else {
    for (const param of method.params) {
      const paramType = helpers.unwrapType(param.type);
      if (paramType.kind === 'literal') {
        // literal params are embedded directly in the code (e.g. accept header param)
        continue;
      } else if (paramType.kind === 'enumValue') {
        // enum values are treated like literals, we just need to use their type
        use.addForType(paramType.type);
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
  for (const param of ctor.params) {
    const arcTokenCred = shared.asTypeOf<rust.TokenCredential>(param.type, 'tokenCredential', 'arc');
    if (arcTokenCred) {
      use.add('azure_core::http::policies', 'BearerTokenCredentialPolicy', 'Policy');
      const scopes = new Array<string>();
      for (const scope of arcTokenCred.scopes) {
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
function formatParamTypeName(param: rust.MethodParameter | rust.Parameter | rust.Self): string {
  let format = '';
  if ((<rust.Self>param).ref === true) {
    format = '&';
  }
  if (param.mut) {
    format += 'mut ';
  }
  if ((<rust.MethodParameter>param).kind) {
    const methodParam = <rust.MethodParameter>param;
    const paramType = methodParam.kind === 'partialBody' ? methodParam.paramType : methodParam.type;
    format += helpers.getTypeDeclaration(paramType);
  } else if ((<rust.Parameter>param).type) {
    const methodParam = <rust.Parameter>param;
    format += helpers.getTypeDeclaration(methodParam.type);
  } else {
    // the rust.Self case
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
    if (field.type.kind === 'Url') {
      if (endpointFieldName) {
        throw new CodegenError('InternalError', `found multiple URL fields in client ${client.name} which is unexpected`);
      }
      endpointFieldName = field.name;
    }
  }
  if (!endpointFieldName) {
    throw new CodegenError('InternalError', `didn't find URI field for client ${client.name}`);
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
  const initFields = new Array<string>();
  for (const param of clientAccessor.params) {
    // by convention, the client accessor params have the
    // same name as their corresponding client fields. so
    // we can use short-hand initialization notation
    initFields.push(param.name);
  }

  // accessor params and client fields are mutually exclusive
  // so we don't need to worry about potentials for duplication.
  for (const field of client.fields) {
    // it's possible for child clients to not contain all fields of the parent
    if (clientAccessor.returns.fields.find((e) => e.name === field.name)) {
      initFields.push(`${field.name}: self.${field.name}${nonCopyableType(field.type) ? '.clone()' : ''}`);
    }
  }

  // sort the fields as the fields in the client are also sorted
  initFields.sort();
  indent.push();
  for (const initField of initFields) {
    body += `${indent.get()}${initField},\n`;
  }
  body += `${indent.pop().get()}}`;
  return body;
}

type ClientMethod = rust.AsyncMethod | rust.PageableMethod | rust.LroBeginMethod | rust.LroResumeMethod;
type HeaderParamType = rust.HeaderCollectionParameter | rust.HeaderHashMapParameter | rust.HeaderScalarParameter;
type PathParamType = rust.PathCollectionParameter | rust.PathHashMapParameter | rust.PathScalarParameter;
type QueryParamType = rust.QueryCollectionParameter | rust.QueryHashMapParameter | rust.QueryScalarParameter;
type ApiVersionParamType = rust.HeaderScalarParameter | rust.QueryScalarParameter;

/** groups method parameters based on their kind */
interface MethodParamGroups {
  /** the api version parameter if applicable */
  apiVersion?: ApiVersionParamType;

  /** the body parameter if applicable */
  body?: rust.BodyParameter;

  /** header parameters. can be empty */
  header: Array<HeaderParamType>;

  /** partial body parameters. can be empty */
  partialBody: Array<rust.PartialBodyParameter>;

  /** path parameters. can be empty */
  path: Array<PathParamType>;

  /** query parameters. can be empty */
  query: Array<QueryParamType>;
}

/**
 * enumerates method parameters and returns them based on groups
 * 
 * @param method the method containing the parameters to group
 * @returns the groups parameters
 */
function getMethodParamGroup(method: ClientMethod): MethodParamGroups {
  // collect and sort all the header/path/query params
  let apiVersionParam: ApiVersionParamType | undefined;
  const headerParams = new Array<HeaderParamType>();
  const pathParams = new Array<PathParamType>();
  const queryParams = new Array<QueryParamType>();
  const partialBodyParams = new Array<rust.PartialBodyParameter>();

  for (const param of method.params) {
    switch (param.kind) {
      case 'headerScalar':
      case 'headerCollection':
      case 'headerHashMap':
        headerParams.push(param);
        break;
      case 'partialBody':
        partialBodyParams.push(param);
        break;
      case 'pathScalar':
      case 'pathCollection':
      case 'pathHashMap':
        pathParams.push(param);
        break;
      case 'queryScalar':
      case 'queryCollection':
      case 'queryHashMap':
        queryParams.push(param);
        break;
    }
    if ((param.kind === 'headerScalar' || param.kind === 'queryScalar') && param.isApiVersion) {
      apiVersionParam = param;
    }
  }

  headerParams.sort((a: HeaderParamType, b: HeaderParamType) => { return helpers.sortAscending(a.header, b.header); });
  pathParams.sort((a: PathParamType, b: PathParamType) => { return helpers.sortAscending(a.segment, b.segment); });
  queryParams.sort((a: QueryParamType, b: QueryParamType) => { return helpers.sortAscending(a.key, b.key); });

  let bodyParam: rust.BodyParameter | undefined;
  for (const param of method.params) {
    if (param.kind === 'body') {
      if (bodyParam) {
        throw new CodegenError('InternalError', `method ${method.name} has multiple body parameters`);
      }
      bodyParam = param;
    }
  }

  return {
    apiVersion: apiVersionParam,
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
 * @param inClosure indicates if the value is being read from within a closure (e.g. pageable methods)
 * @returns 
 */
function getParamValueHelper(indent: helpers.indentation, param: rust.MethodParameter, inClosure: boolean, setter: () => string): string {
  if (param.optional && param.type.kind !== 'literal') {
    // optional params are in the unwrapped options local var
    const op = indent.get() + helpers.buildIfBlock(indent, {
      condition: `let Some(${param.name}) = ${inClosure ? '&' : ''}options.${param.name}`,
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
function constructUrl(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: MethodParamGroups, urlVarName: string = 'url'): string {
  // for paths that contain query parameters, we must set the query params separately.
  // including them in the call to set_path() causes the chars to be path-escaped.
  const pathChunks = method.httpPath.split('?');
  if (pathChunks.length > 2) {
    throw new CodegenError('InternalError', 'too many HTTP path chunks');
  }

  /** returns & if the param needs to be borrowed (which is the majority of cases), else the empty string */
  const borrowOrNot = function (param: rust.Parameter): string {
    // for string-based enums we call .as_ref() which elides the need to borrow.
    // for numeric-based enums the borrow will be necessary.
    // TODO: https://github.com/Azure/typespec-rust/issues/25
    if (param.type.kind !== 'enum' && (param.type.kind !== 'ref' || param.type.type.kind === 'encodedBytes' || param.type.type.kind === 'slice')) {
      return '&';
    }
    return '';
  };

  let body = '';

  // if path is just "/" no need to set it again, we're already there
  if (pathChunks[0] !== '/') {
    let path = `"${pathChunks[0]}"`;
    if (paramGroups.path.length === 0) {
      // no path params, just a static path
      body += `${indent.get()}${urlVarName} = ${urlVarName}.join(${path})?;\n`;
    } else if (paramGroups.path.length === 1 && pathChunks[0] === `{${paramGroups.path[0].segment}}`) {
      // for a single path param (i.e. "{foo}") we can directly join the path param's value
      const pathParam = paramGroups.path[0];
      body += `${indent.get()}${urlVarName} = ${urlVarName}.join(${borrowOrNot(pathParam)}${getHeaderPathQueryParamValue(use, pathParam, true)})?;\n`;
    } else {
      // we have path params that need to have their segments replaced with the param values
      body += `${indent.get()}let mut path = String::from(${path});\n`;

      for (const pathParam of paramGroups.path) {
        let wrapSortedVec: (s: string) => string = (s) => s;
        let paramExpression = getHeaderPathQueryParamValue(use, pathParam, true);
        if (pathParam.kind === 'pathHashMap') {
          wrapSortedVec = (s) => `${indent.get()}{`
            + `${indent.push().get()}let mut ${pathParam.name}_vec = ${pathParam.name}.iter().collect::<Vec<_>>();\n`
            + `${indent.get()}${pathParam.name}_vec.sort_by_key(|p| p.0);\n`
            + `${s}`
            + `${indent.pop().get()}}`;

          const kEqualsV = '"{k}={v}"';
          const kCommaV = '"{k},{v}"';

          paramExpression = `&${pathParam.name}_vec.iter().map(|(k,v)| `
            + (pathParam.explode
              ? `format!(${kEqualsV})).collect::<Vec<_>>().join(",")`
              : `format!(${kCommaV})).collect::<Vec<_>>().join(",")`);

          switch (pathParam.style) {
            case 'path':
              paramExpression = `&format!("/{}", ${pathParam.name}_vec.iter().map(|(k,v)| `
                + (pathParam.explode
                  ? `format!(${kEqualsV})).collect::<Vec<_>>().join("/"))`
                  : `format!(${kCommaV})).collect::<Vec<_>>().join(","))`);
              break;
            case 'label':
              paramExpression = `&format!(".{}", ${pathParam.name}_vec.iter().map(|(k,v)| `
                + (pathParam.explode
                  ? `format!(${kEqualsV})).collect::<Vec<_>>().join("."))`
                  : `format!(${kCommaV})).collect::<Vec<_>>().join(","))`);
              break;
            case 'matrix':
              paramExpression = pathParam.explode
                ? (`&format!(";{}", ${pathParam.name}_vec.into_iter().map(|(k,v)| `
                  + `format!(${kEqualsV})).collect::<Vec<_>>().join(";"))`)
                : (`&format!(";${pathParam.name}={}", ${pathParam.name}_vec.into_iter().map(|(k,v)| `
                  + `format!(${kCommaV})).collect::<Vec<_>>().join(","))`);
              break;
          }
        } else if (pathParam.kind === 'pathCollection') {
          paramExpression = `&${pathParam.name}.join(",")`;
          switch (pathParam.style) {
            case 'path':
              paramExpression = `&format!("/{}", ${pathParam.name}.join("${pathParam.explode ? '/' : ','}"))`;
              break;
            case 'label':
              paramExpression = `&format!(".{}", ${pathParam.name}.join("${pathParam.explode ? '.' : ','}"))`;
              break;
            case 'matrix':
              paramExpression = `&format!(";${pathParam.name}={}", ${pathParam.name}.join(`
                + `"${pathParam.explode ? `;${pathParam.name}=` : ','}"))`;
              break;
          }
        } else {
          switch (pathParam.style) {
            case 'path':
              paramExpression = `&format!("/{${paramExpression}}")`;
              break;
            case 'label':
              paramExpression = `&format!(".{${paramExpression}}")`;
              break;
            case 'matrix':
              paramExpression = `&format!(";${pathParam.name}={${paramExpression}}")`;
              break;
            default:
              paramExpression = `${borrowOrNot(pathParam)}${paramExpression}`;
          }
        }

        if (pathParam.optional) {
          body += `${indent.get()}path = ${helpers.buildMatch(indent, `options.${pathParam.name}`, [{
            pattern: `Some(${pathParam.name})`,
            body: (indent) => wrapSortedVec(`${indent.get()}path.replace("{${pathParam.segment}}", ${paramExpression})\n`),
          }, {
            pattern: `None`,
            body: (indent) => `${indent.get()}path.replace("{${pathParam.segment}}", "")\n`,
          }])};\n`;
        } else {
          body += wrapSortedVec(`${indent.get()}path = path.replace("{${pathParam.segment}}", ${paramExpression});\n`);
        }
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
      body += getParamValueHelper(indent, queryParam, false, () => {
        const valueVar = queryParam.name[0];
        let text = `${indent.get()}for ${valueVar} in ${queryParam.name}.iter() {\n`;
        text += `${indent.push().get()}${urlVarName}.query_pairs_mut().append_pair("${queryParam.key}", ${valueVar});\n`;
        text += `${indent.pop().get()}}\n`;
        return text;
      });
    } else if (queryParam.kind === 'queryHashMap') {
      body += getParamValueHelper(indent, queryParam, false, () => {
        let text = `${indent.get()}{\n`;
        text += `${indent.push().get()}let mut ${queryParam.name}_vec = ${queryParam.name}.iter().collect::<Vec<_>>();\n`;
        text += `${indent.get()}${queryParam.name}_vec.sort_by_key(|p| p.0);\n`;
        if (queryParam.explode) {
          text += `${indent.get()}for (k, v) in ${queryParam.name}_vec.iter() {\n`;
          text += `${indent.push().get()}${urlVarName}.query_pairs_mut().append_pair(k, &v.to_string());\n`;
          text += `${indent.pop().get()}}\n`;
        } else {
          text += `${indent.get()}${urlVarName}.query_pairs_mut().append_pair("${queryParam.key}", ${queryParam.name}_vec.iter().map(|(k, v)| format!("{k},{v}")).collect::<Vec<String>>().join(",").as_str());\n`;
        }
        text += `${indent.pop().get()}}\n`;
        return text;
      });
    } else {
      body += getParamValueHelper(indent, queryParam, false, () => {
        // for enums we call .as_ref() which elides the need to borrow
        const borrow = queryParam.type.kind === 'enum' ? '' : borrowOrNot(queryParam);
        return `${indent.get()}${urlVarName}.query_pairs_mut().append_pair("${queryParam.key}", ${borrow}${getHeaderPathQueryParamValue(use, queryParam, !queryParam.optional)});\n`;
      });
    }
  }

  return body;
}

/**
 * emits the code for setting HTTP headres in a request.
 *
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param method the method for which we're building the body
 * @param paramGroups the param groups for the provided method
 * @param inClosure indicates if the request is being constructed within a closure (e.g. pageable methods)
 * @returns the code which sets HTTP headers for the request
 */
 function applyHeaderParams(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: MethodParamGroups, inClosure: boolean): string {

  let body = '';

  for (const headerParam of paramGroups.header) {
    if (method.kind === 'pageable' && method.strategy?.kind === 'continuationToken' && method.strategy?.requestToken.kind === 'headerScalar' && method.strategy?.requestToken === headerParam) {
      // we have some special handling for the header continuation token.
      // if we have a token value, i.e. from the next page, then use that value.
      // if not, then check if an optional token value was provided.
      body += indent.get() + helpers.buildIfBlock(indent, {
        condition: `let Some(${headerParam.name}) = ${headerParam.name}.or_else(|| options.${headerParam.name}.clone())`,
        body: (indent) => `${indent.get()}request.insert_header("${headerParam.header}", ${headerParam.name});\n`,
      })
      continue;
    }

    body += getParamValueHelper(indent, headerParam, inClosure, () => {
      if (headerParam.kind === 'headerHashMap') {
        let setter = `for (k, v) in &${headerParam.name} {\n`;
        setter += `${indent.push().get()}request.insert_header(format!("${headerParam.header}-{k}"), v);\n`;
        setter += `${indent.pop().get()}}\n`;
        return setter;
      }
      // for non-copyable params (e.g. String), we need to borrow them if they're on the
      // client or we're in a closure and the param is required (header params are always owned)
      const borrow = nonCopyableType(headerParam.type) && (headerParam.location === 'client' || (inClosure && !headerParam.optional)) ? '&' : '';
      return `${indent.get()}request.insert_header("${headerParam.header.toLowerCase()}", ${borrow}${getHeaderPathQueryParamValue(use, headerParam, !inClosure)});\n`;
    });
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
 * @param inClosure indicates if the request is being constructed within a closure (e.g. pageable methods)
 * @param cloneUrl indicates if url should be cloned wneh it is passed to initialize request
 * @param forceMut indicates whether request should get declared as 'mut' regardless of whether there are any headers to set
 * @returns the request construction code
 */
function constructRequest(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: MethodParamGroups, inClosure: boolean, cloneUrl: boolean = false, forceMut: boolean = true): string {
  let body = `${indent.get()}let ${(forceMut || paramGroups.header.length > 0) ? 'mut ' : ''}request = Request::new(url${cloneUrl ? '.clone()' : ''}, Method::${codegen.capitalize(method.httpMethod)});\n`;

  body += applyHeaderParams(indent, use, method, paramGroups, inClosure);

  let optionalContentTypeParam: rust.HeaderScalarParameter | undefined;
  for (const headerParam of paramGroups.header) {
    // if the content-type header is optional, we need to emit it inside the "if let Some(body)" clause below.
    if (headerParam.kind === 'headerScalar' && headerParam.optional && headerParam.header.toLowerCase() === 'content-type') {
      optionalContentTypeParam = headerParam;
    }
  }

  const bodyParam = paramGroups.body;
  if (bodyParam) {
    body += getParamValueHelper(indent, bodyParam, inClosure, () => {
      let bodyParamContent = '';
      if (optionalContentTypeParam) {
        bodyParamContent = `${indent.get()}request.insert_header("${optionalContentTypeParam.header.toLowerCase()}", ${getHeaderPathQueryParamValue(use, optionalContentTypeParam, !inClosure)});\n`;
      }
      bodyParamContent += `${indent.get()}request.set_body(${bodyParam.name}${inClosure ? '.clone()' : ''});\n`;
      return bodyParamContent;
    });
  } else if (paramGroups.partialBody.length > 0) {
    // all partial body params should point to the same underlying model type.
    const requestContentType = paramGroups.partialBody[0].type;
    use.addForType(requestContentType);
    body += `${indent.get()}let body: ${helpers.getTypeDeclaration(requestContentType)} = ${requestContentType.content.type.name} {\n`;
    indent.push();
    for (const partialBodyParam of paramGroups.partialBody) {
      if (partialBodyParam.type.content.type !== requestContentType.content.type) {
        throw new CodegenError('InternalError', `spread param ${partialBodyParam.name} has conflicting model type ${partialBodyParam.type.content.type.name}, expected model type ${requestContentType.content.type.name}`);
      }

      if (partialBodyParam.optional) {
        body += `${indent.get()}${partialBodyParam.name}: options.${partialBodyParam.name},\n`;
        continue;
      }

      let initializer = partialBodyParam.name;
      if (requestContentType.content.type.visibility === 'pub') {
        // spread param maps to a non-internal model, so it must be wrapped in Some()
        initializer = `Some(${initializer})`;
      }

      // can't use shorthand init if it's more than just the param name
      if (initializer !== partialBodyParam.name) {
        initializer = `${partialBodyParam.name}: ${initializer}`;
      }

      body += `${indent.get()}${initializer},\n`;
    }
    body += `${indent.pop().get()}}.try_into()?;\n`;
    body += `${indent.get()}request.set_body(body);\n`;
  }

  return body;
}

/**
 * Return an error if a local RawResponse variable "rsp" has a non-success status code.
 * @param use the use statement builder currently in scope
 * @param indent the indentation helper currently in scope
 * @returns code to return an error if the status code of "rsp" doesn't indicate success
 */
function errIfNotSuccessResponse(use: Use, indent: helpers.indentation): string {
  use.add('azure_core', 'Error', 'Result');
  use.add('azure_core::error', 'ErrorKind', 'HttpError');
  return helpers.buildIfBlock(indent, {
    condition: '!rsp.status().is_success()',
    body: (indent) => {
      let body = `${indent.get()}let status = rsp.status();\n`
      body += `${indent.get()}let http_error = HttpError::new(rsp).await;\n`;
      body += `${indent.get()}let error_kind = ErrorKind::http_response(status, http_error.error_code().map(std::borrow::ToOwned::to_owned));\n`;
      body += `${indent.get()}return Err(Error::new(error_kind, http_error));\n`;
      return body;
    },
  });
}

/**
 * Returns 'mut ' if the Url local var needs to be mutable, else the empty string.
 * @param paramGroups the param groups associated with the Url being constructed.
 * @param method the method associated with the Url being constructed.
 * @returns 'mut ' or the empty string
 */
function urlVarNeedsMut(paramGroups: MethodParamGroups, method: ClientMethod): string {
  if (paramGroups.path.length > 0 || paramGroups.query.length > 0 || method.httpPath !== '/') {
    return 'mut ';
  }
  return '';
}

/**
 * emits "if path_param is empty then error" checks for string method path parameters
 * 
 * @param indent the indentation helper currently in scope
 * @param params the path params to enumerate, can be empty
 * @returns the empty path param checks or the empty string if there are no checks
 */
function checkEmptyRequiredPathParams(indent: helpers.indentation, params: Array<PathParamType>): string {
  let checks = '';
  for (const param of params) {
    if (param.optional || param.location === 'client') {
      continue;
    }
    checks += emitEmptyPathParamCheck(indent, param);
  }
  return checks;
}

/**
 * emits the "if path_param is empty then error" check.
 * this is only applicable when the path param's type can
 * be empty (e.g. a string). for types that can't be empty
 * the empty string is returned.
 * 
 * @param indent the indentation helper currently in scope
 * @param param the path param for which to emit the check
 * @returns the check or the empty string
 */
function emitEmptyPathParamCheck(indent: helpers.indentation, param: PathParamType): string {
  let toString = '';
  const paramType = param.type.kind === 'ref' ? param.type.type : param.type;
  switch (paramType.kind) {
    case 'String':
    case 'str':
      // need to check these for zero length
      break;
    case 'enum':
      if (!paramType.extensible) {
        // fixed enums will always have a value
        return '';
      }
      // need to get the underlying string value
      toString = '.as_ref()';
      break;
    default:
      // no length to check so bail
      return '';
  }
  return helpers.buildIfBlock(indent, {
    condition: `${param.name}${toString}.is_empty()`,
    body: (indent) => `${indent.get()}return Err(azure_core::Error::message(azure_core::error::ErrorKind::Other, "parameter ${param.name} cannot be empty"));`,
  });
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
  use.add('azure_core::http', 'Method', 'Request');

  const paramGroups = getMethodParamGroup(method);
  let body = checkEmptyRequiredPathParams(indent, paramGroups.path);
  body += 'let options = options.unwrap_or_default();\n';
  body += `${indent.get()}let ctx = options.method_options.context.to_borrowed();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}url = self.${getEndpointFieldName(client)}.clone();\n`;

  body += constructUrl(indent, use, method, paramGroups);
  body += constructRequest(indent, use, method, paramGroups, false);
  body += `${indent.get()}let rsp = self.pipeline.send(&ctx, &mut request).await?;\n`;
  body += errIfNotSuccessResponse(use, indent);
  let rspInto = 'rsp.into()';
  if (method.returns.type.kind === 'rawResponse') {
    rspInto = 'rsp';
  }
  body += `${indent.get()}Ok(${rspInto})\n`;
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
    throw new CodegenError('InternalError', 'paged method with no strategy NYI');
  }

  const bodyFormat = helpers.convertResponseFormat(method.returns.type.type.format);

  use.add('azure_core::http', 'Method', 'PagerResult', 'PagerState', 'Request', 'Url');
  use.add('azure_core', bodyFormat, 'Result');
  use.addForType(method.returns.type);
  use.addForType(helpers.unwrapType(method.returns.type));

  const paramGroups = getMethodParamGroup(method);
  const urlVar = 'first_url';

  let body = checkEmptyRequiredPathParams(indent, paramGroups.path);
  body += 'let options = options.unwrap_or_default().into_owned();\n';
  body += `${indent.get()}let pipeline = self.pipeline.clone();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVar} = self.${getEndpointFieldName(client)}.clone();\n`;
  body += constructUrl(indent, use, method, paramGroups, urlVar);
  if (paramGroups.apiVersion) {
    body += `${indent.get()}let ${paramGroups.apiVersion.name} = ${getHeaderPathQueryParamValue(use, paramGroups.apiVersion, true)}.clone();\n`;
  }

  switch (method.strategy.kind) {
    case 'continuationToken': {
      const reqTokenParam = method.strategy.requestToken.name;
      body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(move |${reqTokenParam}: PagerState<String>| {\n`;
      body += `${indent.push().get()}let ${method.strategy.requestToken.kind === 'queryScalar' ? 'mut ' : ''}url = first_url.clone();\n`;
      if (method.strategy.requestToken.kind === 'queryScalar') {
        // if the url already contains the token query param,
        // e.g. we started on some page, then we need to remove
        // it before appending the token for the next page.
        const reqTokenValue = method.strategy.requestToken.key;
        body += `${indent.get()}${helpers.buildIfBlock(indent, {
          condition: `let PagerState::More(${reqTokenParam}) = ${reqTokenParam}`,
          body: (indent) => {
            let body = indent.get() + helpers.buildIfBlock(indent, {
              condition: `url.query_pairs().any(|(name, _)| name.eq("${reqTokenValue}"))`,
              body: (indent) => {
                let body = `${indent.get()}let mut new_url = url.clone();\n`;
                body += `${indent.get()}new_url.query_pairs_mut().clear().extend_pairs(url.query_pairs().filter(|(name, _)| name.ne("${reqTokenValue}")));\n`;
                body += `${indent.get()}url = new_url;\n`;
                return body;
              },
            });
            body += `${indent.get()}url.query_pairs_mut().append_pair("${reqTokenValue}", &${reqTokenParam});\n`;
            return body;
          }
        })}`
      }
      break;
    }
    case 'nextLink': {
      const nextLinkName = method.strategy.nextLink.name;
      body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(move |${nextLinkName}: PagerState<Url>| {\n`;
      body += `${indent.push().get()}let url = ` + helpers.buildMatch(indent, nextLinkName, [{
        pattern: `PagerState::More(${nextLinkName})`,
        body: (indent) => {
          if (paramGroups.apiVersion && paramGroups.apiVersion.kind === 'queryScalar') {
            const apiVersionKey = `"${paramGroups.apiVersion.key}"`;
            // there are no APIs to set/update an existing query parameter.
            // so, we filter the existing query params to remove the api-version
            // query param. we then add back the filtered set and then add the
            // api-version as specified on the client.
            let setApiVerBody = `${indent.get()}let qp = ${nextLinkName}.query_pairs().filter(|(name, _)| name.ne(${apiVersionKey}));\n`;
            setApiVerBody += `${indent.get()}let mut ${nextLinkName} = ${nextLinkName}.clone();\n`;
            setApiVerBody += `${indent.get()}${nextLinkName}.query_pairs_mut().clear().extend_pairs(qp).append_pair(${apiVersionKey}, &${paramGroups.apiVersion.name});\n`;
            setApiVerBody += `${indent.get()}${nextLinkName}\n`;
            return setApiVerBody;
          }
          return `${indent.get()} ${nextLinkName}\n`;
        }
      }, {
        pattern: 'PagerState::Initial',
        body: (indent) => `${indent.get()}${urlVar}.clone()\n`
      }]);
      body += ';\n';
      break;
    }
  }

  let rspType: string;
  let rspInto: string;
  if (method.strategy.kind === 'continuationToken' && method.strategy.responseToken.kind === 'responseHeaderScalar') {
    // the continuation token comes from a response header. therefore,
    // we need a Response<T> so we have access to the header trait.
    use.addForType(method.returns.type.type);
    rspType = helpers.getTypeDeclaration(method.returns.type.type);
    rspInto = '.into()';
  } else {
    // continuation token comes from the response body.
    // we'll deconstruct the raw response and parse it later.
    use.add('azure_core', 'http::RawResponse');
    rspType = 'RawResponse';
    rspInto = '';
  }

  body += constructRequest(indent, use, method, paramGroups, true);
  body += `${indent.get()}let ctx = options.method_options.context.clone();\n`;
  body += `${indent.get()}let pipeline = pipeline.clone();\n`;
  body += `${indent.get()}async move {\n`;
  body += `${indent.push().get()}let rsp: ${rspType} = pipeline.send(&ctx, &mut request).await?${rspInto};\n`;
  if (rspType === 'RawResponse') {
    body += errIfNotSuccessResponse(use, indent);
  }

  // check if we need to extract the next link field from the response model
  if (method.strategy.kind === 'nextLink' || method.strategy.responseToken.kind === 'modelField') {
    use.add('azure_core', 'http::RawResponse');
    body += `${indent.get()}let (status, headers, body) = rsp.deconstruct();\n`;
    body += `${indent.get()}let bytes = body.collect().await?;\n`;
    const deserialize = bodyFormat === 'json' ? 'json::from_json' : 'xml::read_xml';
    body += `${indent.get()}let res: ${helpers.getTypeDeclaration(helpers.unwrapType(method.returns.type))} = ${deserialize}(&bytes)?;\n`;
    body += `${indent.get()}let rsp = RawResponse::from_bytes(status, headers, bytes).into();\n`;
  }

  let srcNextPage: string;
  let nextPageValue: string;
  let continuation: string;
  switch (method.strategy.kind) {
    case 'continuationToken':
      nextPageValue = method.strategy.responseToken.name;
      continuation = nextPageValue;
      switch (method.strategy.responseToken.kind) {
        case 'modelField':
          srcNextPage = `res.${nextPageValue}`;
          break;
        case 'responseHeaderScalar':
          if (!method.responseHeaders) {
            throw new CodegenError('InternalError', `missing response headers trait for method ${method.name}`);
          }
          use.addForType(method.responseHeaders);
          srcNextPage = `rsp.${method.strategy.responseToken.name}()?`;
          break;
      }
      break;
    case 'nextLink':
      nextPageValue = method.strategy.nextLink.name;
      srcNextPage = `res.${nextPageValue}`;
      continuation = `${nextPageValue}.parse()?`;
      break;
  }

  // we need to handle the case where the next page value is the empty string,
  // so checking strictly for None(theNextLink) is insufficient.
  // the most common case for this is XML, e.g. an empty tag like <NextLink />
  body += `${indent.get()}Ok(${helpers.buildMatch(indent, srcNextPage, [{
    pattern: `Some(${nextPageValue}) if !${nextPageValue}.is_empty()`,
    body: (indent) => {
      return `${indent.get()}response: rsp, continuation: ${continuation}`;
    },
    returns: 'PagerResult::More',
  }, {
    pattern: '_',
    body: (indent) => {
      return `${indent.get()}response: rsp`;
    },
    returns: 'PagerResult::Done',
  }])}`;
  body += ')\n'; // end Ok
  body += `${indent.pop().get()}}\n`; // end async move
  body += `${indent.pop().get()}}))`; // end Ok/Pager::from_callback

  return body;
}

/**
 * constructs the body for an LRO begin client method
 *
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param client the client to which the method belongs
 * @param method the method for the body to build
 * @returns the contents of the method body
 */
function getLroBeginMethodBody(indent: helpers.indentation, use: Use, client: rust.Client, method: rust.LroBeginMethod): string {
  const bodyFormat = helpers.convertResponseFormat(method.returns.type.type.format);

  use.add('azure_core::http', 'Method', 'PollerStatus', 'RawResponse', 'Request', 'Url');
  use.add('azure_core::http::poller', 'get_retry_after', 'PollerResult', 'PollerState', 'StatusMonitor as _');
  use.addForType(method.returns.type);
  use.addForType(helpers.unwrapType(method.returns.type));

  const paramGroups = getMethodParamGroup(method);
  const urlVar = 'url';

  let body = 'let options = options.unwrap_or_default().into_owned();\n';
  body += `${indent.get()}let pipeline = self.pipeline.clone();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVar} = self.${getEndpointFieldName(client)}.clone();\n`;
  body += `${constructUrl(indent, use, method, paramGroups, urlVar)}\n\n`;
  if (paramGroups.apiVersion) {
    body += `${indent.get()}let ${paramGroups.apiVersion.name} = ${getHeaderPathQueryParamValue(use, paramGroups.apiVersion, true)}.clone();\n\n`;
  }

  body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(\n`
  body += `${indent.push().get()}move |next_link: PollerState<Url>| {\n`;
  body += `${indent.push().get()}let (mut request, next_link) = ${helpers.buildMatch(indent, 'next_link', [{
    pattern: `PollerState::More(next_link)`,
    body: (indent) => {
      let body = '';
      if (paramGroups.apiVersion) {
        body += `${indent.get()}let qp = next_link.query_pairs().filter(|(name, _)| name.ne("api-version"));\n`;
      }

      body += `${indent.get()}let mut next_link = next_link.clone();\n`;

      if (paramGroups.apiVersion) {
        body += `${indent.get()}next_link.query_pairs_mut().clear().extend_pairs(qp).append_pair("api-version", &${paramGroups.apiVersion.name});\n\n`;
      }
      body += `${indent.get()}let ${paramGroups.header.length > 0 ? 'mut ' : ''}request = Request::new(next_link.clone(), Method::Get);`;
      body += `\n${applyHeaderParams(indent, use, method, paramGroups, true)}\n\n`
      body += `${indent.get()}(request, next_link)\n`;

      return body;
    },
  }, {
    pattern: 'PollerState::Initial',
    body: (indent) => {
      let body = `${constructRequest(indent, use, method, paramGroups, true, true, false)}\n`;
      body += `${indent.get()}(request, url.clone())\n`;

      return body;
    },
  }])};\n\n`;
  body += `${indent.get()}let ctx = options.method_options.context.clone();\n`
  body += `${indent.get()}let pipeline = pipeline.clone();\n`
  body += `${indent.get()}async move {\n`
  body += `${indent.push().get()}let rsp: RawResponse = pipeline.send(&ctx, &mut request).await?;\n`
  body += `${indent.get()}let (status, headers, body) = rsp.deconstruct();\n`
  body += `${indent.get()}let retry_after = get_retry_after(&headers, &options.poller_options);\n`
  body += `${indent.get()}let bytes = body.collect().await?;\n`
  const deserialize = bodyFormat === 'json' ? 'json::from_json' : 'xml::read_xml';
  body += `${indent.get()}let res: ${helpers.getTypeDeclaration(helpers.unwrapType(method.returns.type))} = ${deserialize}(&bytes)?;\n`
  body += `${indent.get()}let rsp = RawResponse::from_bytes(status, headers, bytes).into();\n`

  body += `${indent.get()}Ok(${helpers.buildMatch(indent, 'res.status()', [{
    pattern: `PollerStatus::InProgress`,
    body: (indent) => {
      return `${indent.get()}response: rsp, retry_after, next: next_link\n`;
    },
    returns: 'PollerResult::InProgress'
  }, {
    pattern: '_',
    body: (indent) => {
      return `${indent.get()}response: rsp`;
    },
    returns: 'PollerResult::Done'
  }])})\n`;
  body += `${indent.pop().get()}}\n`; // end async move
  body += `${indent.pop().get()}},\n`; // end move
  body += `${indent.get()}None,\n`;
  body += `${indent.pop().get()}))`; // end Ok/Poller::from_callback

  return body;
}

/**
 * constructs the body for an LRO resume client method
 *
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param client the client to which the method belongs
 * @param method the method for the body to build
 * @returns the contents of the method body
 */
function getLroResumeMethodBody(indent: helpers.indentation, use: Use, client: rust.Client, method: rust.LroResumeMethod): string {
  const bodyFormat = helpers.convertResponseFormat(method.returns.type.type.format);

  use.add('azure_core::http', 'Method', 'PollerStatus', 'RawResponse', 'Request', 'Url');
  use.add('azure_core::http::poller', 'get_retry_after', 'PollerResult', 'PollerState', 'StatusMonitor as _');
  use.addForType(method.returns.type);
  use.addForType(helpers.unwrapType(method.returns.type));

  const paramGroups = getMethodParamGroup(method);
  const urlVar = 'url';

  let body = 'let options = options.unwrap_or_default().into_owned();\n';
  body += `${indent.get()}let pipeline = self.pipeline.clone();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVar} = self.${getEndpointFieldName(client)}.clone();\n`;
  body += `${constructUrl(indent, use, method, paramGroups, urlVar)}`;

  body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(\n`
  body += `${indent.push().get()}move |_| {\n`;
  body += `${indent.push().get()}let url = url.clone();\n`;
  body += `${indent.get()}let mut request = Request::new(url.clone(), Method::Get);\n`;
  body += `${applyHeaderParams(indent, use, method, paramGroups, true)}\n`
  body += `${indent.get()}let ctx = options.method_options.context.clone();\n`
  body += `${indent.get()}let pipeline = pipeline.clone();\n`
  body += `${indent.get()}async move {\n`
  body += `${indent.push().get()}let rsp: RawResponse = pipeline.send(&ctx, &mut request).await?;\n`
  body += `${indent.get()}let (status, headers, body) = rsp.deconstruct();\n`
  body += `${indent.get()}let retry_after = get_retry_after(&headers, &options.poller_options);\n`
  body += `${indent.get()}let bytes = body.collect().await?;\n`

  let deserialize = '';
  if (bodyFormat === 'json') {
    use.add('azure_core', 'json');
    deserialize = 'json::from_json';
  } else {
    deserialize = 'xml::read_xml';
  }
  body += `${indent.get()}let res: ${helpers.getTypeDeclaration(helpers.unwrapType(method.returns.type))} = ${deserialize}(&bytes)?;\n`
  body += `${indent.get()}let rsp = RawResponse::from_bytes(status, headers, bytes).into();\n\n`

  body += `${indent.get()}Ok(${helpers.buildMatch(indent, 'res.status()', [{
    pattern: `PollerStatus::InProgress`,
    body: (indent) => {
      return `${indent.get()}response: rsp, retry_after, next: url\n`;
    },
    returns: 'PollerResult::InProgress'
  }, {
    pattern: '_',
    body: (indent) => {
      return `${indent.get()}response: rsp`;
    },
    returns: 'PollerResult::Done'
  }])})`;
  body += `${indent.pop().get()}}\n`; // end async move
  body += `${indent.pop().get()}},\n`; // end move
  body += `${indent.get()}None,\n`;
  body += `${indent.pop().get()}))`; // end Ok/Poller::from_callback

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

  const unwrappedType = helpers.unwrapType(param.type);

  switch (unwrappedType.kind) {
    case 'String':
      return `&${paramName}`;
    case 'enum':
      return `${paramName}.as_ref()`;
    case 'offsetDateTime':
    case 'scalar':
      return `&${paramName}.to_string()`;
    case 'str':
      return paramName;
    default:
      throw new CodegenError('InternalError', `unhandled ${param.kind} param type kind ${param.type.kind}`);
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
function getHeaderPathQueryParamValue(use: Use, param: HeaderParamType | PathParamType | QueryParamType, fromSelf: boolean): string {
  let paramName = param.name;
  // when fromSelf is false we assume that there's a local with the same name.
  // e.g. in pageable methods where we need to clone the params so they can be
  // passed to a future that can outlive the calling method.
  if (param.location === 'client' && fromSelf) {
    paramName = 'self.' + paramName;
  }

  const encodeBytes = function (type: rust.EncodedBytes, param?: string): string {
    const encoding = helpers.getBytesEncodingMethod(type.encoding, 'encode', use);
    if (param) {
      return `${encoding}(${param})`;
    }
    return encoding;
  };

  const encodeDateTime = function (type: rust.OffsetDateTime, param: string): string {
    const encoding = helpers.getDateTimeEncodingMethod(type.encoding, 'to', use);
    switch (type.encoding) {
      case 'rfc3339':
      case 'rfc7231': {
        return `${encoding}(&${param})`;
      }
      case 'unix_time':
        return `${param}.${encoding}.to_string()`;
    }
  };

  const paramType = helpers.unwrapType(param.type);
  if (param.kind === 'headerCollection' || param.kind === 'queryCollection') {
    if (param.format === 'multi') {
      throw new CodegenError('InternalError', 'multi should have been handled outside getHeaderPathQueryParamValue');
    } else if (paramType.kind === 'String' || paramType.kind === 'str') {
      return `${paramName}.join("${getCollectionDelimiter(param.format)}")`;
    }

    // convert the items to strings
    let strConv: string;
    switch (paramType.kind) {
      case 'encodedBytes':
        strConv = encodeBytes(paramType);
        break;
      case 'offsetDateTime':
        strConv = `|i| ${encodeDateTime(paramType, 'i')}`;
        break;
      default:
        strConv = '|i| i.to_string()';
    }

    return `${param.name}.iter().map(${strConv}).collect::<Vec<String>>().join("${getCollectionDelimiter(param.format)}")`;
  }

  switch (paramType.kind) {
    case 'String':
    case 'str':
      return paramName;
    case 'decimal':
      return `${param.name}.to_string()`;
    case 'encodedBytes':
      return encodeBytes(paramType, paramName);
    case 'enum':
    case 'scalar':
      if (paramType.kind === 'enum' && (param.kind === 'pathScalar' || param.kind === 'queryScalar')) {
        // append_pair and path.replace() want a reference to the string
        // TODO: https://github.com/Azure/typespec-rust/issues/25
        return `${paramName}.as_ref()`;
      }
      return `${paramName}.to_string()`;
    case 'enumValue':
      return `${paramType.type.name}::${paramType.name}.to_string()`;
    case 'literal':
      return `"${paramType.value}"`;
    case 'offsetDateTime':
      return encodeDateTime(paramType, param.name);
    default:
      throw new CodegenError('InternalError', `unhandled ${param.kind} param type kind ${paramType.kind}`);
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

/** returns true if the type isn't copyable thus needs to be cloned */
function nonCopyableType(type: rust.Type): boolean {
  const unwrappedType = shared.unwrapOption(type);
  switch (unwrappedType.kind) {
    case 'String':
    case 'Url':
    case 'external':
    case 'hashmap':
    case 'Vec':
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
