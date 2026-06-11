/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * emits the contents of the lib.rs file
 * 
 * @param crate the crate for which to emit the lib.rs file
 * @returns the contents of the lib.rs file
 */
export function emitLibRs(crate: rust.Crate): string {
  let content = helpers.contentPreamble(false);
  content += '#![cfg_attr(docsrs, feature(doc_cfg))]\n';
  content += '\n';
  content += 'mod generated;\n';
  content += 'pub use generated::*;\n';
  // when a sub-module named `models` exists it shadows the `generated::models`
  // re-export from the glob above; surface the crate-root orphan model items
  // directly so they remain reachable from the crate root.
  const hasModelsSubModule = crate.subModules.some((subModule) => subModule.name === 'models');
  const hasGeneratedModels = crate.enums.length > 0
    || crate.models.length > 0
    || crate.unions.length > 0
    || crate.clients.some((client) => client.methods.some((method) => method.kind !== 'clientaccessor'));
  if (hasModelsSubModule && hasGeneratedModels) {
    content += 'pub use generated::models::*;\n';
  }
  for (const subModule of crate.subModules) {
    content += `pub mod ${subModule.name};\n`;
  }
  return content;
}
