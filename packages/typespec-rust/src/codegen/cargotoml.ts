/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../codemodel/index.js';

export function generateCargoTomlFile(crate: rust.Crate): string {
  let content = `[package]\nname = "${crate.name}"\nversion = "${crate.version}"\nedition.workspace = true\n`;
  if (crate.dependencies.length > 0) {
    content += '\n[dependencies]\n';
    for (const dependency of crate.dependencies) {
      // dependency versions are managed by the workspace's Cargo.toml file
      content += `${dependency.name} = { workspace = true }\n`;
    }
  }
  return content;
}
