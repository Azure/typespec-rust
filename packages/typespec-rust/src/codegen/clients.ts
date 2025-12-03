/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore conv

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import { emitHeaderTraitDocExample } from './docTests.js';
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
        body += `${indent.get()}#[tracing::new("${client.languageIndependentName}")]\n`;
        body += `${indent.get()}pub fn ${constructor.name}(${getConstructorParamsSig(constructor.params, client.constructable.options, use)}) -> Result<Self> {\n`;
        body += `${indent.get()}let options = options.unwrap_or_default();\n`;
        // by convention, the endpoint param is always the first ctor param
        const endpointParamName = constructor.params[0].name;
        body += `${indent.push().get()}let ${client.constructable.endpoint ? 'mut ' : ''}${endpointParamName} = Url::parse(${endpointParamName})?;\n`;
        body += `${indent.get()}${helpers.buildIfBlock(indent, {
          condition: `!${endpointParamName}.scheme().starts_with("http")`,
          body: (indent) => `${indent.get()}return Err(azure_core::Error::with_message(azure_core::error::ErrorKind::Other, format!("{${endpointParamName}} must use http(s)")));\n`,
        })}`

        // construct the supplemental path and join it to the endpoint
        if (client.constructable.endpoint) {
          const supplementalEndpoint = client.constructable.endpoint;
          if (supplementalEndpoint.parameters.length > 0) {
            body += `${indent.get()}let mut host = String::from("${supplementalEndpoint.path}");\n`;
            for (const param of supplementalEndpoint.parameters) {
              body += `${indent.get()}host = host.replace("{${param.segment}}", ${getClientSupplementalEndpointParamValue(param)});\n`;
            }
            body += `${indent.push().get()}${endpointParamName} = ${endpointParamName}.join(&host)?;\n`;
          } else {
            // there are no params for the supplemental host, so just append it
            body += `${indent.push().get()}${endpointParamName} = ${endpointParamName}.join("${supplementalEndpoint.path}")?;\n`;
          }
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
          .where((each) => each.kind !== 'clientSupplementalEndpoint' && each.kind !== 'clientCredential').toArray();

        for (const param of sortedParams) {
          if (param.optional) {
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
        body += `${indent.get()}${authPolicy ? 'vec![auth_policy]' : 'Vec::default()'}, None,\n`;
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
        case 'lro':
          isPublicApi = true;
          methodBody = (indentation: helpers.indentation): string => {
            return getLroMethodBody(indentation, use, client, method);
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

      // client accessors will never have response headers
      if (method.kind !== 'clientaccessor' && method.responseHeaders) {
        body += getHeaderTraitDocComment(indent, crate, method);
      }

      const paramsInfo = getMethodParamsCountAndSig(method, use);
      if (paramsInfo.count > 7) {
        // clippy will by default warn on 7+ args in a method.
        // note that this doesn't include self which is included
        // in the count.
        body += `${indent.get()}#[allow(clippy::too_many_arguments)]\n`;
      }

      if (isPublicApi) {
        body += `${indent.get()}#[tracing::function("${method.languageIndependentName}")]\n`;
      } else if (isSubclientNew) {
        body += `${indent.get()}#[tracing::subclient]\n`;
      }

      body += `${indent.get()}${helpers.emitVisibility(method.visibility)}${async}fn ${method.name}(${paramsInfo.sig}) -> ${returnType} {\n`;
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

      if (method.kind === 'pageable' || method.kind === 'lro') {
        body += `impl ${helpers.getTypeDeclaration(method.options.type, 'anonymous')} {\n`;
        const wrappedTypeName = helpers.wrapInBackTicks(helpers.getTypeDeclaration(method.options.type, 'omit'));
        body += `${indent.get()}/// Transforms this [${wrappedTypeName}] into a new ${wrappedTypeName} that owns the underlying data, cloning it if necessary.\n`;
        body += `${indent.get()}pub fn into_owned(self) -> ${method.options.type.name}<'static> {\n`;
        body += `${indent.push().get()}${method.options.type.name} {\n`;
        indent.push();
        for (const field of method.options.type.fields) {
          if (field.type.kind === 'external' && (field.type.name === 'ClientMethodOptions' || field.type.name === 'PagerOptions' || field.type.name === 'PollerOptions')) {
            body += `${indent.get()}${field.name}: ${field.type.name} {\n`;
            body += `${indent.push().get()}context: self.${field.name}.context.into_owned(),\n`;
            body += `${indent.get()}..self.${field.name}\n`;
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
    return `* ${helpers.wrapInBackTicks(paramName)} - `;
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
 * e.g. "foo: i32, bar: String, options: MethodOptions".
 * also returns the number of parameters in the sig.
 * 
 * @param method the Rust method for which to create the param sig
 * @param use the use statement builder currently in scope
 * @returns the method params count and sig
 */
function getMethodParamsCountAndSig(method: rust.MethodType, use: Use): { count: number, sig: string } {
  const paramsSig = new Array<string>();
  paramsSig.push(formatParamTypeName(method.self));

  let count = 1; // self
  if (method.kind === 'clientaccessor') {
    // client accessor params don't have a concept
    // of optionality nor do they contain literals
    for (const param of method.params) {
      use.addForType(param.type);
      paramsSig.push(`${param.name}: ${formatParamTypeName(param)}`);
      ++count;
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
        ++count;
      }
    }

    paramsSig.push(`options: ${helpers.getTypeDeclaration(method.options, 'anonymous')}`);
    ++count;
  }

  return { count: count, sig: paramsSig.join(', ') };
}

/**
 * returns documentation for header trait access if the method has response headers.
 * 
 * @param indent the current indentation level
 * @param crate the crate to which method belongs
 * @param method the method for which to generate header trait documentation
 * @returns the header trait documentation or empty string if not applicable
 */
function getHeaderTraitDocComment(indent: helpers.indentation, crate: rust.Crate, method: ClientMethod): string {
  if (!method.responseHeaders) {
    return '';
  }

  const traitName = method.responseHeaders.name;
  let headerDocs = `${indent.get()}///\n`;
  headerDocs += `${indent.get()}/// ## Response Headers\n`;
  headerDocs += `${indent.get()}///\n`;
  let returnType: string;
  switch (method.returns.type.kind) {
    case 'asyncResponse':
    case 'response':
      returnType = method.returns.type.name;
      break;
    default:
      // for pagers/pollers we want their generic type argument type name
      returnType = method.returns.type.type.name;
      break;
  }
  headerDocs += `${indent.get()}/// The returned [${helpers.wrapInBackTicks(returnType)}](azure_core::http::${returnType}) implements the [${helpers.wrapInBackTicks(traitName)}] trait, which provides\n`;
  headerDocs += `${indent.get()}/// access to response headers. For example:\n`;
  headerDocs += `${indent.get()}///\n`;
  headerDocs += emitHeaderTraitDocExample(crate.name, method.responseHeaders, indent);
  headerDocs += `${indent.get()}///\n`;
  headerDocs += `${indent.get()}/// ### Available headers\n`;

  // List all available headers
  for (const header of method.responseHeaders.headers) {
    headerDocs += `${indent.get()}/// * [${helpers.wrapInBackTicks(header.name)}()](crate::generated::models::${traitName}::${header.name}) - ${header.header}\n`;
  }

  headerDocs += `${indent.get()}///\n`;
  headerDocs += `${indent.get()}/// [${helpers.wrapInBackTicks(traitName)}]: crate::generated::models::${traitName}\n`;

  return headerDocs;
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
      use.add('azure_core::http::policies', 'BearerTokenAuthorizationPolicy', 'Policy');
      const scopes = new Array<string>();
      for (const scope of arcTokenCred.scopes) {
        scopes.push(`"${scope}"`);
      }
      return `let auth_policy: Arc<dyn Policy> = Arc::new(BearerTokenAuthorizationPolicy::new(credential, vec![${scopes.join(', ')}]));`;
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

type ClientMethod = rust.AsyncMethod | rust.PageableMethod | rust.LroMethod;
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
 * @param optionsPrefix Syntax to access the options structure, including the dot
 * @returns 
 */
function getParamValueHelper(indent: helpers.indentation, param: rust.MethodParameter, setter: () => string, optionsPrefix: string = 'options.'): string {
  if (param.optional && param.type.kind !== 'literal') {
    const asRef = nonCopyableType(param.type) || isEnumString(param.type) ? '.as_ref()' : '';
    // optional params are in the unwrapped options local var
    const op = indent.get() + helpers.buildIfBlock(indent, {
      condition: `let Some(${param.name}) = ${param.location === 'client' ? 'self.' : optionsPrefix}${param.name}${asRef}`,
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
 * @param urlVarName the name of the var that contains the azure_core::Url
 * @returns the URL construction code
 */
function constructUrl(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: MethodParamGroups, urlVarName: string): string {
  // for paths that contain query parameters, we must set the query params separately.
  // including them in the call to set_path() causes the chars to be path-escaped.
  const pathChunks = method.httpPath.split('?');
  if (pathChunks.length > 2) {
    throw new CodegenError('InternalError', 'too many HTTP path chunks');
  }

  let body = '';

  // if path is just "/" no need to set it again, we're already there
  if (pathChunks[0] !== '/') {
    use.add('azure_core::http', 'UrlExt');
    let path = `"${pathChunks[0]}"`;
    if (paramGroups.path.length === 0) {
      // no path params, just a static path
      body += `${indent.get()}${urlVarName}.append_path(${path});\n`;
    } else if (paramGroups.path.length === 1 && pathChunks[0] === `{${paramGroups.path[0].segment}}`) {
      // for a single path param (i.e. "{foo}") we can directly join the path param's value
      const pathParam = paramGroups.path[0];
      body += `${indent.get()}${urlVarName}.append_path(${getHeaderPathQueryParamValue(use, pathParam, true, false)});\n`;
    } else {
      // we have path params that need to have their segments replaced with the param values
      const pathVarName = helpers.getUniqueVarName(method.params, ['path', 'path_var']);
      body += `${indent.get()}let mut ${pathVarName} = String::from(${path});\n`;

      for (const pathParam of paramGroups.path) {
        let wrapSortedVec: (s: string) => string = (s) => s;
        let paramExpression: string;
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
          // skip borrowing by default as we borrow from format!()
          paramExpression = getHeaderPathQueryParamValue(use, pathParam, true, true);
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
              // use default borrowing calculation logic
              paramExpression = getHeaderPathQueryParamValue(use, pathParam, true, false);
          }
        }

        if (pathParam.optional) {
          body += `${indent.get()}${pathVarName} = ${helpers.buildMatch(indent, `options.${pathParam.name}${nonCopyableType(pathParam.type) ? '.as_ref()' : ''}`, [{
            pattern: `Some(${pathParam.name})`,
            body: (indent) => wrapSortedVec(`${indent.get()}${pathVarName}.replace("{${pathParam.segment}}", ${paramExpression})\n`),
          }, {
            pattern: `None`,
            body: (indent) => `${indent.get()}${pathVarName}.replace("{${pathParam.segment}}", "")\n`,
          }])};\n`;
        } else {
          body += wrapSortedVec(`${indent.get()}${pathVarName} = ${pathVarName}.replace("{${pathParam.segment}}", ${paramExpression});\n`);
        }
      }
      path = `&${pathVarName}`;
      body += `${indent.get()}${urlVarName}.append_path(${path});\n`;
    }
  }

  let hasQueryBuilder = false;

  const getQueryBuilder = function(): string {
    hasQueryBuilder = true;
    use.add('azure_core::http', 'UrlExt');
    return `${indent.get()}let mut query_builder = ${urlVarName}.query_builder();\n`;
  };

  if (pathChunks.length === 2) {
    body += getQueryBuilder();
    body += `${indent.get()}query_builder`;
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

  if (paramGroups.query.length > 0 && !hasQueryBuilder) {
    body += getQueryBuilder();
  }

  for (const queryParam of paramGroups.query) {
    if (queryParam.kind === 'queryCollection' && queryParam.format === 'multi') {
      body += getParamValueHelper(indent, queryParam, () => {
        const valueVar = queryParam.name[0];
        let text = `${indent.get()}for ${valueVar} in ${queryParam.name}.iter() {\n`;
        // if queryParam is a &[&str] then we'll need to deref the iterator
        const deref = shared.asTypeOf(queryParam.type, 'str', 'ref', 'slice', 'ref') ? '*' : '';
        text += `${indent.push().get()}query_builder.append_pair("${queryParam.key}", ${deref}${getHeaderPathQueryParamValue(use, queryParam, !queryParam.optional, false, valueVar)});\n`;
        text += `${indent.pop().get()}}\n`;
        return text;
      });
    } else if (queryParam.kind === 'queryHashMap') {
      body += getParamValueHelper(indent, queryParam, () => {
        let text = `${indent.get()}{\n`;
        text += `${indent.push().get()}let mut ${queryParam.name}_vec = ${queryParam.name}.iter().collect::<Vec<_>>();\n`;
        text += `${indent.get()}${queryParam.name}_vec.sort_by_key(|p| p.0);\n`;
        if (queryParam.explode) {
          text += `${indent.get()}for (k, v) in ${queryParam.name}_vec.iter() {\n`;
          text += `${indent.push().get()}query_builder.append_pair(*k, v.to_string());\n`;
          text += `${indent.pop().get()}}\n`;
        } else {
          text += `${indent.get()}query_builder.set_pair("${queryParam.key}", ${queryParam.name}_vec.iter().map(|(k, v)| format!("{k},{v}")).collect::<Vec<String>>().join(","));\n`;
        }
        text += `${indent.pop().get()}}\n`;
        return text;
      });
    } else {
      body += getParamValueHelper(indent, queryParam, () => {
        return `${indent.get()}query_builder.set_pair("${queryParam.key}", ${getHeaderPathQueryParamValue(use, queryParam, !queryParam.optional, false)});\n`;
      });
    }
  }

  if (hasQueryBuilder) {
    body += `${indent.get()}query_builder.build();\n`;
  }

  return body;
}

/**
 * emits the code for setting HTTP headers in a request.
 *
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param method the method for which we're building the body
 * @param paramGroups the param groups for the provided method
 * @param inClosure indicates if the request is being constructed within a closure (e.g. pageable methods)
 * @param requestVarName name for the request variable
 * @param optionsPrefix Syntax to access the options structure, including the dot
 * @returns the code which sets HTTP headers for the request
 */
function applyHeaderParams(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: MethodParamGroups, inClosure: boolean, requestVarName: string, optionsPrefix: string = 'options.'): string {
  let body = '';

  for (const headerParam of paramGroups.header) {
    if (method.kind === 'pageable' && method.strategy?.kind === 'continuationToken' && method.strategy?.requestToken.kind === 'headerScalar' && method.strategy?.requestToken === headerParam) {
      // we have some special handling for the header continuation token.
      // if we have a token value, i.e. from the next page, then use that value.
      // if not, then check if an optional token value was provided.
      body += `${indent.get()}let ${headerParam.name} = ` + helpers.buildMatch(indent, headerParam.name, [
        {
          pattern: `PagerState::More(${headerParam.name})`,
          body: (indent) => `${indent.get()}&Some(${headerParam.name})\n`,
        },
        {
          pattern: 'PagerState::Initial',
          body: (indent) => `${indent.get()}&${optionsPrefix}${headerParam.name}\n`,
        }
      ]) + ';\n';
      body += indent.get() + helpers.buildIfBlock(indent, {
        condition: `let Some(${headerParam.name}) = ${headerParam.name}`,
        body: (indent) => `${indent.get()}${requestVarName}.insert_header("${headerParam.header}", ${headerParam.name});\n`,
      }) + '\n';
      continue;
    }

    if (isOptionalContentTypeHeader(headerParam)) {
      // when the body is optional, the Content-Type header
      // will be set IFF the optional body param is not None.
      // this logic happens elsewhere so we skip it here.
      continue;
    }

    body += getParamValueHelper(indent, headerParam, () => {
      if (headerParam.kind === 'headerHashMap') {
        let setter = `for (k, v) in ${headerParam.name} {\n`;
        setter += `${indent.push().get()}${requestVarName}.insert_header(format!("${headerParam.header}-{k}"), v);\n`;
        setter += `${indent.pop().get()}}\n`;
        return setter;
      }
      return `${indent.get()}${requestVarName}.insert_header("${headerParam.header.toLowerCase()}", ${getHeaderPathQueryParamValue(use, headerParam, !inClosure, false)});\n`;
    }, optionsPrefix);
  }

  return body;
}

/** type guard to determine if headerParam is an optional Content-Type header */
function isOptionalContentTypeHeader(headerParam: HeaderParamType): headerParam is rust.HeaderScalarParameter {
  return headerParam.kind === 'headerScalar' && headerParam.optional && headerParam.header.toLowerCase() === 'content-type';
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
 * @param urlVarName the name of var that contains the URL
 * @param cloneUrl indicates if url should be cloned when it is passed to initialize request
 * @param forceMut indicates whether request should get declared as 'mut' regardless of whether there are any headers to set
 * @returns the request construction code
 */
function constructRequest(indent: helpers.indentation, use: Use, method: ClientMethod, paramGroups: MethodParamGroups, inClosure: boolean, urlVarName: string, cloneUrl: boolean = false, forceMut: boolean = true): { requestVarName: string, content: string } {
  // when constructing the request var name we need to ensure
  // that it doesn't collide with any parameter name.
  const requestVarName = helpers.getUniqueVarName(method.params, ['request', 'core_req']);
  let body = `${indent.get()}let ${(forceMut || paramGroups.header.length > 0) ? 'mut ' : ''}${requestVarName} = Request::new(${urlVarName}${cloneUrl ? '.clone()' : ''}, Method::${codegen.capitalize(method.httpMethod)});\n`;

  body += applyHeaderParams(indent, use, method, paramGroups, inClosure, requestVarName);

  let optionalContentTypeParam: rust.HeaderScalarParameter | undefined;
  for (const headerParam of paramGroups.header) {
    // if the content-type header is optional, we need to emit it inside the "if let Some(body)" clause below.
    if (isOptionalContentTypeHeader(headerParam)) {
      optionalContentTypeParam = headerParam;
    }
  }

  const bodyParam = paramGroups.body;
  if (bodyParam) {
    body += getParamValueHelper(indent, bodyParam, () => {
      let bodyParamContent = '';
      if (optionalContentTypeParam) {
        bodyParamContent = `${indent.get()}${requestVarName}.insert_header("${optionalContentTypeParam.header.toLowerCase()}", ${getHeaderPathQueryParamValue(use, optionalContentTypeParam, !inClosure, false)});\n`;
      }
      bodyParamContent += `${indent.get()}${requestVarName}.set_body(${bodyParam.name}${inClosure ? '.clone()' : ''});\n`;
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
    body += `${indent.get()}${requestVarName}.set_body(body);\n`;
  }

  return {
    requestVarName: requestVarName,
    content: body
  };
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
    body: (indent) => `${indent.get()}return Err(azure_core::Error::with_message(azure_core::error::ErrorKind::Other, "parameter ${param.name} cannot be empty"));\n`,
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

  const urlVarName = helpers.getUniqueVarName(method.params, ['url', 'url_var']);
  const paramGroups = getMethodParamGroup(method);
  let body = checkEmptyRequiredPathParams(indent, paramGroups.path);
  body += 'let options = options.unwrap_or_default();\n';
  body += `${indent.get()}let ctx = options.method_options.context.to_borrowed();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVarName} = self.${getEndpointFieldName(client)}.clone();\n`;

  body += constructUrl(indent, use, method, paramGroups, urlVarName);
  const requestResult = constructRequest(indent, use, method, paramGroups, false, urlVarName);
  body += requestResult.content;

  let pipelineMethod: string;
  switch (method.returns.type.kind) {
    case 'asyncResponse':
      pipelineMethod = 'stream';
      break;
    case 'response':
      pipelineMethod = 'send';
      break;
  }
  body += `${indent.get()}let rsp = self.pipeline.${pipelineMethod}(&ctx, &mut ${requestResult.requestVarName}, ${getPipelineOptions(indent, use, method)}).await?;\n`;
  body += `${indent.get()}Ok(rsp.into())\n`;
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
  use.add('azure_core::http', 'Method', 'Request', 'Url');
  use.add('azure_core::http::pager', 'PagerResult', 'PagerState');
  use.add('azure_core', 'Result');
  use.addForType(method.returns.type);
  use.addForType(helpers.unwrapType(method.returns.type));

  const paramGroups = getMethodParamGroup(method);
  const urlVar = method.strategy ? 'first_url' : helpers.getUniqueVarName(method.params, ['url', 'url_var']);

  let body = checkEmptyRequiredPathParams(indent, paramGroups.path);
  body += 'let options = options.unwrap_or_default().into_owned();\n';
  body += `${indent.get()}let pipeline = self.pipeline.clone();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVar} = self.${getEndpointFieldName(client)}.clone();\n`;
  body += constructUrl(indent, use, method, paramGroups, urlVar);

  // passed to constructRequest. we only need to
  // clone it for the non-continuation case.
  let cloneUrl = false;

  // this will be either the inner URL var created
  // during paging or the initial URL var when there's
  // no paging strategy
  let srcUrlVar: string;

  if (method.strategy) {
    if (paramGroups.apiVersion) {
      body += `${indent.get()}let ${paramGroups.apiVersion.name} = ${getHeaderPathQueryParamValue(use, paramGroups.apiVersion, true, true)}.clone();\n`;
    }

    switch (method.strategy.kind) {
      case 'continuationToken': {
        const reqTokenParam = method.strategy.requestToken.name;
        body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(move |${reqTokenParam}: PagerState<String>, pager_options| {\n`;
        body += `${indent.push().get()}let ${method.strategy.requestToken.kind === 'queryScalar' ? 'mut ' : ''}url = first_url.clone();\n`;
        if (method.strategy.requestToken.kind === 'queryScalar') {
          // if the url already contains the token query param,
          // e.g. we started on some page, then we need to remove
          // it before appending the token for the next page.
          use.add('azure_core::http', 'UrlExt');
          const reqTokenValue = method.strategy.requestToken.key;
          body += `${indent.get()}${helpers.buildIfBlock(indent, {
            condition: `let PagerState::More(${reqTokenParam}) = ${reqTokenParam}`,
            body: (indent) => {
              return `${indent.get()}let mut query_builder = url.query_builder();\n`
                + `${indent.get()}query_builder.set_pair("${reqTokenValue}", &${reqTokenParam});\n`
                + `${indent.get()}query_builder.build();\n`;
            }
          })}\n`;
        }
        srcUrlVar = 'url';
        break;
      }
      case 'nextLink': {
        const nextLinkName = method.strategy.nextLinkPath[method.strategy.nextLinkPath.length - 1].name;
        const reinjectedParams = method.strategy.reinjectedParams;
        body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(move |${nextLinkName}: PagerState<Url>, pager_options| {\n`;
        body += `${indent.push().get()}let url = ` + helpers.buildMatch(indent, nextLinkName, [{
          pattern: `PagerState::More(${nextLinkName})`,
          body: (indent) => {
            const cloneNextLink = `${indent.get()}let mut ${nextLinkName} = ${nextLinkName}.clone();\n`;
            let content = '';
            let hasQueryBuilder = false;
            if (paramGroups.apiVersion && paramGroups.apiVersion.kind === 'queryScalar') {
              content += cloneNextLink;
              hasQueryBuilder = true;
              use.add('azure_core::http', 'UrlExt');
              content += `${indent.get()}let mut query_builder = ${nextLinkName}.query_builder();\n`;
              content += `${indent.get()}query_builder.set_pair("${paramGroups.apiVersion.key}", &${paramGroups.apiVersion.name});\n`;
            } else if (reinjectedParams.length > 0) {
              // if we didn't clone it above, we'll need to clone it for this case
              content += cloneNextLink;
            }

            // add query params for reinjection
            if (reinjectedParams.length > 0 && !hasQueryBuilder) {
              hasQueryBuilder = true;
              use.add('azure_core::http', 'UrlExt');
              content += `${indent.get()}let mut query_builder = ${nextLinkName}.query_builder();\n`;
            }
            for (const reinjectedParam of reinjectedParams) {
              content += getParamValueHelper(indent, reinjectedParam, () => {
                return `${indent.get()}query_builder.set_pair("${reinjectedParam.key}", ${getHeaderPathQueryParamValue(use, reinjectedParam, false, false)});\n`;
              });
            }
            if (hasQueryBuilder) {
              content += `${indent.get()}query_builder.build();\n`;
            }
            content += `${indent.get()}${nextLinkName}\n`;
            return content;
          }
        }, {
          pattern: 'PagerState::Initial',
          body: (indent) => `${indent.get()}${urlVar}.clone()\n`
        }]);
        body += ';\n';
        srcUrlVar = 'url';
        break;
      }
    }
  } else {
    // no next link when there's no strategy
    body += `${indent.get()}Ok(Pager::from_callback(move |_: PagerState<Url>, pager_options| {\n`;
    indent.push();
    cloneUrl = true;
    srcUrlVar = urlVar;
  }

  // Pipeline::send() returns a RawResponse, so no reason to declare the type if not something else.
  let rspType = '';
  let rspInto = '';
  if (method.strategy && method.strategy.kind === 'continuationToken' && method.strategy.responseToken.kind === 'responseHeaderScalar') {
    // the continuation token comes from a response header. therefore,
    // we need a Response<T> so we have access to the header trait.
    use.addForType(method.returns.type.type);
    const rspTypeDecl = helpers.getTypeDeclaration(method.returns.type.type);
    rspType = `: ${rspTypeDecl}`;
    rspInto = '.into()';
  }

  const requestResult = constructRequest(indent, use, method, paramGroups, true, srcUrlVar, cloneUrl);
  body += requestResult.content;
  body += `${indent.get()}let pipeline = pipeline.clone();\n`;
  body += `${indent.get()}async move {\n`;
  body += `${indent.push().get()}let rsp${rspType} = pipeline.send(&pager_options.context, &mut ${requestResult.requestVarName}, ${getPipelineOptions(indent, use, method)}).await?${rspInto};\n`;

  // check if we need to extract the next link field from the response model
  if (method.strategy && (method.strategy.kind === 'nextLink' || method.strategy.responseToken.kind === 'nextLink')) {
    const bodyFormat = helpers.convertResponseFormat(method.returns.type.type.format);
    use.add('azure_core', bodyFormat, 'http::RawResponse');
    body += `${indent.get()}let (status, headers, body) = rsp.deconstruct();\n`;
    const deserialize = `${bodyFormat}::from_${bodyFormat}`;
    body += `${indent.get()}let res: ${helpers.getTypeDeclaration(helpers.unwrapType(method.returns.type))} = ${deserialize}(&body)?;\n`;
    body += `${indent.get()}let rsp = RawResponse::from_bytes(status, headers, body).into();\n`;
  }

  if (method.strategy) {
    /** provides access to the next link field, handling nested fields as required */
    const buildNextLinkPath = function (nextLinkPath: Array<rust.ModelField>): string {
      let fullPath = nextLinkPath[0].name;
      if (nextLinkPath.length > 1) {
        for (let i = 1; i < nextLinkPath.length; ++i) {
          const prev = nextLinkPath[i - 1];
          const cur = nextLinkPath[i];
          fullPath += `.and_then(|${prev.name}| ${prev.name}.${cur.name})`;
        }
      }
      return fullPath;
    };

    let srcNextPage: string;
    let nextPageValue: string;
    let continuation: string;
    switch (method.strategy.kind) {
      case 'continuationToken':
        switch (method.strategy.responseToken.kind) {
          case 'nextLink':
            nextPageValue = method.strategy.responseToken.nextLinkPath[method.strategy.responseToken.nextLinkPath.length - 1].name;
            srcNextPage = `res.${buildNextLinkPath(method.strategy.responseToken.nextLinkPath)}`;
            break;
          case 'responseHeaderScalar':
            if (!method.responseHeaders) {
              throw new CodegenError('InternalError', `missing response headers trait for method ${method.name}`);
            }
            nextPageValue = method.strategy.responseToken.name;
            use.addForType(method.responseHeaders);
            srcNextPage = `rsp.${method.strategy.responseToken.name}()?`;
            break;
        }
        continuation = nextPageValue;
        break;
      case 'nextLink': {
        const lastFieldName = method.strategy.nextLinkPath[method.strategy.nextLinkPath.length - 1].name;
        nextPageValue = lastFieldName;
        srcNextPage = `res.${buildNextLinkPath(method.strategy.nextLinkPath)}`;
        continuation = `${lastFieldName}.parse()?`;
        break;
      }
    }

    // we need to handle the case where the next page value is the empty string,
    // so checking strictly for None(theNextLink) is insufficient.
    // the most common case for this is XML, e.g. an empty tag like <NextLink />
    body += `${indent.get()}Ok(${helpers.buildMatch(indent, srcNextPage, [{
      pattern: `Some(${nextPageValue}) if !${nextPageValue}.is_empty()`,
      body: (indent) => {
        return `${indent.get()}response: rsp, continuation: ${continuation}\n`;
      },
      returns: 'PagerResult::More',
    }, {
      pattern: '_',
      body: (indent) => {
        return `${indent.get()}response: rsp\n`;
      },
      returns: 'PagerResult::Done',
    }])}`;
    body += ')\n'; // end Ok
  } else {
    // non-continuation case, so we don't need to worry about next links, continuation tokens, etc...
    body += `${indent.get()}Ok(PagerResult::Done { response: rsp.into() })\n`;
  }

  body += `${indent.pop().get()}}\n`; // end async move
  body += `${indent.get()}},\n${indent.get()}Some(options.method_options),\n`; // end move
  body += `${indent.pop().get()}))`; // end Ok/Pager::from_callback

  return body;
}

/**
 * constructs the body for an LRO client method
 *
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param client the client to which the method belongs
 * @param method the method for the body to build
 * @returns the contents of the method body
 */
function getLroMethodBody(indent: helpers.indentation, use: Use, client: rust.Client, method: rust.LroMethod): string {
  let pollingStepHeaderName = undefined;
  for (const header of ['operation-location', 'azure-asyncoperation', 'location']) {
    if (method.responseHeaders?.headers.some(h => h.header.toLowerCase() === header)) {
      pollingStepHeaderName = header;
      break;
    }
  }

  const bodyFormat = helpers.convertResponseFormat(method.returns.type.type.format);

  use.add('azure_core::http', 'Method', 'RawResponse', 'Request', 'Url');
  use.add('azure_core::http::headers', 'RETRY_AFTER', 'X_MS_RETRY_AFTER_MS', 'RETRY_AFTER_MS');
  use.add('azure_core::http::poller', 'get_retry_after', 'PollerResult', 'PollerState', 'PollerStatus', 'StatusMonitor as _');
  if (pollingStepHeaderName !== undefined || method.finalResultStrategy.kind !== 'originalUri') {
    use.add('azure_core::http::headers', 'HeaderName');
  }

  use.addForType(method.returns.type);
  use.addForType(helpers.unwrapType(method.returns.type));

  const paramGroups = getMethodParamGroup(method);
  const urlVar = helpers.getUniqueVarName(method.params, ['url', 'url_var']);

  let body = 'let options = options.unwrap_or_default().into_owned();\n';
  body += `${indent.get()}let pipeline = self.pipeline.clone();\n`;
  body += `${indent.get()}let ${urlVarNeedsMut(paramGroups, method)}${urlVar} = self.${getEndpointFieldName(client)}.clone();\n`;
  body += constructUrl(indent, use, method, paramGroups, urlVar);
  if (paramGroups.apiVersion) {
    body += `${indent.get()}let ${paramGroups.apiVersion.name} = ${getHeaderPathQueryParamValue(use, paramGroups.apiVersion, true, true)}.clone();\n`;
  }

  // we call this eagerly so that we have access to the request var name
  const initialRequestResult = constructRequest(indent, use, method, paramGroups, true, urlVar, true, false);

  const applyApiVersionParam = function (indent: helpers.indentation, paramGroups: MethodParamGroups, newLinkVarName: string, existingLinkVarAccessor: string): string {
    if (paramGroups.apiVersion?.kind === 'queryScalar') {
      use.add('azure_core::http', 'UrlExt');
      return `${indent.get()}let mut ${newLinkVarName} = ${existingLinkVarAccessor}.clone();\n`
        + `${indent.get()}let mut query_builder = ${newLinkVarName}.query_builder();\n`
        + `${indent.get()}query_builder.set_pair("${paramGroups.apiVersion.key}", &${paramGroups.apiVersion.name});\n`
        + `${indent.get()}query_builder.build();\n`;
    }

    return '';
  };

  const declareRequest = function (indent: helpers.indentation, use: Use, method: rust.LroMethod, paramGroups: MethodParamGroups, requestVarName: string, linkExpr: string, forceMut?: boolean, optionsPrefix?: string): string {
    let mutRequest = '';
    // if the only header is optional Content-Type it will not be used
    // by applyHeaderParams() in this case so don't make request mutable
    if (forceMut || paramGroups.header.length > 1 || (paramGroups.header.length === 1 && !isOptionalContentTypeHeader(paramGroups.header[0]))) {
      mutRequest = 'mut ';
    }

    return `${indent.get()}let ${mutRequest}${requestVarName} = Request::new(${linkExpr}, Method::Get);\n`
      + applyHeaderParams(indent, use, method, paramGroups, true, requestVarName, optionsPrefix);
  };

  let stateVarName = 'next_link';
  let stateVarType = 'Url';
  let progressVarName = 'next_link';
  let stateNextLinkAccessor = 'next_link';
  let pollerStateMoreReturn = 'next_link';
  let pollerStateInitialReturn = `${urlVar}.clone()`;
  let pollerStatusInProgressReturn = 'next_link';
  if (method.finalResultStrategy.kind === 'header' && method.finalResultStrategy.headerName !== pollingStepHeaderName) {
    // A case when the initial response contains two headers - one (usually, 'azure-asyncoperation') to poll operation status
    // and another (usually, 'location') to collect the final result. Both values are URLs.
    // But only the initial response will have these headers, i.e. responses from 'azure-asyncoperation' URL won't have the 'location'.
    // Therefore, we need to preserve both URLs and pass them between poller states, up to the moment when the operation status
    // is Succeeded, so that when operation is Succeeded, the poller can send a request to 'location' to collect the result.
    body += `${indent.get()}struct Progress{ next_link: Url, final_link: Url, }`;
    body += `${indent.get()}impl AsRef<str> for Progress{ fn as_ref(&self) -> &str{ self.next_link.as_ref() }}\n`;

    stateVarName = 'state';
    stateVarType = 'Progress';
    progressVarName = 'progress';
    stateNextLinkAccessor = 'progress.next_link';
    pollerStateMoreReturn = 'Progress{next_link, final_link: progress.final_link}';
    pollerStateInitialReturn = `Progress{next_link: ${urlVar}.clone(), final_link: ${urlVar}.clone()}`;
    pollerStatusInProgressReturn = 'Progress{next_link, final_link}';
  }
  body += `${indent.get()}Ok(${method.returns.type.name}::from_callback(\n`
  body += `${indent.push().get()}move |${stateVarName}: PollerState<${stateVarType}>, poller_options| {\n`;
  body += `${indent.push().get()}let (mut ${initialRequestResult.requestVarName}, ${progressVarName}) = ${helpers.buildMatch(indent, stateVarName, [{
    pattern: `PollerState::More(${progressVarName})`,
    body: (indent) => {
      return applyApiVersionParam(indent, paramGroups, 'next_link', stateNextLinkAccessor)
        + declareRequest(indent, use, method, paramGroups, initialRequestResult.requestVarName, 'next_link.clone()')
        + `${indent.get()}(${initialRequestResult.requestVarName}, ${pollerStateMoreReturn})\n`;
    },
  }, {
    pattern: 'PollerState::Initial',
    body: (indent) => {
      let body = initialRequestResult.content;
      body += `${indent.get()}(${initialRequestResult.requestVarName}, ${pollerStateInitialReturn})\n`;

      return body;
    },
  }])};\n`;
  body += `${indent.get()}let ctx = poller_options.context.clone();\n`
  body += `${indent.get()}let pipeline = pipeline.clone();\n`

  if (method.finalResultStrategy.kind === 'originalUri') {
    body += `${indent.get()}let final_link = url.clone();\n`

    for (const headerParam of paramGroups.header.filter(h => h.type.kind !== 'literal' && !isOptionalContentTypeHeader(h))) {
      if (headerParam.type.kind !== 'enum') {
        const optionsPrefix = headerParam.optional ? 'options.' : '';
        body += `${indent.get()}let ${headerParam.name} = ${optionsPrefix}${headerParam.name}.clone();\n`
      }
    }
  }

  // Match an ARM PUT operation ("create or update"), which may have immediate 200 OK response with no headers and no poller status
  const isArmPutLro = bodyFormat === 'json'
    && method.httpMethod === 'put'
    && method.returns.type.resultType !== undefined
    && method.finalResultStrategy.kind === 'header'
    && method.finalResultStrategy.headerName === 'azure-asyncoperation'
    && pollingStepHeaderName === 'azure-asyncoperation'
    && method.statusCodes.some(sc => sc == 200)
    && method.statusCodes.some(sc => sc == 201);

  // Match an ARM PATCH operation ("update"), which may have immediate 200 OK response with no headers and no poller status
  const isArmPatchLro = bodyFormat === 'json'
    && method.httpMethod === 'patch'
    && method.returns.type.resultType !== undefined
    && method.finalResultStrategy.kind === 'header'
    && method.finalResultStrategy.headerName === 'location'
    && pollingStepHeaderName === 'location'
    && method.statusCodes.some(sc => sc == 200)
    && method.statusCodes.some(sc => sc == 202);

  // Match an ARM POST operation ("export"), which may have empty initial response
  const isArmPostLro = bodyFormat === 'json'
    && method.httpMethod === 'post'
    && method.returns.type.resultType !== undefined
    && method.finalResultStrategy.kind === 'header'
    && method.finalResultStrategy.headerName === 'location'
    && pollingStepHeaderName === 'azure-asyncoperation'
    && method.statusCodes.some(sc => sc == 200)
    && method.statusCodes.some(sc => sc == 202);

  // Match an ARM DELETE operation, which may have empty responses and only communicate via status codes
  const isArmDeleteLro = bodyFormat === 'json'
    && method.httpMethod === 'delete'
    && method.returns.type.resultType === undefined
    && method.finalResultStrategy.kind === 'header'
    && method.finalResultStrategy.headerName === 'location'
    && pollingStepHeaderName === 'location'
    && method.statusCodes.some(sc => sc == 200)
    && method.statusCodes.some(sc => sc == 202)
    && method.statusCodes.some(sc => sc == 204);

  if (isArmPutLro || isArmPatchLro) {
    body += 'let original_url = url.clone();\n';
  }
  body += `${indent.get()}async move {\n`
  body += `${indent.push().get()}let rsp = pipeline.send(&ctx, &mut ${initialRequestResult.requestVarName}, ${getPipelineOptions(indent, use, method)}).await?;\n`

  const needsMutBody = isArmPutLro || isArmPatchLro || isArmPostLro || isArmDeleteLro;
  body += `${indent.get()}let (status, headers, ${needsMutBody ? 'mut' : '' } body) = rsp.deconstruct();\n`

  if (isArmPostLro || isArmDeleteLro) {
    body += `${indent.get()}if body.is_empty() {\n`
    let emptyBodyExpr = '"{}"'
    if (isArmDeleteLro) {
      use.add('azure_core::http', 'StatusCode');
      emptyBodyExpr = `if status == StatusCode::NoContent { "{\\"status\\":\\"Succeeded\\"}" } else { "{}" }`
    }
    body += `${indent.push().get()}body = azure_core::http::response::ResponseBody::from_bytes(${emptyBodyExpr});\n`;
    body += `${indent.pop().get()}}\n`;
  }

  if (pollingStepHeaderName !== undefined) {
    body += `${indent.get()}let next_link = ${helpers.buildMatch(indent, `headers.get_optional_string(&HeaderName::from_static("${pollingStepHeaderName}"))`, [{
      pattern: 'Some(operation_location)',
      body: (indent) => {
        return `${indent.get()}Url::parse(&operation_location)?\n`;
      }
    }, {
      pattern: 'None',
      body: (indent) => {
        return `${indent.get()}${stateNextLinkAccessor}`;
      }
    }])};\n`
  }

  if (isArmPutLro || isArmPatchLro) {
    use.add('azure_core::http', 'StatusCode');
    body += `${indent.get()}let mut final_body = None;\n`;
    body += `${indent.get()}if status == StatusCode::Ok && next_link.as_str() == original_url.as_str() {\n`;
    body += `${indent.push().get()}final_body = Some(body);\n`;
    body += `${indent.get()}body = azure_core::http::response::ResponseBody::from_bytes("{\\"status\\":\\"Succeeded\\"}");\n`;
    body += `${indent.pop().get()}}\n`;
  }

  if (method.finalResultStrategy.kind === 'header' && method.finalResultStrategy.headerName !== pollingStepHeaderName) { // separate link for picking up the result
    body += `${indent.get()}let final_link = ${helpers.buildMatch(indent, `headers.get_optional_string(&HeaderName::from_static("${method.finalResultStrategy.headerName}"))`, [{
      pattern: 'Some(final_link)',
      body: (indent) => {
        return `${indent.get()}Url::parse(&final_link)?\n`;
      }
    }, {
      pattern: 'None',
      body: (indent) => {
        return `${indent.get()}progress.final_link`;
      }
    }])};\n`
  }

  body += `${indent.get()}let retry_after = get_retry_after(&headers, &[X_MS_RETRY_AFTER_MS, RETRY_AFTER_MS, RETRY_AFTER], &poller_options);\n`

  const deserialize = `${bodyFormat}::from_${bodyFormat}`;
  use.add('azure_core', bodyFormat);

  body += `${indent.push().get()}let res: ${helpers.getTypeDeclaration(helpers.unwrapType(method.returns.type))} = ${deserialize}(&body)?;\n`;

  if (method.finalResultStrategy.kind === 'header' && method.finalResultStrategy.headerName === pollingStepHeaderName) {
    body += `${indent.get()}let mut final_rsp: Option<RawResponse> = None;\n`
    body += `if res.status() == PollerStatus::Succeeded {\n`
    let responseBodyExpr = 'body.clone()';
    if (isArmPutLro || isArmPatchLro) {
      responseBodyExpr = 'if let Some(final_body) = final_body { final_body } else { body.clone() }';
    } else if (method.finalResultStrategy.propertyName !== undefined) {
      responseBodyExpr = 'body';
      if (bodyFormat === 'json') {
        body += `${indent.get()}let body = azure_core::http::response::ResponseBody::from_bytes(`
          + `serde_json::from_str::<azure_core::Value>(body.clone().into_string()?.as_str())?["${method.finalResultStrategy.propertyName}"].to_string());\n`;
      }
    }
    body += `${indent.get()}final_rsp = Some(RawResponse::from_bytes(status, headers.clone(), ${responseBodyExpr}));\n`;
    body += `}\n`;
  }

  body += `${indent.get()}let rsp = RawResponse::from_bytes(status, headers, body).into();\n`

  const arms: helpers.matchArm[] = [{
    pattern: `PollerStatus::InProgress`,
    body: (indent) => {
      return `${indent.get()}response: rsp, retry_after, next: ${pollerStatusInProgressReturn}\n`;
    },
    returns: 'PollerResult::InProgress'
  }];

  arms.push({
    pattern: `PollerStatus::Succeeded`,
    body: (indent) => {
      let body = `{\n`
        + `${indent.push().get()}PollerResult::Succeeded {\n`
        + `${indent.push().get()}response: rsp,\n`
        + `${indent.get()}target: Box::new(move || {\n`
        + `${indent.push().get()}Box::pin(async move {\n`;

      if (method.finalResultStrategy.kind === 'header' && method.finalResultStrategy.headerName === pollingStepHeaderName) {
        use.add('azure_core::error', 'Error', 'ErrorKind');
        body += `Ok(final_rsp.ok_or_else(|| { Error::new(ErrorKind::Other, "missing final response")})?.into())\n`
      } else {
        body += declareRequest(indent, use, method, paramGroups, initialRequestResult.requestVarName, 'final_link', true, '')
          + `Ok(pipeline.send(&ctx, &mut ${initialRequestResult.requestVarName}, None).await?.into())\n`
      }
      body += `${indent.pop().get()}})\n`
      + `${indent.get()}}),\n`
      + `${indent.pop().get()}}`
      + `${indent.pop().get()}}`;

      return body;
    }
  });

  arms.push({
    pattern: '_',
    body: (indent) => {
      return `${indent.get()}response: rsp`;
    },
    returns: 'PollerResult::Done'
  });

  body += `${indent.get()}Ok(${helpers.buildMatch(indent, 'res.status()', arms)})\n`;
  body += `${indent.pop().get()}}\n`; // end async move
  body += `${indent.pop().get()}},\n`; // end move
  body += `${indent.pop().get()} Some(options.method_options),))`; // end Ok/Poller::from_callback

  return body;
}

/**
 * contains the code to use when populating a client endpoint parameter value
 * from a parameter of that type.
 * @param param the param for which to get the value
 * @returns the code to use for the param's value
 */
function getClientSupplementalEndpointParamValue(param: rust.ClientSupplementalEndpointParameter): string {
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
 * returns the code to use when populating a header/path/query value
 * from a parameter of that type. this will include any borrowing of
 * the parameter (or its calculated result) as required.
 * 
 * if the param's type is a String, then the return value is simply the
 * param's name. the non-String cases require some kind of conversion.
 * this could simply be a to_string() call, e.g. "paramName.to_string()".
 * other cases might be more complex.
 * 
 * @param use the use statement builder currently in scope
 * @param param the param for which to get the value
 * @param fromSelf applicable for client params. when true, the prefix "self." is included
 * @param neverBorrow indicates that the borrowing calculation should be skipped
 * @param overrideParamName optional value to use as the parameter name instead of param.name
 * @returns the code to use for the param's value
 */
function getHeaderPathQueryParamValue(use: Use, param: HeaderParamType | PathParamType | QueryParamType, fromSelf: boolean, neverBorrow: boolean, overrideParamName?: string): string {
  let paramName = param.name;
  // when fromSelf is false we assume that there's a local with the same name.
  // e.g. in pageable methods where we need to clone the params so they can be
  // passed to a future that can outlive the calling method.
  if (param.location === 'client' && fromSelf) {
    paramName = 'self.' + paramName;
  } else if (overrideParamName) {
    paramName = overrideParamName;
  }

  const encodeBytes = function (type: rust.EncodedBytes, param?: string): string {
    const encoding = helpers.getBytesEncodingMethod(type.encoding, 'encode', use);
    if (param) {
      return `${encoding}(${param})`;
    }
    return encoding;
  };

  const encodeDateTime = function (type: rust.OffsetDateTime, paramName: string): string {
    const encoding = helpers.getDateTimeEncodingMethod(type.encoding, 'to', use);
    switch (type.encoding) {
      case 'rfc3339':
      case 'rfc7231': {
        return `${encoding}(${param.type.kind === 'ref' ? '' : '&'}${paramName})`;
      }
      case 'unix_time':
        return `${paramName}.${encoding}.to_string()`;
      default:
        // rfc3339-fixed-width isn't applicable here (it has a very specific use case)
        throw new CodegenError('InternalError', `unexpected date-time encoding ${type.encoding}`);
    }
  };

  // this will contain the final text for
  // retrieving the param value. this will include
  // any required conversions and/or borrowing
  let paramValue: string;

  // contains the result from calculating if the
  // param requires borrowing.
  let mustBorrow = !helpers.isQueryParameter(param);

  const paramType = helpers.unwrapType(param.type);
  // we want multi to hit the else case so the necessary conversions etc can happen
  if ((param.kind === 'headerCollection' || param.kind === 'queryCollection') && param.format !== 'multi') {
    if (paramType.kind === 'String' || paramType.kind === 'str') {
      paramValue = `${paramName}.join("${getCollectionDelimiter(param.format)}")`;
    } else {
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

      paramValue = `${param.name}.iter().map(${strConv}).collect::<Vec<String>>().join("${getCollectionDelimiter(param.format)}")`;
    }
  } else {
    switch (paramType.kind) {
      case 'String':
        paramValue = paramName;
        // if the param is on the client, then we must borrow
        mustBorrow = param.location === 'client' && fromSelf;
        break;
      case 'str':
        paramValue = paramName;
        // str is already borrowed
        mustBorrow = false;
        break;
      case 'decimal':
        paramValue = `${param.name}.to_string()`;
        break;
      case 'encodedBytes':
        paramValue = encodeBytes(paramType, paramName);
        break;
      case 'enum':
      case 'scalar':
        if (isEnumString(paramType) && (helpers.isPathParameter(param) || helpers.isQueryParameter(param))) {
          // append_pair and path.replace() want a reference to the string
          paramValue = `${paramName}.as_ref()`;
          // as_ref() elides the need to borrow
          mustBorrow = false;
        } else {
          paramValue = `${paramName}.to_string()`;
        }
        break;
      case 'enumValue':
        paramValue = `${paramType.type.name}::${paramType.name}.to_string()`;
        break;
      case 'literal':
        paramValue = `"${paramType.value}"`;
        break;
      case 'offsetDateTime':
        paramValue = encodeDateTime(paramType, param.name);
        break;
      default:
        throw new CodegenError('InternalError', `unhandled ${param.kind} param type kind ${paramType.kind}`);
    }
  }

  switch (param.kind) {
    case 'headerCollection':
    case 'headerHashMap':
    case 'headerScalar':
      // for non-copyable params (e.g. String), we need to borrow them if they're on the
      // client or we're in a closure and the param is required (header params are always owned)
      mustBorrow = nonCopyableType(param.type) && (param.location === 'client' || (!fromSelf && !param.optional));
      break;
  }

  return `${mustBorrow && !neverBorrow ? '&' : ''}${paramValue}`;
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

/** returns true if the type isn't copyable thus needs to be cloned or borrowed */
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

/**
 * returns an instantiation of pipeline options or None
 * if no options are required.
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param method the method for which to construct the pipeline options
 * @returns the pipeline options text
 */
function getPipelineOptions(indent: helpers.indentation, use: Use, method: ClientMethod): string {
  let options = '';
  if (method.statusCodes.length != 0) {
    let pipelineOptions: string;
    switch (method.returns.type.kind) {
      case 'asyncResponse':
        pipelineOptions = 'PipelineStreamOptions';
        break;
      default:
        pipelineOptions = 'PipelineSendOptions';
        break;
    }
    use.add("azure_core::http", pipelineOptions);
    use.add("azure_core::error", "CheckSuccessOptions");
    options += `Some(${pipelineOptions} {\n`;
    indent.push();
    options += `${indent.get()}check_success: CheckSuccessOptions{ success_codes: &[${method.statusCodes.join(', ')}]},\n`;
    options += `${indent.get()}..Default::default()\n`;
    options += `${indent.pop().get()}})`;
    return options;
  } else {
    return 'None';
  }
}

/** narrows type to an Enum type IFF its underlying type is String within the conditional block */
function isEnumString(type: rust.Type): type is rust.Enum {
  const unwrapped = helpers.unwrapType(type);
  return unwrapped.kind === 'enum' && unwrapped.type === 'String';
}
