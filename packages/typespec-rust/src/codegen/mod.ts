/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * emits the contents of the clients/mod.rs file
 * 
 * @param crate the crate for which to emit the mod.rs file
 * @param addlMods any additional modules to include
 * @returns the contents of the mod.rs file
 */
export function emitClientsModRs(crate: rust.Crate, addlMods: Array<string>): string {
  const content = helpers.contentPreamble();
  const body = new Array<string>();

  const modules = new Array<string>();
  // first add the modules for each client
  for (const client of crate.clients) {
    const clientModule = codegen.deconstruct(client.name).join('_');
    body.push(`mod ${clientModule};`);
    modules.push(clientModule);
  }

  // add module for method options
  body.push('pub(crate) mod method_options;');

  // add any additional mod entries
  for (const addlMod of addlMods) {
    body.push(`${addlMod};`);
  }

  // now add re-exports for each client module
  for (const module of modules) {
    body.push(`pub use ${module}::*;`);
  }

  return content + body.join('\n');
}

/**
 * emits the contents of the generated/mod.rs file
 * 
 * @param modules the modules to include
 * @returns the contents of the mod.rs file
 */
export function emitGeneratedMod(modules: Array<string>): string {
  return helpers.contentPreamble() + modules.join(';\n') + ';\n';
}
