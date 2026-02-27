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
  for (const subModule of crate.subModules) {
    content += `pub mod ${subModule.name};\n`;
  }
  return content;
}
