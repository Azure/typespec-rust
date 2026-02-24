/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Use } from './use.js';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';
import {Context} from "./context.js";
import * as utils from '../utils/utils.js';

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
 * module contains no union types.
 *
 * @param module the module for which to emit unions
 * @param context the context for the provided module
 * @returns the union content or undefined
 */
export function emitUnions(module: rust.ModuleContainer, context: Context): Unions {
  if (module.unions.length === 0) {
    return {};
  }

  const use = new Use(module, 'modelsOther');
  const indent = new helpers.indentation();
  const visTracker = new helpers.VisibilityTracker();

  let body = '';
  for (const rustUnion of module.unions) {
    visTracker.update(rustUnion.visibility);
    const docs = helpers.formatDocComment(rustUnion.docs, true);
    if (docs.length > 0) {
      body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
    }

    const extensiblePolymorphicDU = rustUnion.unionKind?.kind === 'discriminatedUnionBase' ? rustUnion.unionKind : undefined;
    if (!extensiblePolymorphicDU) {
      // extensible polymorphic unions define Serialize
      use.add('serde', 'Serialize');
    }

    use.add('serde', 'Deserialize');
    use.add('azure_core::fmt', 'SafeDebug');
    body += `#[derive(Clone, Deserialize, ${!extensiblePolymorphicDU ? 'Serialize, ' : ''}SafeDebug)]\n`;

    const content = rustUnion.unionKind?.kind === 'discriminatedUnionEnvelope' ? `content = "${rustUnion.unionKind.envelopeName}"` : '';
    body += `#[serde(${[content, `tag = "${rustUnion.discriminant}"`].filter(x => x !== '').join(', ')})]\n`;
    body += `${helpers.emitVisibility(rustUnion.visibility)}enum ${rustUnion.name} {\n`;

    for (const member of rustUnion.members) {
      use.addForType(member.type);

      const docs = helpers.formatDocComment(member.docs, true);
      if (docs.length > 0) {
        body += `${indent.get()}#[doc = r#"${docs.substring(0, docs.length - 1)}"#]\n`;
      }

      if (member.discriminantValue !== member.type.name) {
        body += `#[serde(rename = "${member.discriminantValue}")]\n`;
      }
      body += `${indent.get()}${member.type.name}(${helpers.getTypeDeclaration(member.type)})`;
      body += ',\n\n';
    }

    if (extensiblePolymorphicDU) {
      body += `${indent.get()}#[serde(untagged)]\n`;
      body += `${indent.get()}${getPolymorphicUnknownVariant(indent, use, extensiblePolymorphicDU, rustUnion.discriminant, false)},\n`;
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
    impls: emitUnionImpls(module, context),
    serde: emitUnionSerde(module),
  };
}

/**
 * gets the name for the unknown variant entry in a tagged enum.
 * 
 * @param discriminant the name of the discriminant field
 * @returns the name to use for the unknown variant
 */
function getPolymorphicUnknownVariantName(discriminant: string): string {
  return `Unknown${utils.capitalize(discriminant)}`;
}

/**
 * gets the type definition for the unknown variant entry in a tagged enum.
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param baseType the base type in a polymorphic discriminated union
 * @param discriminant the name of the discriminant field
 * @param abbreviated when true, the abbreviated type definition is returned
 * @returns the unknown variant type definition
 */
function getPolymorphicUnknownVariant(indent: helpers.indentation, use: Use, baseType: rust.DiscriminatedUnionBase, discriminant: string, abbreviated: boolean): string {
  let unknownDef = `${getPolymorphicUnknownVariantName(discriminant)} {${abbreviated ? '' : '\n'}`;
  indent.push();
  for (const field of baseType.baseType.fields) {
    if (!abbreviated) {
      unknownDef += helpers.formatDocComment(field.docs, false, undefined, indent);
    }
    use.addForType(field.type);
    if (abbreviated) {
      unknownDef += `${field.name}, `;
    } else {
      unknownDef += `${indent.get()}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n\n`;
    }
  }
  unknownDef += `${abbreviated ? '' : indent.pop().get()}}`;
  return unknownDef;
}

/**
 * returns any trait impls for union types.
 * if no helpers are required, undefined is returned.
 * 
 * @param module the module for which to emit model impls
 * @param context the context for the provided module
 * @returns the union impls content or undefined
 */
function emitUnionImpls(module: rust.ModuleContainer, context: Context): helpers.Module | undefined {
  const use = new Use(module, 'modelsOther');
  const entries = new Array<string>();

  for (const rustUnion of module.unions) {
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
 * @param module the module for which to emit model impls
 * @returns the union serde helpers or undefined
 */
function emitUnionSerde(module: rust.ModuleContainer): helpers.Module | undefined {
  if (module.unions.length === 0) {
    return undefined;
  }

  const use = new Use(module, 'modelsOther');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustUnion of module.unions) {
    if (!isPolymorphicDU(rustUnion.unionKind) || rustUnion.unionKind.kind !== 'discriminatedUnionBase') {
      continue;
    }

    use.addForType(rustUnion);

    // for extensible polymorphic DUs we must implement Serialize
    const unionBaseKind = rustUnion.unionKind;
    use.add('serde', 'Serialize', 'Serializer');
    body += `impl Serialize for ${rustUnion.name} {\n`;
    body += `${indent.get()}fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: Serializer {\n`;
    const matchArms = rustUnion.members.map((member) => {
      use.addForType(member.type);
      const instanceVar = utils.snakeCaseName(member.type.name);
      return {
        pattern: `${rustUnion.name}::${member.type.name}(${instanceVar})`,
        body: (indent: helpers.indentation) => `${indent.get()}${member.type.name}::serialize(${instanceVar}, serializer)\n`,
      }
    });

    // this is the match arm for the unknown variant
    matchArms.push({
      pattern: `${indent.get()}${rustUnion.name}::${getPolymorphicUnknownVariant(indent, use, unionBaseKind, rustUnion.discriminant, true)}`,
      body: (indent) => {
        let content = `${indent.push().get()}#[derive(Serialize)]\n`;
        const unknownVariantName = getPolymorphicUnknownVariantName(rustUnion.discriminant);
        content += `${indent.get()}struct ${unknownVariantName}<'a> {\n`;
        indent.push();
        for (const field of unionBaseKind.baseType.fields) {
          if (field.kind === 'additionalProperties') {
            // TODO
            continue;
          }
          content += `${indent.get()}#[serde(skip_serializing_if = "Option::is_none")]\n`;
          content += `${indent.get()}${field.name}: &'a ${helpers.getTypeDeclaration(field.type)},\n`;
        }
        content += `${indent.pop().get()}}\n`;
        content += `${indent.get()}${unknownVariantName}::serialize(&${unknownVariantName} { ${unionBaseKind.baseType.fields.map((field) => field.name).join(', ')} }, serializer)\n`;
        return content;
      },
    });
    body += `${indent.get()}${helpers.buildMatch(indent, 'self', matchArms)}\n`;
    body += `${indent.pop().get()}}\n`; // end fn
    body += '}\n\n'; // end impl
  }

  if (body === '') {
    return undefined;
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'unions_serde',
    content: content,
    visibility: 'internal',
  };
}

/** narrows duKind to the applicable DU type within the conditional block */
function isPolymorphicDU(duKind?: rust.DiscriminatedUnionKind): duKind is rust.DiscriminatedUnionBase | rust.DiscriminatedUnionSealed {
  if (!duKind) {
    return false;
  }
  switch (duKind.kind) {
    case 'discriminatedUnionBase':
    case 'discriminatedUnionSealed':
      return true;
    default:
      return false;
  }
}
