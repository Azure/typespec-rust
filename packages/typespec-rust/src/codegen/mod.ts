/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

// emits a mod.rs file
export function emitMod(modules: Array<rust.Module>): string {
  modules.sort((a, b) => { return helpers.sortAscending(a.name, b.name); });
  let content = helpers.contentPreamble();
  for (const module of modules) {
    content += `${module.pub ? 'pub ' : ''}mod ${module.name};\n`;
  }
  return content;
}
