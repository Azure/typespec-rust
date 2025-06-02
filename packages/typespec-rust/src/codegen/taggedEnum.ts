/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/**
 * returns the emitted tagged enum types, or undefined if the
 * crate contains no tagged enum types.
 * 
 * @param crate the crate for which to emit tagged enums
 * @returns the tagged enum content or undefined
 */
export function emitTaggedEnums(crate: rust.Crate): helpers.Module | undefined {
  if (crate.taggedEnums.length === 0) {
    return undefined;
  }

  const use = new Use('modelsOther');
  use.add('azure_core', 'fmt::SafeDebug');
  use.add('serde', 'Deserialize', 'Serialize');

  const indent = new helpers.indentation();

  let body = '';
  for (const taggedEnum of crate.taggedEnums) {
    body += helpers.formatDocComment(taggedEnum.docs);
    body += helpers.annotationDerive('azure_core::http::Model');
    body += `${helpers.emitVisibility(taggedEnum.visibility)}enum ${taggedEnum.name} {\n`;

    for (const value of taggedEnum.values) {
      use.addForType(value.value);
      body += helpers.formatDocComment(value.docs);
      body += `${indent.get()}${value.name}(${value.value.name}),\n`;
    }

    body += '}\n\n'; // end tagged enum
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'tagged_enums',
    content: content,
  };
}
