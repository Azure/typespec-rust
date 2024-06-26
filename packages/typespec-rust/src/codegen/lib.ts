/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

// emits the lib.rs file
export function emitLib(crate: rust.Crate): string {
  let content = helpers.contentPreamble();
  content += 'mod generated;\n\n';

  if (crate.clients.length > 0) {
    content += 'pub use crate::generated::clients::*;\n\n';
  }

  let closeModels = false;
  if (crate.enums.length > 0 || crate.models.length > 0) {
    closeModels = true;
    content += 'pub mod models {\n';
  }

  const indentation = new helpers.indentation();

  if (crate.enums.length > 0) {
    content += `${indentation.get()}pub use crate::generated::enums::*;\n`;
  }

  if (crate.models.length > 0) {
    content += `${indentation.get()}pub use crate::generated::models::*;\n`;
  }

  if (closeModels) {
    content += '}\n';
  }

  return content;
}
