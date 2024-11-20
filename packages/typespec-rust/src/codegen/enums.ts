/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Context } from './context.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/**
 * returns the emitted enum types, or undefined if the
 * crate contains no enum types.
 * 
 * @param crate the crate for which to emit enums
 * @param context the context for the provided crate
 * @returns the enum content or undefined
 */
export function emitEnums(crate: rust.Crate, context: Context): string | undefined {
  if (crate.enums.length === 0) {
    return undefined;
  }

  const use = new Use('models');
  // note that create_extensible_enum uses create_enum, so it will always be used
  use.addType('typespec_client_core', 'create_enum');

  const indent = new helpers.indentation();

  let body = '';
  for (const rustEnum of crate.enums) {
    let enumType = 'create_enum';
    if (rustEnum.extensible) {
      use.addType('typespec_client_core', 'create_extensible_enum');
      enumType = 'create_extensible_enum';
    }

    body += `${enumType}!(\n`;
    const docs = helpers.formatDocComment(rustEnum.docs);
    if (docs.length > 0) {
      body += `${indent.get()}#[doc = r#"${docs}"#]\n`;
    }
    body += `${indent.get()}${rustEnum.name},\n`;

    for (let i = 0; i < rustEnum.values.length; ++i) {
      const value = rustEnum.values[i];
      const docs = helpers.formatDocComment(value.docs);
      if (docs.length > 0) {
        body += `${indent.get()}#[doc = r#"${docs}"#]\n`;
      }
      // TODO: hard-coded String type
      // https://github.com/Azure/typespec-rust/issues/25
      body += `${indent.get()}(${value.name}, "${value.value}")`;
      if (i + 1 < rustEnum.values.length) {
        body += ',';
      }
      body += '\n';
    }

    body += ');\n\n'; // end enum macro
  }

  // emit TryFrom as required
  for (const rustEnum of crate.enums) {
    body += context.getTryFromForRequestContent(rustEnum, use);
    body += context.getTryFromResponseForType(rustEnum, use);
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return content;
}
