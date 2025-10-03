/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';

/**
 * emits the contents of the lib.rs file
 * 
 * @returns the contents of the lib.rs file
 */
export function emitLibRs(): string {
  let content = helpers.contentPreamble(false);
  content += '#![cfg_attr(docsrs, feature(doc_auto_cfg))]\n';
  content += '\n';
  content += 'mod generated;\n';
  content += 'pub use generated::*;\n';
  return content;
}
