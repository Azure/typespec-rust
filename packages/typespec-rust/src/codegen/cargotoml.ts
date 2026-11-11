/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../codemodel/index.js';

/**
 * emits the Cargo.toml file for the provided crate
 * 
 * @param crate the crate for which to emit a Cargo.toml file
 * @returns the contents of the Cargo.toml file
 */
export function emitCargoToml(crate: rust.Crate): string {
  let content = `[package]\nname = "${crate.name}"\nversion = "${crate.version}"\n`;
  content += 'authors.workspace = true\n';
  content += 'edition.workspace = true\n';
  content += 'license.workspace = true\n';
  content += 'repository.workspace = true\n';
  content += 'rust-version.workspace = true\n';
  content += 'exclude.workspace = true\n\n';
  content += '[features]\n';
  content += 'default = ["azure_core/default"]\n';
  if (crate.generateFakes) {
    content += 'test = ["azure_core/test"]\n';
    content += 'unstable_fake = ["test", "azure_core/unstable_fake"]\n';
  }
  if (crate.dependencies.length > 0) {
    content += '\n[dependencies]\n';
    for (const dependency of crate.dependencies) {
      // dependency versions are managed by the workspace's Cargo.toml file
      const featureNames = new Set(dependency.features);
      if (dependency.name === 'azure_core' && crate.type === 'azure-arm') {
        featureNames.add('unstable_resource_manager');
      }
      const features = featureNames.size > 0 ? `, features = [${[...featureNames].sort().map(f => `"${f}"`).join(', ')}]` : '';
      const defaults = dependency.name === 'azure_core' ? ', default-features = false' : '';
      content += `${dependency.name} = { workspace = true${defaults}${features} }\n`;
    }
  }
  return content;
}
