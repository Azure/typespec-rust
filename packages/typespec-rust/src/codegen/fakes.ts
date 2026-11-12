/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../codemodel/index.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as utils from '../utils/utils.js';
import { methodParameters, requiredConstructorParameters, supplementalEndpoint } from './parameters.js';

export const fakeGate = '#[cfg(all(feature = "test", feature = "unstable_fake"))]';
type Operation = Exclude<rust.MethodType, rust.ClientAccessor>;

interface Argument {
  name: string;
  param: rust.MethodParameter;
  type: rust.Type;
  source: string;
  optional: boolean;
}

export function fakeModuleName(client: rust.Client): string {
  return utils.snakeCaseName(client.name);
}

function serverName(client: rust.Client): string {
  return `${client.name.replace(/Client$/, '')}Server`;
}

function operationName(client: rust.Client, method: Operation): string {
  return `${fakeModuleName(client)}_${method.name.replace(/^r#/, '')}`;
}

function synthetic(params: Array<{ name: string }>, name: string): string {
  // Only names emitted in this scope can collide; optional fields and body inputs
  // must not force a positional parameter to be renamed against itself.
  return helpers.getUniqueVarName(params, [name]);
}

function publicPath(module: rust.ModuleContainer): string {
  return utils.buildImportPath(module, module).replace(/::generated$/, '');
}

function argumentsFor(method: Operation): Array<Argument> {
  // Normal signatures omit client inputs. Capturing them would add clones and
  // expose arguments that callers never pass to this operation.
  const params = method.params.filter(p => p.location === 'method' && p.kind !== 'body' && p.kind !== 'partialBody'
    && !['literal', 'enumValue'].includes(helpers.unwrapType(p.type).kind));
  return params.map(param => {
    const optionField = param.optional ? method.options.type.type.fields.find(f => f.name === param.name) : undefined;
    const location = param.kind.startsWith('path') ? 'path' : param.kind.startsWith('query') ? 'query' : 'header';
    const name = params.filter(p => p.name === param.name).length > 1 ? `${location}_${param.name}` : param.name;
    return {
      name,
      param,
      type: optionField?.type ?? param.type,
      source: param.optional
        ? `options.${param.name}` : param.group ? `${param.group.name}.${param.name}` : param.name,
      optional: param.optional,
    };
  });
}

function captureFor(method: Operation): {
  args: Array<Argument>;
  fields: Array<{ name: string; type: string; value: string }>;
  frequency: string;
  present: string;
} {
  const args = argumentsFor(method);
  const fields = args.map(a => ({ name: a.name, type: ownedType(a.type), value: own(a.type, a.source) }));
  const frequency = synthetic(fields, 'frequency');
  if (method.kind === 'lro') fields.push({ name: frequency, type: 'azure_core::time::Duration', value: 'options.method_options.frequency' });
  const present = synthetic(fields, 'body_present');
  const body = method.params.find(p => p.kind === 'body' && p.optional);
  // Empty content is a valid Some value. Retain presence, never the body itself,
  // so dispatch can forward the post-policy body without inspecting its length.
  if (body) fields.push({ name: present, type: 'bool', value: `options.${body.name}.is_some()` });
  return { args, fields, frequency, present };
}

function signatureFor(client: rust.Client, method: Operation): Array<{ name: string; type: rust.Type }> {
  const spread = method.params.filter(p => p.kind === 'partialBody');
  const params = methodParameters(method).filter(p => !spread.some(s => s.name === p.name));
  // Spread fields have already been serialized and may name private helper
  // models. Keep their assembled body opaque instead of decoding it to fields.
  if (spread.length) {
    const content = { name: synthetic([...params, method.options], 'content'), type: new rust.ExternalType(helpers.getCrate(client.module), 'Body', 'azure_core::http') };
    const first = methodParameters(method).findIndex(p => spread.some(s => s.name === p.name));
    params.splice(first < 0 ? params.length : first, 0, content);
  }
  return params;
}

function ownedType(type: rust.Type): string {
  switch (type.kind) {
    case 'ref': return ownedType(type.type);
    case 'str': return 'String';
    case 'slice': return `Vec<${ownedType(type.type)}>`;
    case 'encodedBytes': return 'Vec<u8>';
    case 'option': return `Option<${ownedType(type.type)}>`;
    case 'Vec': return `Vec<${ownedType(type.type)}>`;
    case 'hashmap': return `std::collections::HashMap<String, ${ownedType(type.type)}>`;
    default: return helpers.getTypeDeclaration(type, 'anonymous');
  }
}

function own(type: rust.Type, expression: string): string {
  if (copyable(type)) return expression;
  switch (type.kind) {
    case 'ref': return own(type.type, `*(${expression})`);
    case 'str': return `(${expression}).to_owned()`;
    case 'encodedBytes': return `(${expression}).to_vec()`;
    case 'slice':
    case 'Vec': return borrowed(type.type)
      ? `(${expression}).iter().map(|value| ${own(type.type, '*value')}).collect()`
      : `(${expression}).to_vec()`;
    case 'option': return borrowed(type.type)
      ? `(${expression}).as_ref().map(|value| ${own(type.type, '*value')})` : `(${expression}).clone()`;
    case 'hashmap': return borrowed(type.type)
      ? `(${expression}).iter().map(|(key, value)| (key.clone(), ${own(type.type, '*value')})).collect()` : `(${expression}).clone()`;
    default: return `(${expression}).clone()`;
  }
}

/** Captures only typed non-body values, never an options object containing context. */
export function emitFakeCapture(client: rust.Client, method: Operation): string {
  if (!helpers.getCrate(client.module).generateFakes || method.visibility !== 'pub') return '';
  const { fields } = captureFor(method);
  if (!fields.length) return '';
  const values = fields.map(f => f.value);
  return `${fakeGate}\nlet options = {\nlet mut options = options;\n`
    + `${publicPath(client.module)}::clients::fake::capture_${operationName(client, method)}(&mut options.method_options.context, ${values.join(', ')});\noptions\n};\n`;
}

function descendants(client: rust.Client): Array<rust.Client> {
  const clients = new Set<rust.Client>();
  const visit = (current: rust.Client): void => {
    if (clients.has(current)) return;
    clients.add(current);
    current.methods.forEach(m => { if (m.kind === 'clientaccessor') visit(m.returns); });
  };
  visit(client);
  return [...clients];
}

function traitPath(client: rust.Client): string {
  return `${publicPath(client.module)}::clients::fake::${serverName(client)}`;
}

export function emitFakes(module: rust.ModuleContainer): Array<helpers.Module> {
  return module.clients.map(client => {
    const use = new Use(module, 'clients');
    use.add('async_trait', 'async_trait');
    let body = '';
    const methods = client.methods.filter((m): m is Operation => m.kind !== 'clientaccessor' && m.visibility === 'pub');
    if (methods.length || client.constructable) use.add('azure_core', 'Result');
    if (methods.length) use.add('azure_core::http', 'AsyncRawResponse');
    for (const method of methods) {
      const capture = captureFor(method);
      if (!capture.fields.length) continue;
      const name = operationName(client, method);
      capture.args.forEach(a => useOwnedType(use, a.type));
      const fields = capture.fields.map(f => `${f.name}: ${f.type}`);
      const context = synthetic(capture.fields, 'context');
      body += `struct ${utils.pascalCase(name, false)}Arguments { ${fields.join(', ')} }\n`;
      body += `#[allow(clippy::too_many_arguments)]\npub(crate) fn capture_${name}(${context}: &mut azure_core::http::Context<'_>, ${fields.join(', ')}) {\n`
        + `${context}.insert(${utils.pascalCase(name, false)}Arguments { ${capture.fields.map(f => f.name).join(', ')} });\n}\n`;
    }

    const children = client.methods.filter((m): m is rust.ClientAccessor => m.kind === 'clientaccessor');
    const bounds = ['Send', 'Sync', ...children.map(c => traitPath(c.returns))];
    body += `/// Fake server for [\`${client.name}\`](${publicPath(module)}::clients::${client.name}).\n`
      + '///\n/// Implement the operations used by your test. Implement unused child server traits with an empty `impl`.\n'
      + '///\n/// # Panics\n/// Default operation implementations call [`unimplemented!()`].\n'
      + `#[async_trait]\npub trait ${serverName(client)}: ${[...new Set(bounds)].join(' + ')} {\n`;
    for (const method of methods) {
      // Share the ordinary signature rules: groups stay grouped, optional bodies
      // stay in options, and names/types/order do not depend on transport location.
      const signature = signatureFor(client, method);
      const params = signature.map(p => `${p.name}: ${declaration(p.type)}`);
      signature.forEach(p => use.addForType(p.type));
      signature.filter(p => p.type.kind === 'struct').forEach(p => use.add(`${publicPath(module)}::models`, (p.type as rust.Struct).name));
      const names = [...signature, method.options];
      // State and the current LRO request describe transport steps, not extra
      // service arguments. Allocate these additions after the ordinary names.
      if (method.kind === 'pageable') {
        use.add('azure_core::http::pager', 'PagerState');
        const state = synthetic(names, 'state');
        names.push({ name: state, type: method.options.type });
        params.push(`${state}: PagerState`);
      } else if (method.kind === 'lro') {
        use.add('azure_core::http::poller', 'PollerState');
        use.add('azure_core::http', 'Request');
        const state = synthetic(names, 'state');
        names.push({ name: state, type: method.options.type });
        const request = synthetic(names, 'request');
        names.push({ name: request, type: method.options.type });
        params.push(`${state}: PollerState`, `${request}: &Request`);
      }
      use.add(`${publicPath(module)}::models`, method.options.type.type.name);
      use.addForType(method.options.type.type.fields.find(f => f.name === 'method_options')!.type);
      params.push(`${method.options.name}: ${helpers.getTypeDeclaration(method.options.type, 'anonymous')}`);
      body += `/// Handles [\`${client.name}::${method.name}()\`](${publicPath(module)}::clients::${client.name}::${method.name}).\n`;
      if (method.kind === 'lro') body += '/// The request and opaque content belong to the current HTTP step, not necessarily initiation.\n';
      if (method.name.startsWith('from_')) body += '#[allow(clippy::wrong_self_convention)]\n';
      body += `#[allow(clippy::too_many_arguments)]\nasync fn ${method.name}(&self, ${params.join(', ')}) -> Result<AsyncRawResponse> {\n`
        + `let _ = (${names.map(p => p.name).join(', ')},);\n`
        + `unimplemented!("${serverName(client)}::${method.name} is not implemented")\n}\n`;
    }
    body += '}\n';
    body += emitFakeDispatch(client);
    if (client.constructable) body += emitTransport(client, use);
    return { name: fakeModuleName(client), content: helpers.contentPreamble() + use.text() + body, visibility: 'pubUse' };
  });
}

function emitTransport(client: rust.Client, use: Use): string {
  use.add('std::sync', 'Arc');
  use.add('azure_core', 'Error');
  use.add('azure_core::error', 'ErrorKind');
  use.add('azure_core::http', 'Context', 'Request', 'Pipeline', 'Transport', 'Url');
  use.add('azure_core::http::policies', 'Policy', 'PolicyResult');
  const name = `${client.name}Transport`;
  let body = `struct ${name}<T: ${serverName(client)} + ?Sized> { server: Arc<T> }\n`
    + `impl<T: ${serverName(client)} + ?Sized> std::fmt::Debug for ${name}<T> {\n`
    + 'fn fmt(&self, f: &mut std::fmt::Formatter<\'_>) -> std::fmt::Result { f.write_str("FakeTransport { .. }") }\n}\n'
    + `#[async_trait]\nimpl<T: ${serverName(client)} + ?Sized> Policy for ${name}<T> {\n`
    + 'async fn send(&self, context: &Context, request: &mut Request, _next: &[Arc<dyn Policy>]) -> PolicyResult {\n'
    + 'let _ = &self.server;\n'
    + 'let api_name = azure_core::http::fake::get_api_name(context).ok_or_else(|| Error::with_message(ErrorKind::Other, "missing API name in request context"))?;\n'
    + 'let _ = &request;\n';
  let dispatch = '';
  for (const current of descendants(client)) {
    for (const method of current.methods) {
      if (method.kind === 'clientaccessor' || method.visibility !== 'pub') continue;
      const helperPath = `${publicPath(current.module)}::clients::fake::${fakeModuleName(current)}`;
      dispatch += `"${method.languageIndependentName}" => {\n`;
      // Dispatch remains inside the owning module so argument payloads stay private.
      dispatch += `${helperPath}::dispatch_${method.name.replace(/^r#/, '')}(&*self.server, context, request, api_name).await\n},\n`;
    }
  }
  const unknown = 'Err(Error::with_message(ErrorKind::Other, format!("unknown API name \'{api_name}\' in request context")))';
  body += dispatch ? `match api_name {\n${dispatch}_ => ${unknown},\n}\n` : `${unknown}\n`;
  body += '}\n}\n';
  body += emitFakeConstructor(client, name, use);
  return body;
}

export function emitFakeDispatch(client: rust.Client): string {
  let body = '';
  for (const method of client.methods) {
    if (method.kind === 'clientaccessor' || method.visibility !== 'pub') continue;
    const { args, fields: captures, frequency, present } = captureFor(method);
    const name = operationName(client, method);
    body += `pub(crate) async fn dispatch_${method.name.replace(/^r#/, '')}<T: ${serverName(client)} + ?Sized>(server: &T, context: &azure_core::http::Context<'_>, request: &mut azure_core::http::Request, api_name: &str) -> azure_core::Result<azure_core::http::AsyncRawResponse> {\n`;
    body += 'let _ = (&request, api_name);\n';
    if (captures.length) {
      body += `let arguments = context.value::<${utils.pascalCase(name, false)}Arguments>().ok_or_else(|| azure_core::Error::with_message(azure_core::error::ErrorKind::Other, format!("{api_name}: missing operation arguments in request context")))?;\n`;
    }
    const bodyParam = method.params.find(p => p.kind === 'body');
    const calls = signatureFor(client, method).map(param => {
      if (param.type.kind === 'external' && param.type.name === 'Body') return 'request.body().clone()';
      if (param.type.kind === 'requestContent') return 'request.body().clone().into()';
      if (param.type.kind === 'struct') {
        const group = param.type;
        const values = args.filter(a => a.param.group?.name === param.name)
          .map(a => `${a.param.name}: ${borrow(a.param.type, `arguments.${a.name}`)}`);
        return `${group.name} { ${values.join(', ')} }`;
      }
      const arg = args.find(a => a.param.name === param.name)!;
      return borrow(arg.param.type, `arguments.${arg.name}`);
    });
    if (method.kind !== 'async') {
      const state = method.kind === 'pageable' ? 'azure_core::http::pager::PagerState' : 'azure_core::http::poller::PollerState';
      body += `let state = context.value::<${state}>().ok_or_else(|| azure_core::Error::with_message(azure_core::error::ErrorKind::Other, format!("{api_name}: missing operation state in request context")))?;\n`;
      calls.push('state.clone()');
      if (method.kind === 'lro') calls.push('request');
    }
    const optionsType = method.options.type.type;
    const fields = args.filter(a => a.optional).map(a => `${a.param.name}: ${own(a.type, `arguments.${a.name}`)}`);
    if (bodyParam?.optional) {
      fields.push(`${bodyParam.name}: if arguments.${present} { Some(request.body().clone().into()) } else { None }`);
    }
    const methodOptionsType = optionsType.fields.find(f => f.name === 'method_options')!.type;
    fields.push(`method_options: ${helpers.getTypeDeclaration(methodOptionsType, 'omit').replace(/<.*$/, '')} {\ncontext: context.to_owned(),\n`
      + (method.kind === 'pageable' ? 'continuation: match state { azure_core::http::pager::PagerState::Initial => None, azure_core::http::pager::PagerState::More(value) => Some(value.clone()) },\n' : '')
      + (method.kind === 'lro' ? `frequency: arguments.${frequency},\n` : '') + '}');
    if (optionsType.fields.some(f => f.name !== 'method_options' && !(bodyParam?.optional && bodyParam.name === f.name) && !args.some(a => a.optional && a.param.name === f.name))) fields.push('..Default::default()');
    calls.push(`Some(${optionsType.name} { ${fields.join(', ')} })`);
    body += `${serverName(client)}::${method.name}(server, ${calls.join(', ')}).await\n}\n`;
  }
  return body;
}

function emitFakeConstructor(client: rust.Client, transport: string, use: Use): string {
  const construction = client.constructable!;
  use.add(publicPath(client.module), client.name, construction.options.type.name);
  use.add('azure_core', 'tracing');
  const params = ['endpoint: &str', `server: Arc<impl ${serverName(client)} + ?Sized + 'static>`];
  const fields: Array<string> = [];
  // Match modeled constructor parameters, including supplemental URL inputs that
  // are consumed during construction rather than stored as client fields.
  const constructor = construction.constructors[0];
  for (const param of requiredConstructorParameters(constructor.params)) {
    if (param.kind === 'clientEndpoint' || param.kind === 'clientCredential') continue;
    use.addForType(param.type);
    params.push(`${param.name}: ${helpers.getTypeDeclaration(param.type)}`);
  }
  for (const field of client.fields) {
    if (field.name === 'pipeline') continue;
    if (field.name === client.endpoint.name) {
      fields.push(field.name === 'endpoint' ? 'endpoint' : `${field.name}: endpoint`);
    } else if (construction.options.type.fields.some(f => f.name === field.name)) {
      fields.push(`${field.name}: options.${field.name}`);
    } else {
      fields.push(field.name);
    }
  }
  params.push(`options: Option<${construction.options.type.name}>`);
  const options = 'options.client_options';
  fields.push(`pipeline: Pipeline::new(option_env!("CARGO_PKG_NAME"), option_env!("CARGO_PKG_VERSION"), ${options}, Vec::new(), Vec::new(), None)`);
  return `impl ${client.name} {\n`
    + '/// Creates a credential-free client backed by a fake server.\n'
    + '///\n/// Other policies and client options are preserved.\n'
    + '///\n/// # Errors\n/// Returns an error if a transport is configured or the endpoint is not a valid URL.\n'
    + `${fakeGate}\n#[tracing::new("${client.languageIndependentName}")]\n`
    + `pub fn with_fake(${params.join(', ')}) -> Result<Self> {\n`
    + 'let mut options = options.unwrap_or_default();\n'
    // Fakes use an explicit parseable endpoint without cloud/auth resolution or
    // the real constructor's HTTP-only restriction, but share server path joins.
    + `let ${construction.endpoint ? 'mut ' : ''}endpoint = Url::parse(endpoint)?;\n`
    + supplementalEndpoint(new helpers.indentation(0), 'endpoint', construction.endpoint)
    + `if ${options}.transport.is_some() { return Err(Error::with_message(ErrorKind::Other, "a transport cannot be specified when using a fake server")); }\n`
    + `${options}.transport = Some(Transport::with_policy(Arc::new(${transport} { server })));\n`
    + `Ok(Self { ${fields.join(', ')} })\n}\n}\n`;
}

function declaration(type: rust.Type): string {
  return helpers.getTypeDeclaration(type, 'anonymous').replace(/'[a-z]\w*/g, "'_");
}

function useOwnedType(use: Use, type: rust.Type): void {
  switch (type.kind) {
    case 'ref':
    case 'option':
    case 'slice':
    case 'Vec':
    case 'hashmap': useOwnedType(use, type.type); break;
    default: use.addForType(type);
  }
}

function borrow(type: rust.Type, expression: string): string {
  if (type.kind === 'ref') {
    if (type.type.kind === 'str') return `(${expression}).as_str()`;
    if (type.type.kind === 'encodedBytes' && type.type.slice) return `(${expression}).as_slice()`;
    if (type.type.kind === 'slice' && borrowed(type.type.type)) {
      return `&${expression}.iter().map(|value| ${borrow(type.type.type, '*value')}).collect::<Vec<_>>()`;
    }
    return `&(${expression})`;
  }
  return own(type, expression);
}

function borrowed(type: rust.Type): boolean {
  switch (type.kind) {
    case 'ref':
    case 'str':
    case 'slice': return true;
    case 'option':
    case 'Vec':
    case 'hashmap': return borrowed(type.type);
    case 'encodedBytes': return type.slice;
    default: return false;
  }
}

function copyable(type: rust.Type): boolean {
  switch (type.kind) {
    case 'scalar':
    case 'offsetDateTime':
    case 'decimal':
    case 'safeint': return true;
    case 'enum': return !type.extensible || type.type !== 'String';
    case 'option': return copyable(type.type);
    default: return false;
  }
}
