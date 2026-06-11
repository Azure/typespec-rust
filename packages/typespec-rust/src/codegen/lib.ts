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
  // a TSP namespace named `Models` produces a user-defined sub-module `pub mod models;`
  // (emitted further down) which collides with the `models` re-exported by the glob above.
  // in Rust the sub-module declaration wins, hiding any types in `generated::models` from
  // the crate root. e.g. given:
  //
  //   namespace Foo {
  //     model FooModel { ... }   // lives in generated::models (crate root)
  //     namespace Models {
  //       model NamespaceModel { ... }   // lives in crate::models (sub-module)
  //     }
  //   }
  //
  // without the explicit re-export below, `crate::FooModel` would be unreachable
  // because `pub mod models;` shadows the inner `models` brought in by `generated::*`.
  // re-exporting `generated::models::*` flattens those crate-root types alongside the
  // sub-module so both `crate::FooModel` and `crate::models::NamespaceModel` work.
  //
  // NOTE: a similar collision would occur for a nested namespace named `Clients` (it
  // would shadow `generated::clients` re-exported via the glob). we don't currently
  // handle that case; if it surfaces in the wild we can extend this logic to also
  // re-export `generated::clients::*` when a `clients` sub-module is present.
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
