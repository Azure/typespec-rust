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
  const pubModModels = '/// Contains all the data structures and types used by the client library.\npub mod models;\n'
  if (crate.clients.length > 0) {
    content += '/// Clients used to communicate with the service.\n';
    content += 'pub mod clients;\n';
    // client method options are in the models module
    content += pubModModels;
  } else if (crate.enums.length > 0 || crate.models.length > 0 || crate.unions.length > 0) {
    content += pubModModels;
  }

  if (crate.clients.length > 0) {
    // the instantiable clients and their options types get re-exported from the root
    const clientsAndClientOptions = new Array<string>();
    for (const client of crate.clients) {
      if (client.constructable) {
        clientsAndClientOptions.push(client.name);

        // skip emitting the client options type (we always want to emit the client type)
        if (!client.constructable.suppressed) {
          clientsAndClientOptions.push(client.constructable.options.type.name);
        }
      }
    }
    content += `pub use clients::{${clientsAndClientOptions.join(', ')}};\n`;
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
  // clippy complains about "mod models;" inside the models directory
  return helpers.contentPreamble()
    + modules.sort().map((module) => module.match(/mod models$/) ? `#[allow(clippy::module_inception)]\n${module}` : module).join(';\n') + ';\n';
}
