/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

// emits the models.rs file for this crate
export function emitModels(crate: rust.Crate): string {
  if (crate.models.length === 0) {
    return '';
  }

  let content = helpers.contentPreamble();
  content += helpers.UseSerDe;

  // extra new-line after all use statements
  content += '\n';

  for (const model of crate.models) {
    content += helpers.formatDocComment(model.docs);
    content += helpers.annotationDerive(false, 'Default');
    content += helpers.AnnotationNonExhaustive;
    content += `${helpers.emitPub(model.pub)}struct ${model.name} {\n`;

    for (const field of model.fields) {
      if (field.name !== field.serde) {
        // only emit the serde annotation when the names aren't equal
        content += `${helpers.indent(1)}#[serde(rename = "${field.serde}")]\n`;
      }
      content += `${helpers.indent(1)}${helpers.emitPub(field.pub)}${field.name}: Option<${helpers.getTypeDeclaration(field.type)}>,\n`;
    }

    content += '}\n\n';
  }

  return content;
}
