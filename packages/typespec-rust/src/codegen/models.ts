/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Context } from './context.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

// emits the models.rs file for this crate
export function emitModels(crate: rust.Crate, context: Context): string {
  if (crate.models.length === 0) {
    return '';
  }

  const use = new Use('models');
  use.addTypes('serde', ['Deserialize', 'Serialize']);
  use.addType('typespec_client_core', 'Model');

  const indentation = new helpers.indentation();

  let body = '';
  for (const model of crate.models) {
    body += helpers.formatDocComment(model.docs);
    body += helpers.annotationDerive('Default', 'Model');
    body += helpers.AnnotationNonExhaustive;
    body += `pub struct ${model.name} {\n`;

    for (const field of model.fields) {
      use.addForType(field.type);
      body += helpers.formatDocComment(field.docs);
      const serdeParams = new Array<string>();
      if (field.name !== field.serde) {
        // only emit the serde annotation when the names aren't equal
        serdeParams.push(`rename = "${field.serde}"`);
      }

      // TODO: omit skip_serializing_if if we need to send explicit JSON null
      // https://github.com/Azure/typespec-rust/issues/78
      if (field.type.kind === 'option') {
        serdeParams.push('skip_serializing_if = "Option::is_none"');
      }

      if (serdeParams.length > 0) {
        body += `${indentation.get()}#[serde(${serdeParams.join(', ')})]\n`;
      }
      body += `${indentation.get()}${helpers.emitPub(field.pub)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n\n`;
    }

    body += '}\n\n';
  }

  // emit TryFrom as required
  for (const model of crate.models) {
    body += context.getTryFromForRequestContent(model, use);
    body += context.getTryFromResponseForType(model, use);
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return content;
}
