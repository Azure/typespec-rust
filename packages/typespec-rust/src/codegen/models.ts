/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

// emits the models.rs file for this crate
export function emitModels(crate: rust.Crate): string {
  if (crate.structs.length === 0) {
    return '';
  }

  let content = helpers.contentPreamble();
  content += 'use serde::{Deserialize, Serialize};\n';

  // extra new-line after all use statements
  content += '\n';

  for (const struct of crate.structs) {
    content += helpers.formatDocComment(struct.docs);
    content += '#[derive(Clone, Default, Deserialize, Serialize)]\n';
    content += '#[non_exhaustive]';
    content += `${helpers.emitPub(struct.pub)}struct ${struct.name} {\n`;

    for (const field of struct.fields) {
      content += `${helpers.indent(1)}#[serde(rename = "${field.serde}")]\n`;
      content += `${helpers.indent(1)}${helpers.emitPub(field.pub)}${field.name}: Option<${helpers.getTypeDeclaration(field.type)}>,\n`;
    }

    content += '}\n\n';
  }

  return content;
}
