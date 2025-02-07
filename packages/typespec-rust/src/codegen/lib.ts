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

  // DO NOT emit any content before beginDelimiter!!
  let content = beginDelimiter;
  content += '\nmod generated;\n\n';

  if (crate.clients.length > 0) {
    content += 'pub mod clients {\n';
    // we want to reexport all clients and client options, not method_options
    const clientsAndClientOptions = new Array<string>();
    for (const client of crate.clients) {
      clientsAndClientOptions.push(client.name);
      if (client.constructable) {
        clientsAndClientOptions.push(client.constructable.options.type.name);
      }
    }
    content += `${indent.get()}pub use crate::generated::clients::{${clientsAndClientOptions.join(', ')}};\n`;
    content += '}\n\n';
  }

  // emit pub mod models section
  let closeModels = false;
  if (crate.clients.length > 0 || crate.enums.length > 0 || crate.models.length > 0) {
    closeModels = true;
    content += 'pub mod models {\n';
  }

  if (crate.clients.length > 0) {
    // all client method options are reexported from models
    content += `${indent.get()}pub use crate::generated::clients::method_options::{\n`;
    indent.push();
    for (const client of crate.clients) {
      for (const method of client.methods) {
        if (!method.pub || method.kind === 'clientaccessor') {
          continue;
        }
        content += `${indent.get()}${method.options.type.name},\n`;
      }
    }
    indent.pop();
    content += `${indent.get()}};\n`;
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
  // end pub mod models section

  // now reexport all instantiable clients and their client options types from the root
  if (crate.clients.length > 0) {
    const clientsAndClientOptions = new Array<string>();
    for (const client of crate.clients) {
      if (client.constructable) {
        clientsAndClientOptions.push(client.name);
        clientsAndClientOptions.push(client.constructable.options.type.name);
      }
    }
    content += `${indent.get()}pub use crate::generated::clients::{${clientsAndClientOptions.join(', ')}};\n`;
  }

  content += endDelimiter + '\n';
  // DO NOT emit any content after endDelimiter!!

  return content;
}
