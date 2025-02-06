/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

const beginDelimiter = '// BEGIN GENERATED CODE -- do not edit from here till END';
const endDelimiter = '// END GENERATED CODE';

/**
 * emits the contents of the lib.rs file
 * 
 * @param crate the crate for which to emit a lib.rs file
 * @param existingLibRs contents of preexisting lib.rs file
 * @returns the contents of the lib.rs file
 */
export function emitLibRs(crate: rust.Crate, existingLibRs?: string): string {
  const generatedContent = getGeneratedContent(crate);

  // if there's no preexisting lib.rs file or there's
  // no begin delimiter then just overwrite the file.
  if (!existingLibRs || existingLibRs.indexOf(beginDelimiter) === -1) {
    let content = helpers.contentPreamble();
    content += generatedContent;
    return content;
  }

  // need to merge the generated content with preexisting content. the
  // algorithm is to preserve all content outside beginDelimiter and endDelimiter

  const beginDelimiterPos = existingLibRs.indexOf(beginDelimiter);
  const endDelimiterPos = existingLibRs.indexOf(endDelimiter);

  let content = existingLibRs.substring(0, beginDelimiterPos);
  content += generatedContent;
  // the + 1 is for the traililng \n
  content += existingLibRs.substring(endDelimiterPos + endDelimiter.length + 1);
  return content;
}

/**
 * creates the generated content including the begin and end delimiters
 * 
 * @param crate the crate for which to emit a lib.rs file
 * @returns the generated content for lib.rs
 */
function getGeneratedContent(crate: rust.Crate): string {
  const indent = new helpers.indentation();
  let content = beginDelimiter;
  content += '\nmod generated;\n\n';

  if (crate.clients.length > 0) {
    content += 'pub mod clients {\n';
    content += `${indent.get()}pub use crate::generated::clients::*;\n`;
    content += '}\n\n';
  }

  let closeModels = false;
  if (crate.enums.length > 0 || crate.models.length > 0) {
    closeModels = true;
    content += 'pub mod models {\n';
  }

  if (crate.enums.length > 0) {
    content += `${indent.get()}pub use crate::generated::enums::*;\n`;
  }

  if (crate.models.length > 0) {
    content += `${indent.get()}pub use crate::generated::models::*;\n`;
  }

  if (closeModels) {
    content += '}\n\n';
  }

  // re-export all instantiable clients and client options, and all client method options.
  // the idea here is that anything a caller can construct should be exposed in the root.
  if (crate.clients.length > 0) {
    content += 'pub use crate::generated::clients::{\n';
    for (const client of crate.clients) {
      if (client.constructable) {
        content += `${indent.get()}${client.name}, ${client.constructable.options.type.name},\n`;
      }
      for (const method of client.methods) {
        if (!method.pub || method.kind === 'clientaccessor') {
          continue;
        }
        content += `${indent.get()}${method.options.type.name},\n`;
      }
    }
    content += '};\n';
  }

  content += endDelimiter + '\n';
  return content;
}
