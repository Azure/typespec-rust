/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as tcgc from '@azure-tools/typespec-client-generator-core';

/**
 * if name is a reserved word, append the suffix and return the result, else return name.
 * the suffix indicates the context in which name appears
 * 
 * @param name the name to potentially fix up
 * @param suffix the context in which name appears
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function getEscapedReservedName(name: string, suffix: 'fn' | 'param' | 'prop'): string {
  if (reservedWords.has(name)) {
    name = `${name}_${suffix}`;
  }
  return name;
}

// https://doc.rust-lang.org/reference/keywords.html
const reservedWords = new Set<string>(
  [
    // strict keywords
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn',
    'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self',
    'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',

    // reserved keywords
    'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'try', 'typeof', 'unsized', 'virtual', 'yield',

    // weak keywords
    'macro_rules', 'union', '\'static',
  ]
);

/**
 * fixes up enum value names to follow Rust conventions
 * 
 * @param enumValue the enum value type to fix up
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueName(enumValue: tcgc.SdkEnumValueType): string {
  return fixUpEnumValueNameWorker(enumValue.name);
}

/**
 * split out from fixUpEnumValueName for testing purposes.
 * don't call this directly, call fixUpEnumValueName instead.
 * 
 * @param name the enum value name
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueNameWorker(name: string): string {
  const chunks = codegen.deconstruct(name).map((each) => codegen.capitalize(each));
  let fixedName = chunks[0];
  for (let i = 1; i < chunks.length; ++i) {
    const chunk = chunks[i];
    const prevChunk = chunks[i - 1];

    if (chunk.match(/^\d+/) && prevChunk.match(/\d+$/)) {
      // concatenating something like 3.14 or v2022-01
      fixedName += `_${chunk}`;
    } else {
      fixedName += chunk;
    }
  }

  if (fixedName.match(/^\d/)) {
    fixedName = `INVLD_IDENTIFIER_${fixedName}`;
  }

  return fixedName;
}
