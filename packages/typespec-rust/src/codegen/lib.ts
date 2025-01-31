/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * emits the contents of the lib.rs file
 * 
 * @param crate the crate for which to emit a lib.rs file
 * @returns the contents of the lib.rs file
 */
export function emitLibRs(crate: rust.Crate): string {
  const indent = new helpers.indentation();
  let content = helpers.contentPreamble();
  content += 'mod generated;\n\n';

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
    content += '};\n\n';
  }

  return content;
}
