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
  content += 'use serde::{Deserialize, Serialize};\n\n';

  for (const rustEnum of crate.enums) {
    content += helpers.formatDocComment(rustEnum.docs);
    // only derive Copy for fixed enums
    content += `#[derive(Clone, ${rustEnum.extensible ? '' : 'Copy, '}Debug, Deserialize, Serialize)]\n`;
    content += '#[non_exhaustive]\n';
    content += `${helpers.emitPub(rustEnum.pub)}enum ${rustEnum.name} {\n`;

    for (const value of rustEnum.values) {
      content += `${helpers.indent(1)}#[serde(rename = "${value.value}")]\n`;
      content += `${helpers.indent(1)}${value.name},\n`;
    }

    if (rustEnum.extensible) {
      content += `${helpers.indent(1)}#[serde(untagged)]\n`;
      // TODO: hard-coded String type
      content += `${helpers.indent(1)}UnknownValue(String),\n`;
    }
    content += '}\n\n';
  }

  return content;
}
