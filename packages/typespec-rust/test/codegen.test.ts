/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore ifblock

import * as rust from '../src/codemodel/index.js';
import { CodeGenerator } from '../src/codegen/codeGenerator.js';
import * as helpers from '../src/codegen/helpers.js';
import { strictEqual } from 'assert';
import { describe, it } from 'vitest';

describe('typespec-rust: codegen', () => {
  describe('generateCargoTomlFile', () => {
    it('default Cargo.toml file', () => {
      const expected = '[package]\n' +
        'name = "test_crate"\n' +
        'version = "1.2.3"\n' +
        'authors.workspace = true\n' +
        'edition.workspace = true\n' +
        'license.workspace = true\n' +
        'repository.workspace = true\n' +
        'rust-version.workspace = true\n';

      const codegen = new CodeGenerator(new rust.Crate('test_crate', '1.2.3', 'azure-arm'));
      const cargoToml = codegen.emitCargoToml();
      strictEqual(cargoToml, expected);
    });

    it('default Cargo.toml file with dependencies', () => {
      const expected = '[package]\n' +
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
      const codegen = new CodeGenerator(crate);
      const cargoToml = codegen.emitCargoToml();
      strictEqual(cargoToml, expected);
    });
  });

  describe('helpers', () => {
    it('annotationDerive', () => {
      strictEqual(helpers.annotationDerive(true), '#[derive(Clone, Deserialize, SafeDebug, Serialize)]\n');
      strictEqual(helpers.annotationDerive(true, 'Copy'), '#[derive(Clone, Copy, Deserialize, SafeDebug, Serialize)]\n');
      strictEqual(helpers.annotationDerive(true, '', 'Copy'), '#[derive(Clone, Copy, Deserialize, SafeDebug, Serialize)]\n');
      strictEqual(helpers.annotationDerive(false), '#[derive(Clone, SafeDebug)]\n');
      strictEqual(helpers.annotationDerive(false, 'Copy'), '#[derive(Clone, Copy, SafeDebug)]\n');
      strictEqual(helpers.annotationDerive(false, '', 'Copy'), '#[derive(Clone, Copy, SafeDebug)]\n');
    });

    it('emitVisibility', () => {
      strictEqual(helpers.emitVisibility('pub'), 'pub ');
      strictEqual(helpers.emitVisibility('pubCrate'), 'pub(crate) ');
    });

    it('indent', () => {
      const indent = new helpers.indentation();
      strictEqual(indent.get(), '    ');
      strictEqual(indent.push().get(), '        ');
      strictEqual(indent.push().get(), '            ');
      strictEqual(indent.pop().get(), '        ');
      strictEqual(indent.pop().get(), '    ');
      strictEqual(indent.get(), '    ');
    });

    it('buildIfBlock', () => {
      const indent = new helpers.indentation(0);
      const ifblock = helpers.buildIfBlock(indent, {
        condition: 'foo == bar',
        body: (indent) => { return `${indent.get()}bing = bong;\n`; }
      });
      const expected =
        'if foo == bar {\n' +
        '    bing = bong;\n' +
        '}';
      strictEqual(ifblock, expected);
    });

    it('buildMatch', () => {
      const indent = new helpers.indentation(0);
      const match = helpers.buildMatch(indent, 'cond', [
        {
          pattern: 'Some(foo)',
          body: (ind) => {
            return `${ind.get()}${helpers.buildIfBlock(ind, {
              condition: 'foo == bar',
              body: (ind) => `${ind.get()}bing = bong;\n`
            })}\n`;
          }
        },
        {
          pattern: 'None',
          body: (ind) => { return `${ind.get()}the none branch;\n`; }
        }
      ]);
      const expected =
        'match cond {\n' +
        '    Some(foo) => {\n' +
        '        if foo == bar {\n' +
        '            bing = bong;\n' +
        '        }\n' +
        '    },\n' +
        '    None => {\n' +
        '        the none branch;\n' +
        '    },\n' +
        '}';
      strictEqual(match, expected);
    });

    it('buildMatch with return types', () => {
      const indent = new helpers.indentation(0);
      const match = helpers.buildMatch(indent, 'cond', [
        {
          pattern: 'Some(foo)',
          returns: 'Returns1',
          body: (ind) => {
            return `${ind.get()}${helpers.buildIfBlock(ind, {
              condition: 'foo == bar',
              body: (ind) => `${ind.get()}bing = bong;\n`
            })}\n`;
          }
        },
        {
          pattern: 'None',
          returns: 'Returns2',
          body: (ind) => { return `${ind.get()}the none branch;\n`; }
        }
      ]);
      const expected =
        'match cond {\n' +
        '    Some(foo) => Returns1 {\n' +
        '        if foo == bar {\n' +
        '            bing = bong;\n' +
        '        }\n' +
        '    },\n' +
        '    None => Returns2 {\n' +
        '        the none branch;\n' +
        '    },\n' +
        '}';
      strictEqual(match, expected);
    });
  });
});
