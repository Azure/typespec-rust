/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as linkifyjs from 'linkifyjs';
import turndownService from 'turndown';
import * as rust from '../codemodel/index.js';

/**
 * fixes up enum names to follow Rust conventions
 * 
 * @param enumValue the enum value type to fix up
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueName(enumValue: tcgc.SdkEnumValueType): string {
  return fixUpEnumValueNameWorker(enumValue.name, enumValue.valueType.kind);
}

/**
 * split out from fixUpEnumValueName for testing purposes.
 * don't call this directly, call fixUpEnumValueName instead.
 * 
 * @param name the enum value name
 * @param kind the enum value's underlying kind
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueNameWorker(name: string, kind: tcgc.SdkBuiltInKinds): string {
  // if the name starts with a number, then add its kind as a prefix.
  // we insert 'Value' between the kind and name to simplify reading,
  // e.g. Int32Value123 instead of Int32123.
  if (name.match(/^\d+/)) {
    name = `${kind}Value${name}`;
  }

  // if the enum is a decimal/float, then replace . with Point instead of Dot below
  switch (kind) {
    case 'decimal':
    case 'decimal128':
    case 'float':
    case 'float32':
    case 'float64':
      name = name.replace('.', 'Point');
  }

  name = codegen.capitalize(name);

  // first replace any '.' chars between numbers with the word 'Dot'
  // any '.' between a letter and a number will be removed.
  // e.g. V7.6_preview.1 becomes V7Dot6_preview1
  const numDotNumMatch = name.match(/(\d+\.\d+)/);
  if (numDotNumMatch) {
    name = name.replace(numDotNumMatch[0], numDotNumMatch[0].replace('.', 'Dot'));
  }

  const wordDotNumMatch = name.match(/\w+\.\d+/);
  if (wordDotNumMatch) {
    name = name.replace(wordDotNumMatch[0], wordDotNumMatch[0].replace('.', ''));
  }

  // remove any commas (e.g. value name Foo,Bar becomes FooBar)
  name = name.replace(',', '');

  // application/*+json becomes ApplicationAllJson
  name = name.replace(/\/\*\+/, 'All');

  // if we have a name like V2022_12_01_preview, we want to
  // turn this into V2022_12_01Preview to make the linter happy
  const parts = name.split(/(?:_|-|\/|\+|\.)/);
  if (parts.length > 1) {
    name = '';
    for (let i = 0; i < parts.length; ++i) {
      if (parts[i].match(/^[a-zA-Z]{2,}$/)) {
        parts[i] = codegen.pascalCase(parts[i]);
      } else if (parts[i].length > 1 && parts[i].match(/[a-zA-Z]/) && parts[i].match(/\d/)) {
        // For mixed alphanumeric parts like "OAEP256", apply word boundary detection
        const wordBoundaryParts = parts[i].split(/(?<=\d)(?=[A-Za-z])|(?<=[a-zA-Z])(?=\d)|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
        if (wordBoundaryParts.length > 1) {
          let transformedPart = '';
          for (let j = 0; j < wordBoundaryParts.length; ++j) {
            const subPart = wordBoundaryParts[j];
            if (subPart.match(/^[a-zA-Z]{2,}$/)) {
              transformedPart += codegen.pascalCase(subPart);
            } else {
              transformedPart += codegen.capitalize(subPart);
            }
          }
          parts[i] = transformedPart;
        } else {
          parts[i] = codegen.capitalize(parts[i]);
        }
      } else {
        parts[i] = codegen.capitalize(parts[i]);
      }
      name += parts[i];
      if (i + 1 < parts.length && parts[i].match(/\d+$/) && parts[i + 1].match(/^\d/)) {
        name += '_';
      }
    }
  } else {
    // For strings without explicit separators, detect word boundaries and apply PascalCase
    // Split on transitions: number-to-letter, letter-to-number, uppercase-to-number, or lowercase-to-uppercase
    const wordBoundaryParts = name.split(/(?<=\d)(?=[A-Za-z])|(?<=[a-zA-Z])(?=\d)|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    if (wordBoundaryParts.length > 1) {
      name = '';
      for (let i = 0; i < wordBoundaryParts.length; ++i) {
        const part = wordBoundaryParts[i];
        if (part.match(/^[a-zA-Z]{2,}$/)) {
          wordBoundaryParts[i] = codegen.pascalCase(part);
        } else {
          wordBoundaryParts[i] = codegen.capitalize(part);
        }
        name += wordBoundaryParts[i];
      }
    }
  }

  return name;
}

/**
 * sorts client params in place so they're in the order, endpoint, [credential], other
 * 
 * @param params the client parameters to sort
 */
export function sortClientParameters(params: Array<rust.ClientParameter>): void {
  params.sort((a: rust.ClientParameter, b: rust.ClientParameter): number => {
    if (a.name === 'endpoint' || (a.name === 'credential' && b.name !== 'endpoint')) {
      // endpoint always comes first, followed by credential (if applicable)
      return -1;
    }
    return 0;
  });
}

// used by formatDocs
const tds = new turndownService({ codeBlockStyle: 'fenced', fence: '```' });

/**
 * applies certain formatting to a doc string.
 * if the doc string doesn't require formatting
 * the original doc string is returned.
 * 
 * @param docs the doc string to format
 * @returns the original or formatted doc string
 */
export function formatDocs(docs: string): string {
  // if the docs contain any HTML, convert it to markdown
  if (docs.match(/<[a-z]+[\s\S]+\/[a-z]+>/i)) {
    docs = tds.turndown(docs);
  }

  // enclose any hyperlinks in angle brackets
  const links = linkifyjs.find(docs, 'url');
  for (const link of links) {
    const enclosed = `<${link.href}>`;

    // don't enclose hyperlinks that are already enclosed or are markdown
    if (!docs.includes(enclosed) && !docs.includes(`(${link.href})`)) {
      docs = docs.replace(link.href, enclosed);
    }
  }

  return docs;
}
