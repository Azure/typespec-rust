/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { CodegenError } from './errors.js';
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
  const srcTraits = new Map<string, Array<rust.ResponseHeadersTrait>>();

  for (const client of crate.clients) {
    for (const method of client.methods) {
      if (method.kind === 'clientaccessor') {
        continue;
      } else if (method.responseHeaders) {
        let entry = srcTraits.get(method.responseHeaders.name);
        if (!entry) {
          entry = new Array<rust.ResponseHeadersTrait>();
          srcTraits.set(method.responseHeaders.name, entry);
        }
        entry.push(method.responseHeaders);
      }
    }
  }

  if (srcTraits.size === 0) {
    return undefined;
  }

  const headers = new Array<rust.ResponseHeader>();
  const traits = new Array<rust.ResponseHeadersTrait>();

  /** adds response headers to headers, avoiding duplicates */
  const addHeaders = function (...responseHeaders: Array<rust.ResponseHeader>): void {
    for (const responseHeader of responseHeaders) {
      if (!headers.find(v => v.header === responseHeader.header)) {
        headers.push(responseHeader);
      }
    }
  };

  for (const srcTrait of srcTraits.values()) {
    if (srcTrait.length === 1) {
      // no traits to merge, just add and move on
      traits.push(srcTrait[0]);
      addHeaders(...srcTrait[0].headers);
      continue;
    }

    // for traits with multiple impls, merge them into a single trait
    const mergedHeaders = new Array<rust.ResponseHeader>();
    let mergedDocs = '/// Provides access to typed response headers for the following methods:\n';
    for (const src of srcTrait) {
      mergedDocs += `/// * ${src.docs}\n`;

      for (const responseHeader of src.headers) {
        const matchingHeader = mergedHeaders.find(h => h.header === responseHeader.header);
        if (!matchingHeader) {
          mergedHeaders.push(responseHeader);
        } else if (matchingHeader.type !== responseHeader.type) {
          // overlapping headers with different types
          throw new CodegenError('InternalError', 'overlapping headers');
        }
      }
    }

    const mergedTrait = new rust.ResponseHeadersTrait(srcTrait[0].name, srcTrait[0].implFor, mergedDocs);
    mergedTrait.headers = mergedHeaders;
    traits.push(mergedTrait);
    addHeaders(...mergedHeaders);
  }

  headers.sort((a: rust.ResponseHeader, b: rust.ResponseHeader) => helpers.sortAscending(getHeaderConstName(a), getHeaderConstName(b)));
  traits.sort((a: rust.ResponseHeadersTrait, b: rust.ResponseHeadersTrait) => helpers.sortAscending(a.name, b.name));

  // this specializes literals to return the value's underlying type
  const getTypeDeclaration = function (type: rust.Type): string {
    if (type.kind === 'literal') {
      switch (typeof type.value) {
        case 'boolean':
          return 'bool';
        case 'number':
          return 'i64';
        case 'string':
          return 'String';
        default:
          throw new CodegenError('InternalError', `unhandled literal type ${typeof type.value}`);
      }
    } else {
      return helpers.getTypeDeclaration(type);
    }
  };

  const getHeaderMethodName = function (header: rust.ResponseHeader): string {
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
    return `fn ${header.name}(&self) -> Result<${resultType}>`;
  };

  const use = new Use('modelsOther');
  use.add('azure_core', 'Result');
  use.add('azure_core::http', 'headers::HeaderName', 'Response');

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
    if (trait.docs.startsWith('///')) {
      // this trait was merged earlier so the doc comments are already baked
      body += trait.docs;
    } else {
      body += `\n/// Provides access to typed response headers for ${trait.docs}\n`;
    }
    body += `pub trait ${trait.name}: private::Sealed {\n`;
    for (const header of trait.headers) {
      use.addForType(header.type);
      body += `${indent.get()}${getHeaderMethodName(header)};\n`;
    }
    body += '}\n\n';

    use.addForType(trait.implFor);
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

  use.add('azure_core::http', 'headers::Headers');

  switch (header.type.kind) {
    case 'encodedBytes': {
      const decoder = helpers.getBytesEncodingMethod(header.type.encoding, 'decode', use);
      return `${indent.get()}Headers::get_optional_with(self.headers(), &${headerConstName}, |h| ${decoder}(h.as_str()))\n`;
    }
    case 'enum':
    case 'scalar':
    case 'String':
      return `${indent.get()}Headers::get_optional_as(self.headers(), &${headerConstName})\n`
    case 'offsetDateTime': {
      const timeParse = `parse_${header.type.encoding}`;
      use.add('azure_core', `time::${timeParse}`);
      return `${indent.get()}Headers::get_optional_with(self.headers(), &${headerConstName}, |h| ${timeParse}(h.as_str()))\n`;
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
function getSealedImpls(traitDefs: Array<rust.ResponseHeadersTrait>): string {
  const use = new Use('modelsOther');
  const indent = new helpers.indentation();
  use.add('azure_core::http', 'Response');

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
