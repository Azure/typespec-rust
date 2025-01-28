/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * emits the contents of the mod.rs file for clients
 * 
 * @param crate the crate for which to emit the mod.rs file
 * @returns the contents of the mod.rs file
 */
export function emitClientsModRs(crate: rust.Crate, addlMods: Array<string>): string {
  const content = helpers.contentPreamble();
  const body = new Array<string>();

  // first add the modules for each client
  for (const client of crate.clients) {
    body.push(`mod ${codegen.deconstruct(client.name).join('_')};`);
  }

  // add any additional mod entries
  for (const addlMod of addlMods) {
    body.push(`${addlMod};`);
  }

  // now add re-exports for each client
  for (const client of crate.clients) {
    const clientModule = codegen.deconstruct(client.name).join('_');
    if (client.constructable) {
      body.push(`pub use ${clientModule}::*;`);
      continue;
    }

    // for non-instantiable clients we only re-export method option types
    const optionsTypes = new Array<string>();
    for (const method of client.methods) {
      if (method.kind !== 'clientaccessor') {
        optionsTypes.push(method.options.type.name);
      }
    }
    if (optionsTypes.length > 0) {
      body.push(`pub use ${clientModule}::{${optionsTypes.join()}};`);
    }
  }
  return content + body.join('\n');
}

export function emitGeneratedMod(modules: Array<string>): string {
  return helpers.contentPreamble() + modules.join(';\n') + ';\n';
}
