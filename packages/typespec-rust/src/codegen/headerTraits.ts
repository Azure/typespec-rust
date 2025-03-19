/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/**
 * returns the emitted header traits, or undefined if there
 * are no header traits.
 * the header traits provide access to typed response headers
 * 
 * @param crate the crate for which to emit header traits
 * @returns the header traits content or undefined
 */
export function emitHeaderTraits(crate: rust.Crate): helpers.Module | undefined {
  interface clientMethod {
    client: rust.Client;
    method: Exclude<rust.MethodType, rust.ClientAccessor>;
  }

  const clientMethodsWithResponseHeaders = new Array<clientMethod>();
  for (const client of crate.clients) {
    for (const method of client.methods) {
      if (method.kind === 'clientaccessor') {
        continue;
      }

      if (method.responseHeaders.length > 0) {
        clientMethodsWithResponseHeaders.push({
          client: client,
          method: method,
        });
      }
    }
  }

  if (clientMethodsWithResponseHeaders.length === 0) {
    return undefined;
  }

  // fold headers across method return types into the same trait.
  // e.g. DoFoo() Response<Model> and DoBar() Response<Model> methods
  // return (unique) headers, they will be folded into one trait.
  // it does mean that headers unique to a method will be absent from
  // the response of the other method.

  const headers = new Array<rust.ResponseHeader>();
  const traits = new Array<TraitDefinition>();

  for (const clientMethod of clientMethodsWithResponseHeaders) {
    const client = clientMethod.client;
    const method = clientMethod.method;

    if (method.returns.type.kind !== 'response') {
      throw new Error(`unexpected method return kind ${method.returns.type.kind}`);
    } else if (method.returns.type.content.kind !== 'marker' && method.returns.type.content.kind !== 'payload') {
      throw new Error(`unexpected method content kind ${method.returns.type.content.kind}`);
    }

    for (const responseHeader of method.responseHeaders) {
      if (!headers.find(v => v.header === responseHeader.header)) {
        headers.push(responseHeader);
      }
    }

    // if this trait is already implemented for a Response<T>
    // then just add any new headers to it
    const trait = traits.find(v => helpers.getTypeDeclaration(v.implFor) === helpers.getTypeDeclaration(method.returns.type));
    if (trait) {
      for (const responseHeader of method.responseHeaders) {
        const matchingHeader = trait.headers.find(h => h.header === responseHeader.header);
        if (!matchingHeader) {
          trait.headers.push(responseHeader);
        } else if (matchingHeader.type !== responseHeader.type) {
          // overlapping headers with different types
          throw new Error('overlapping headers');
        }
      }
      continue;
    }

    let traitName: string;
    switch (method.returns.type.content.kind) {
      case 'marker':
        traitName = `${method.returns.type.content.name}Headers`;
        break;
      case 'payload':
        traitName = `${helpers.getTypeDeclaration(method.returns.type.content.type)}Headers`;
        // Response<Vec<SignedIdentifier>> becomes VecSignedIdentifierHeaders
        traitName = traitName.replace(/(?:<|>)/g, '');
        break;
    }

    traits.push({
      name: traitName,
      docs: `Provides access to typed response headers for [\`${client.name}::${method.name}()\`](crate::clients::${client.name}::${method.name}())`,
      headers: [...method.responseHeaders], // make a copy of the headers array
      implFor: method.returns.type,
    })
  }

  headers.sort((a: rust.ResponseHeader, b: rust.ResponseHeader) => helpers.sortAscending(getHeaderConstName(a), getHeaderConstName(b)));
  traits.sort((a: TraitDefinition, b: TraitDefinition) => helpers.sortAscending(a.name, b.name));

  // this specializes literals to return the value's underlying type
  const getTypeDeclaration = function(type: rust.Type): string {
    if (type.kind === 'literal') {
      switch (typeof type.value) {
        case 'boolean':
          return 'bool';
        case 'number':
          return 'i64';
        case 'string':
          return 'String';
        default:
          throw new Error(`unhandled literal type ${typeof type.value}`);
      }
    } else {
      return helpers.getTypeDeclaration(type);
    }
  };

  const getHeaderMethodName = function(header: rust.ResponseHeader): string {
    let resultType: string;
    switch (header.kind) {
      case 'responseHeaderHashMap':
        // HashMaps aren't wrapped in an Option<T> as an
        // empty HashMap communicates the same thing.
        resultType = getTypeDeclaration(header.type);
        break;
      case 'responseHeaderScalar':
        resultType = `Option<${getTypeDeclaration(header.type)}>`;
        break;
    }
    return `fn ${codegen.deconstruct(header.name).join('_')}(&self) -> Result<${resultType}>`;
  };

  const use = new Use();
  use.addTypes('azure_core', ['headers::HeaderName', 'Response', 'Result']);

  const indent = new helpers.indentation();

  let body = '';
  for (const header of headers) {
    const headerValue = header.header.toLowerCase();
    switch (header.kind) {
      case 'responseHeaderHashMap':
        // we add a trailing - as the entire str prefix will be stripped off
        body += `const ${getHeaderConstName(header)}: &str = "${headerValue}-";\n`;
        break;
      case 'responseHeaderScalar':
        body += `const ${getHeaderConstName(header)}: HeaderName = HeaderName::from_static("${headerValue}");\n`;
    }
  }

  for (const trait of traits) {
    body += `\n/// ${trait.docs}\n`;
    body += `pub trait ${trait.name}: private::Sealed {\n`;
    for (const header of trait.headers) {
      use.addForType(header.type);
      body += `${indent.get()}${getHeaderMethodName(header)};\n`;
    }
    body += '}\n\n';

    use.addForType(helpers.unwrapType(trait.implFor));
    body += `impl ${trait.name} for ${helpers.getTypeDeclaration(trait.implFor)} {\n`;
    for (const header of trait.headers) {
      body += helpers.formatDocComment(header.docs);
      body += `${indent.get()}${getHeaderMethodName(header)} {\n`;
      body += getHeaderDeserialization(indent.push(), use, header);
      body += `${indent.pop().get()}}\n\n`;
    }
    body += '}\n\n';
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;
  content += getSealedImpls(traits);

  return {
    name: 'header_traits',
    content: content,
  };
}

/**
 * creates the name to use for a header constant
 * e.g. header Content-Type becomes CONTENT_TYPE
 * 
 * @param header the name of the header
 * @returns the header constant
 */
function getHeaderConstName(header: rust.ResponseHeader): string {
  // strip off any x-ms- prefix
  const chunks = codegen.deconstruct(header.header.replace(/^x-ms-/i, ''));
  return `${chunks.map(i => i.toUpperCase()).join('_')}`;
}

/**
 * returns the body of a header trait method,
 * performing any deserialization as required.
 * 
 * @param indent the indentation helper currently in scope
 * @param header the header to deserialize
 * @returns the header method body
 */
function getHeaderDeserialization(indent: helpers.indentation, use: Use, header: rust.ResponseHeader): string {
  const headerConstName = getHeaderConstName(header);

  if (header.kind === 'responseHeaderHashMap') {
    let content = `${indent.get()}let mut values = HashMap::new();\n`;
    content += `${indent.get()}for h in self.headers().iter() {\n`;
    content += `${indent.push().get()}let name = h.0.as_str();\n`;
    content += `${indent.get()}${helpers.buildIfBlock(indent, {
      condition: `name.len() > ${headerConstName}.len() && name.starts_with(${headerConstName})`,
      body: (indent) => `${indent.get()}values.insert(name[${headerConstName}.len()..].to_owned(), h.1.as_str().to_owned());\n`,
    })}`;
    content += `${indent.pop().get()}}\n`; // end for
    content += 'Ok(values)\n';
    return content;
  }

  switch (header.type.kind) {
    case 'encodedBytes': {
      use.addTypes('azure_core', ['base64', 'headers::Headers']);
      const decoder = header.type.encoding === 'std' ? 'decode' : 'decode_url_safe';
      return `${indent.get()}Headers::get_optional_with(self.headers(), &${headerConstName}, |h| base64::${decoder}(h.as_str()))\n`;
    }
    case 'enum':
    case 'scalar':
    case 'String':
      use.addType('azure_core', 'headers::Headers');
      return `${indent.get()}Headers::get_optional_as(self.headers(), &${headerConstName})\n`
    case 'offsetDateTime': {
      use.addTypes('azure_core', ['date', 'headers::Headers']);
      return `${indent.get()}Headers::get_optional_with(self.headers(), &${headerConstName}, |h| date::parse_${header.type.encoding}(h.as_str()))\n`;
    }
    default:
      return `${indent.get()}todo!();\n`;
  }
}

/**
 * returns the mod private {...} section used to seal the header traits.
 * 
 * @param traitDefs the trait definitions to seal
 * @returns the private mod definition
 */
function getSealedImpls(traitDefs: Array<TraitDefinition>): string {
  const use = new Use();
  const indent = new helpers.indentation();

  const implsFor = new Array<string>();
  for (const traitDef of traitDefs) {
    use.addForType(traitDef.implFor);
    implsFor.push(`impl Sealed for ${helpers.getTypeDeclaration(traitDef.implFor)} {}`);
  }

  implsFor.sort();

  let content = '\nmod private {\n';
  content += use.text(indent);
  content += `${indent.get()}pub trait Sealed {}\n\n`;
  for (const implFor of implsFor) {
    content += `${indent.get()}${implFor}\n`;
  }
  content += '}\n\n'; // end mod private

  return content;
}

/** defines a header response trait */
interface TraitDefinition {
  /** name of the trait */
  name: string;

  /** doc string for the trait */
  docs: string;

  /** the headers in the trait */
  headers: Array<rust.ResponseHeader>;

  /** the type for which to implement the trait */
  implFor: rust.Response;
}
