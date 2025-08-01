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

  // Split the name into tokens based on separators and word boundaries
  const tokens = splitIntoTokens(name);
  
  // Transform each token to PascalCase and join them back
  name = '';
  for (let i = 0; i < tokens.length; ++i) {
    const transformedToken = transformToken(tokens[i]);
    name += transformedToken;
    
    // Add underscore between adjacent numeric tokens to maintain readability
    if (i + 1 < tokens.length && 
        tokens[i].match(/\d+$/) && 
        tokens[i + 1].match(/^\d/)) {
      name += '_';
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

/**
 * Splits a string into tokens based on explicit separators and implicit word boundaries
 * 
 * @param name the string to tokenize
 * @returns array of tokens
 */
function splitIntoTokens(name: string): string[] {
  // First check if we have explicit separators
  const separatorPattern = /(?:_|-|\/|\+|\.)/;
  if (separatorPattern.test(name)) {
    // Split on explicit separators and further split each part on word boundaries
    const parts = name.split(separatorPattern);
    const tokens: string[] = [];
    for (const part of parts) {
      if (part) { // Skip empty parts
        tokens.push(...splitOnWordBoundaries(part));
      }
    }
    return tokens;
  } else {
    // No explicit separators, split only on word boundaries
    return splitOnWordBoundaries(name);
  }
}

/**
 * Splits a string on word boundaries (number-letter, letter-number, case transitions)
 * 
 * @param str the string to split
 * @returns array of tokens
 */
function splitOnWordBoundaries(str: string): string[] {
  // Split on transitions: number-to-letter, letter-to-number, lowercase-to-uppercase, 
  // or uppercase-to-uppercase followed by lowercase (e.g. XMLHttp -> XML, Http)
  const tokens = str.split(/(?<=\d)(?=[A-Za-z])|(?<=[a-zA-Z])(?=\d)|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  return tokens.filter(token => token.length > 0);
}

/**
 * Transforms a single token to PascalCase
 * 
 * @param token the token to transform
 * @returns the transformed token
 */
function transformToken(token: string): string {
  // For tokens with 2+ letters, use pascalCase to handle all-caps correctly
  if (token.match(/^[a-zA-Z]{2,}$/)) {
    return codegen.pascalCase(token);
  } else {
    // For single letters, numbers, or mixed content, use capitalize
    return codegen.capitalize(token);
  }
}
