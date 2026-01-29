/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Use } from './use.js';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';
import {Context} from "./context.js";

/** contains unions to emit */
export interface Unions {
  /** union definitions */
  definitions?: helpers.Module;

  /** trait impls for union types */
  impls?: helpers.Module;

  /** serde helpers for union types */
  serde?: helpers.Module;
}

/**
 * returns the union enum types, or undefined if the
 * crate contains no union types.
 *
 * @param crate the crate for which to emit unions
 * @param context the context for the provided crate
 * @returns the union content or undefined
 */
export function emitUnions(crate: rust.Crate, context: Context): Unions {
  if (crate.unions.length === 0) {
    return {};
  }

  const use = new Use('modelsOther');
  const indent = new helpers.indentation();
  const visTracker = new helpers.VisibilityTracker();

  let body = '';
  for (const rustUnion of crate.unions) {
    visTracker.update(rustUnion.visibility);
    const docs = helpers.formatDocComment(rustUnion.docs, true);
    if (docs.length > 0) {
      body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
    }

    const unionMembers = new Array<rust.DiscriminatedUnionMember | rust.Model>(...rustUnion.members);
    if (rustUnion.unionKind?.kind === 'discriminatedUnionBase') {
      unionMembers.push(rustUnion.unionKind.baseType);
      unionMembers.sort((a: rust.DiscriminatedUnionMember | rust.Model, b: rust.DiscriminatedUnionMember | rust.Model) => {
        const aName = a.kind === 'discriminatedUnionMember' ? a.type.name : a.name;
        const bName = b.kind === 'discriminatedUnionMember' ? b.type.name : b.name;
        return helpers.sortAscending(aName, bName);
      });
    }

    use.add('serde', 'Serialize');
    const needsDeserialize = !rustUnion.unionKind || rustUnion.unionKind.kind !== 'discriminatedUnionBase';
    if (needsDeserialize) {
      // discriminatedUnionBase unions explicitly define Deserialize
      use.add('serde', 'Deserialize');
    }
    use.add('azure_core::fmt', 'SafeDebug');
    body += `#[derive(Clone, ${needsDeserialize ? 'Deserialize, ' : ''}Serialize, SafeDebug)]\n`;
    const content = rustUnion.unionKind?.kind === 'discriminatedUnionEnvelope' ? `content = "${rustUnion.unionKind.envelopeName}"` : '';
    body += `#[serde(${[content, `tag = "${rustUnion.discriminant}"`].filter(x => x !== '').join(', ')})]\n`;
    body += `${helpers.emitVisibility(rustUnion.visibility)}enum ${rustUnion.name} {\n`;

    for (const member of unionMembers) {
      const memberType = member.kind === 'discriminatedUnionMember' ? member.type : member;
      use.addForType(memberType);

      // don't duplicate the docs for the base model type (already emitted with the model def)
      if (member.kind === 'discriminatedUnionMember') {
        const docs = helpers.formatDocComment(member.docs, true);
        if (docs.length > 0) {
          body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
        }
      }

      if (member.kind === 'discriminatedUnionMember' && member.discriminantValue !== member.type.name) {
        // we don't rename the base type for polymorphic DUs since it's
        // the fallback for cases not defined by the tsp and instances of
        // the base type aren't actually returned.
        body += `#[serde(rename = "${member.discriminantValue}")]\n`;
      }
      body += `${indent.get()}${memberType.name}(${helpers.getTypeDeclaration(memberType)})`;
      body += ',\n\n';
    }

    body += '}\n\n'; // end enum declaration
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    definitions: {
      name: 'unions',
      content: content,
      visibility: visTracker.get(),
    },
    impls: emitUnionImpls(crate, context),
    serde: emitUnionSerde(crate),
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
    visibility: 'internal',
  };
}

/**
 * returns the content for unions_serde.rs.
 * if no helpers are required, undefined is returned.
 * 
 * @param crate the crate for which to emit model impls
 * @returns the union serde helpers or undefined
 */
function emitUnionSerde(crate: rust.Crate): helpers.Module | undefined {
  if (crate.unions.length === 0) {
    return undefined;
  }

  const use = new Use('modelsOther');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustUnion of crate.unions) {
    if (!rustUnion.unionKind || rustUnion.unionKind.kind !== 'discriminatedUnionBase') {
      continue;
    }

    use.addForType(rustUnion);
    body += `impl<'de> Deserialize<'de> for ${rustUnion.name} {\n`;
    body += `${indent.get()}fn deserialize<D>(deserializer: D) -> Result<Self, D::Error> where D: serde::Deserializer<'de> {\n`;
    body += `${indent.push().get()}let value = Value::deserialize(deserializer)?;\n`;
    const matchArms = rustUnion.members.map((member) => {
      return {
        pattern: `Some("${member.discriminantValue}")`,
        body: (indent: helpers.indentation) => {
          use.addForType(member.type);
          return `${indent.get()}${member.type.name}::deserialize(&value).map(${rustUnion.name}::${member.type.name}).map_err(serde::de::Error::custom)\n`
        },
      }
    });

    const baseType = rustUnion.unionKind.baseType;
    use.addForType(baseType);
    matchArms.push({
      pattern: '_',
      body: (indent: helpers.indentation) => `${indent.get()}${baseType.name}::deserialize(&value).map(${rustUnion.name}::${baseType.name}).map_err(serde::de::Error::custom)\n`,
    });

    body += `${indent.get()}${helpers.buildMatch(indent, `value.get("${rustUnion.discriminant}").and_then(Value::as_str)`, matchArms)}\n`;
    body += `${indent.pop().get()}}\n`; // end fn
    body += '}\n\n'; // end impl
  }

  if (body === '') {
    return undefined;
  }

  // all cases require these
  use.add('azure_core', 'Value');
  use.add('serde', 'Deserialize');

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'unions_serde',
    content: content,
    visibility: 'internal',
  };
}
