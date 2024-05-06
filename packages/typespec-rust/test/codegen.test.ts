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
      const expected = '[package]\n' +
        'name = "test_crate"\n' +
        'version = "1.2.3"\n' +
        'authors.workspace = true\n' +
        'edition.workspace = true\n' +
        'license.workspace = true\n' +
        'repository.workspace = true\n' +
        'rust-version.workspace = true\n';

      const cargoToml = codegen.emitCargoToml(new rust.Crate('test_crate', '1.2.3', 'azure-arm'));
      strictEqual(cargoToml, expected);
    });

    it('default Cargo.toml file with dependencies', async () => {
      const expected =   '[package]\n' +
        'name = "test_crate"\n' +
        'version = "1.2.3"\n' +
        'authors.workspace = true\n' +
        'edition.workspace = true\n' +
        'license.workspace = true\n' +
        'repository.workspace = true\n' +
        'rust-version.workspace = true\n' +
        '\n' +
        '[dependencies]\n' +
        'azure_core = { workspace = true }\n';

      const crate = new rust.Crate('test_crate', '1.2.3', 'data-plane');
      crate.dependencies.push(new rust.CrateDependency('azure_core'));
      const cargoToml = codegen.emitCargoToml(crate);
      strictEqual(cargoToml, expected);
    });
  });

  describe('helpers', () => {
    it('annotationDerive', async () => {
      strictEqual(helpers.annotationDerive(), '#[derive(Clone, Deserialize, Serialize)]\n');
      strictEqual(helpers.annotationDerive('Copy'), '#[derive(Clone, Copy, Deserialize, Serialize)]\n');
      strictEqual(helpers.annotationDerive('', 'Copy'), '#[derive(Clone, Copy, Deserialize, Serialize)]\n');
    });

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
