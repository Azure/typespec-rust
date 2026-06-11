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
 * @param module the module for which to emit the mod.rs file
 * @returns the contents of the mod.rs file
 */
export function emitGeneratedModRs(module: rust.ModuleContainer): string {
  let content = helpers.contentPreamble();
  const pubModModels = '/// Contains all the data structures and types used by the client library.\npub mod models;\n'
  if (module.clients.length > 0) {
    content += '/// Clients used to communicate with the service.\n';
    content += 'pub mod clients;\n';
  }

  if (module.clients.find((client) => client.methods.find((method) => method.kind !== 'clientaccessor')) || module.enums.length > 0 || module.models.length > 0 || module.unions.length > 0) {
    content += pubModModels;
  }

  if (module.clients.length > 0) {
    // the instantiable clients and their options types get re-exported from the root
    const clientsAndClientOptions = new Array<string>();
    for (const client of module.clients) {
      if (client.constructable) {
        clientsAndClientOptions.push(client.name);

        // skip emitting the client options type (we always want to emit the client type)
        if (client.constructable.suppressed !== 'yes') {
          clientsAndClientOptions.push(client.constructable.options.type.name);
        }
      }
    }

    if (clientsAndClientOptions.length > 0) {
      content += `pub use clients::{${clientsAndClientOptions.join(', ')}};\n`;
    }
  }

  if (module.kind === 'crate' && module.type === 'azure-arm') {
    content += '/// Marker type for Azure Resource Manager audience configuration.\n';
    content += 'pub struct Audience;\n';
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

/**
 * emits the contents of mod.rs for a sub-module
 * 
 * @param module the sub-module for which to emit the content
 * @returns the contents of the mod.rs file
 */
export function emitSubModRs(module: rust.SubModule): string {
  let content = helpers.contentPreamble();
  if (module.clients.length > 0 || module.enums.length > 0 || module.models.length > 0 || module.unions.length > 0) {
    content += 'mod generated;\n';
    // a TSP namespace named `Models` at the crate root produces a sub-module whose
    // name collides with the crate-root `generated::models` brought in by the glob
    // re-export in lib.rs. in Rust the sub-module declaration shadows that glob, so
    // any crate-root models (e.g. a root-level orphan model) become unreachable via
    // `crate::models`. re-export them here so they remain reachable as
    // `crate::models::OrphanModel`, while this sub-module's own generated types stay
    // nested below (e.g. `crate::models::models::NamespaceModel` via `generated::*`).
    //
    // NOTE: the analogous collision for a crate-root namespace named `Clients` is not
    // handled here; we can extend this if it surfaces in a real spec.
    if (module.name === 'models' && module.parent.kind === 'crate' && hasGeneratedModels(module.parent)) {
      content += 'pub use crate::generated::models::*;\n';
    }
    content += 'pub use generated::*;\n';
  }
  for (const subModule of module.subModules) {
    content += `pub mod ${subModule.name};\n`;
  }
  return content;
}

/**
 * returns true when the module has generated model content (enums, models,
 * unions, or clients with non-accessor methods) emitted under `generated::models`.
 *
 * @param module the module to inspect
 * @returns true if the module emits a `generated::models` module
 */
function hasGeneratedModels(module: rust.ModuleContainer): boolean {
  return module.enums.length > 0
    || module.models.length > 0
    || module.unions.length > 0
    || module.clients.some((client) => client.methods.some((method) => method.kind !== 'clientaccessor'));
}
