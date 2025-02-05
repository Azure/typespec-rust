/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import turndownService from 'turndown';
import * as rust from '../codemodel/index.js';

/**
 * fixes up enum names to follow Rust conventions
 * 
 * @param name the name to fix up
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueName(name: string): string {
  name = codegen.capitalize(name);

  // first replace any '.' chars between numbers with the word 'Dot'
  // any '.' between a letter and a numer will be removed.
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

  // if we have a name like V2022_12_01_preview, we want to
  // turn this into V2022_12_01Preview to make the linter happy
  const parts = name.split(/(?:_|-)/);
  if (parts.length > 1) {
    name = '';
    for (let i = 0; i < parts.length; ++i) {
      if (parts[i].match(/^[a-zA-Z]{2,}$/)) {
        parts[i] = codegen.pascalCase(parts[i]);
      } else {
        parts[i] = codegen.capitalize(parts[i]);
      }
      name += parts[i];
      if (i + 1 < parts.length && parts[i].match(/\d+$/) && parts[i + 1].match(/^\d/)) {
        name += '_';
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

/**
 * if type is an Option<T>, returns the T, else returns type
 * 
 * @param type the type to unwrap
 * @returns the unwrapped type. can be the original value if no unwrapping was required
 */
export function unwrapOption(type: rust.Type): rust.Type {
  if (type.kind === 'option') {
    return type.type;
  }
  return type;
}

// used by formatDocs
const tds = new turndownService({codeBlockStyle: 'fenced', fence: '```'});

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
  if (docs.match(/<[a-zA-Z]+/)) {
    docs = tds.turndown(docs);
  }

  // enclose any hyperlinks in angle brackets
  const match = docs.match(/\s(http[s]?:\/\/[^\s]+)\s/i);
  if (match) {
    docs = docs.replace(match[1], `<${match[1]}>`);
  }
  return docs;
}
