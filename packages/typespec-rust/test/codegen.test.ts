/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../src/codemodel/index.js';
import * as codegen from '../src/codegen/index.js';
import * as helpers from '../src/codegen/helpers.js';
import { strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: codegen', () => {
  describe('generateCargoTomlFile', () => {
    it('default Cargo.toml file', async () => {
      const cargoToml = codegen.emitCargoToml(new rust.Crate('test_crate', '1.2.3', 'azure-arm'));
      strictEqual(cargoToml, '[package]\nname = "test_crate"\nversion = "1.2.3"\nedition.workspace = true\n');
    });

    it('default Cargo.toml file with dependencies', async () => {
      const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
      crate.dependencies.push(new rust.CrateDependency('azure_core'));
      const cargoToml = codegen.emitCargoToml(crate);
      strictEqual(cargoToml, '[package]\nname = "test_crate"\nversion = "1.2.3"\nedition.workspace = true\n\n[dependencies]\nazure_core = { workspace = true }\n');
    });
  });

  describe('helpers', () => {
    it('emitPub', async () => {
      strictEqual(helpers.emitPub(false), '');
      strictEqual(helpers.emitPub(true), 'pub ');
    });

    it('indent', async () => {
      strictEqual(helpers.indent(0), '    ');
      strictEqual(helpers.indent(1), '    ');
      strictEqual(helpers.indent(2), '        ');
      strictEqual(helpers.indent(3), '            ');
    });
  });
});
