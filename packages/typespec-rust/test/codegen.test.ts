/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../src/codemodel/index.js';
import { generateCargoTomlFile } from '../src/codegen/cargotoml.js';
import { strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: codegen', () => {
  describe('generateCargoTomlFile', () => {
    it('default Cargo.toml file', async () => {
      const cargoToml = generateCargoTomlFile(new rust.Crate('test_crate', '1.2.3'));
      strictEqual(cargoToml, '[package]\nname = "test_crate"\nversion = "1.2.3"\nedition.workspace = true\n');
    });

    it('default Cargo.toml file with dependencies', async () => {
      const crate = new rust.Crate('test_crate', '1.2.3');
      crate.dependencies.push(new rust.CrateDependency('azure_core'));
      const cargoToml = generateCargoTomlFile(crate);
      strictEqual(cargoToml, '[package]\nname = "test_crate"\nversion = "1.2.3"\nedition.workspace = true\n\n[dependencies]\nazure_core = { workspace = true }\n');
    });
  });
});
