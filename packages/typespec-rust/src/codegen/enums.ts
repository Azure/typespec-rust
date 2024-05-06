/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

// emits the enums.rs file for this crate
export function emitEnums(crate: rust.Crate): string {
  if (crate.enums.length === 0) {
    return '';
  }

  let content = helpers.contentPreamble();
  content += helpers.UseSerDe;

  // extra new-line after all use statements
  content += '\n';

  for (const rustEnum of crate.enums) {
    content += helpers.formatDocComment(rustEnum.docs);
    // only derive Copy for fixed enums
    content += helpers.annotationDerive(!rustEnum.extensible ? 'Copy' : '', 'Eq', 'PartialEq');
    content += helpers.AnnotationNonExhaustive;
    content += `${helpers.emitPub(rustEnum.pub)}enum ${rustEnum.name} {\n`;

    for (const value of rustEnum.values) {
      if (value.name !== value.value) {
        // only emit the serde annotation when the names aren't equal
        content += `${helpers.indent(1)}#[serde(rename = "${value.value}")]\n`;
      }
      content += `${helpers.indent(1)}${value.name},\n`;
    }

    if (rustEnum.extensible) {
      content += `${helpers.indent(1)}#[serde(untagged)]\n`;
      // TODO: hard-coded String type
      // https://github.com/Azure/autorest.rust/issues/25
      content += `${helpers.indent(1)}UnknownValue(String),\n`;
    }
    content += '}\n\n';
  }

  return content;
}
