/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Use } from './use.js';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * returns the union enum types, or undefined if the
 * crate contains no union types.
 *
 * @param crate the crate for which to emit unions
 * @returns the union content or undefined
 */
export function emitUnions(crate: rust.Crate): helpers.Module | undefined {
  if (crate.unions.length === 0) {
    return undefined;
  }

  const use = new Use('clients');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustUnion of crate.unions) {
    body += `pub enum ${rustUnion.name} {\n`;
    const docs = helpers.formatDocComment(rustUnion.docs, true);
    if (docs.length > 0) {
      body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
    }

    for (let i = 0; i < rustUnion.members.length; ++i) {
      const member = rustUnion.members[i];
      const memberType = member.type;
      use.addForType(member.type);
      body += `${indent.get()}${member.name}(${helpers.getTypeDeclaration(memberType)})`;
      if (i + 1 < rustUnion.members.length) {
        body += ',';
      }
      body += '\n';
    }

    body += '}\n\n'; // end enum declaration
  }


  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'unions',
    content: content,
  };
}
