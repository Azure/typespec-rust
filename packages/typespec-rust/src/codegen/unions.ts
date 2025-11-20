/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Use } from './use.js';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';
import {Context} from "./context.js";

/** contains different types of content to emit */
export interface Models {
  /** types that are part of public surface area */
  public?: helpers.Module;

  /** trait impls for public types */
  impls?: helpers.Module;
}

/**
 * returns the union enum types, or undefined if the
 * crate contains no union types.
 *
 * @param crate the crate for which to emit unions
 * @param context the context for the provided crate
 * @returns the union content or undefined
 */
export function emitUnions(crate: rust.Crate, context: Context): Models {
  if (crate.unions.length === 0) {
    return {};
  }

  const use = new Use('modelsOther');
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
    const content = rustUnion.envelopeName ? `content = "${rustUnion.envelopeName}"` : '';
    body += `#[serde(${[content, `tag = "${rustUnion.discriminant}"`].filter(x => x !== '').join(', ')})]\n`;
    body += `pub enum ${rustUnion.name} {\n`;

    for (let i = 0; i < rustUnion.members.length; ++i) {
      const member = rustUnion.members[i];
      const memberType = member.type;
      use.addForType(member.type);

      const docs = helpers.formatDocComment(member.docs, true);
      if (docs.length > 0) {
        body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
      }

      if (member.discriminantValue !== member.type.name) {
        body += `#[serde(rename = "${member.discriminantValue}")]\n`;
      }
      body += `${indent.get()}${member.type.name}(${helpers.getTypeDeclaration(memberType)})`;
      body += ',\n\n';
    }

    body += '}\n\n'; // end enum declaration
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    public: {
      name: 'unions',
      content: content,
    },
    impls: emitUnionImpls(crate, context),
  };
}

/**
 * returns any trait impls for union types.
 * if no helpers are required, undefined is returned.
 * 
 * @param crate the crate for which to emit model impls
 * @param context the context for the provided crate
 * @returns the union impls content or undefined
 */
function emitUnionImpls(crate: rust.Crate, context: Context): helpers.Module | undefined {
  const use = new Use('modelsOther');
  const entries = new Array<string>();

  for (const rustUnion of crate.unions) {
    const forReq = context.getTryFromForRequestContent(rustUnion, use);

    // helpers aren't required for all types, so only
    // add a use statement for a type if it has a helper
    if (forReq) {
      use.addForType(rustUnion);
      entries.push(forReq);
    }
  }

  if (entries.length === 0) {
    // no helpers
    return undefined;
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += entries.sort().join('');

  return {
    name: 'unions_impl',
    content: content,
  };
}
