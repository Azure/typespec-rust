/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Use } from './use.js';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';
import {Context} from "./context.js";

/**
 * returns the union enum types, or undefined if the
 * crate contains no union types.
 *
 * @param crate the crate for which to emit unions
 * @param context the context for the provided crate
 * @returns the union content or undefined
 */
export function emitUnions(crate: rust.Crate, context: Context): helpers.Module | undefined {
  if (crate.unions.length === 0) {
    return undefined;
  }

  const use = new Use('clients');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustUnion of crate.unions) {
    const docs = helpers.formatDocComment(rustUnion.docs, true);
    if (docs.length > 0) {
      body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
    }

    use.add('serde', 'Deserialize', 'Serialize');
    use.add('azure_core::fmt', 'SafeDebug');
    body += `#[derive(Deserialize, Serialize, SafeDebug, Clone)]\n`;
    const tag = (rustUnion.discriminatorName !== "") ? `tag = "${rustUnion.discriminatorName}"` : '';
    const content = (rustUnion.envelopeName !== "") ? `content = "${rustUnion.envelopeName}"` : '';
    if (tag !== '' || content !== '') {
      body += `#[serde(${[tag, content].filter(x => x !== '').join(', ')})]\n`;
    }
    body += `pub enum ${rustUnion.name} {\n`;

    for (let i = 0; i < rustUnion.members.length; ++i) {
      const member = rustUnion.members[i];
      const memberType = member.type;
      use.addForType(member.type);

      const docs = helpers.formatDocComment(member.docs, true);
      if (docs.length > 0) {
        body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
      }

      if (member.discriminatorValue !== member.name) {
        body += `#[serde(rename = "${member.discriminatorValue}")]\n`;
      }
      body += `${indent.get()}${member.name}(${helpers.getTypeDeclaration(memberType)})`;
      body += ',\n\n';
    }

    body += '}\n\n'; // end enum declaration
  }

  for (const rustUnion of crate.unions) {
    body += context.getTryFromForRequestContent(rustUnion, use);
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'unions',
    content: content,
  };
}
