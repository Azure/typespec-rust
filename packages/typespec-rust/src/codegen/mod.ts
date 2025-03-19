/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * emits the contents of the clients/mod.rs file
 * 
 * @param modules the modules to include
 * @returns the contents of the mod.rs file
 */
export function emitClientsModRs(modules: Array<string>): string {
  const body = new Array<string>();

  // first add the modules for each client
  for (const module of modules) {
    body.push(`mod ${module};`);
  }

  // now add re-exports for each client module
  for (const module of modules) {
    body.push(`pub use ${module}::*;`);
  }

  return helpers.contentPreamble() + body.join('\n');
}

/**
 * emits the contents of the generated/mod.rs file
 * 
 * @param crate the crate for which to emit the mod.rs file
 * @returns the contents of the mod.rs file
 */
export function emitGeneratedModRs(crate: rust.Crate): string {
  let content = helpers.contentPreamble();
  if (crate.clients.length > 0) {
    content += 'pub mod clients;\n';
    // client method options are in the models module
    content += 'pub mod models;\n';
  } else if (crate.enums.length > 0 || crate.models.length > 0) {
    content += 'pub mod models;\n';
  }

  if (crate.clients.length > 0) {
    // the instantiable clients and their options types get re-exported from the root
    const clientsAndClientOptions = new Array<string>();
    for (const client of crate.clients) {
      if (client.constructable) {
        clientsAndClientOptions.push(client.name);
        clientsAndClientOptions.push(client.constructable.options.type.name);
      }
    }
    content += `pub use super::clients::{${clientsAndClientOptions.join(', ')}};\n`;
  }

  return content;
}

/**
 * emits the contents of the models/mod.rs file
 * 
 * @param modules the modules to include
 * @returns the contents of the mod.rs file
 */
export function emitModelsModRs(modules: Array<string>): string {
  return helpers.contentPreamble() + modules.sort().join(';\n') + ';\n';
}
