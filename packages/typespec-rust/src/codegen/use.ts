/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

// used to generate use statements
export class Use {
  private uses: Array<moduleTypes>;

  constructor() {
    this.uses = new Array<moduleTypes>();
  }

  // adds the specified module and type if not already in the list
  // e.g. ('azure_core', 'Context') or ('crate::models', 'FooType')
  addType(module: string, type: string): void {
    let mod = this.uses.find((v: moduleTypes, i: number, o: Array<moduleTypes>) => { return v.module === module; });
    if (!mod) {
      mod = {
        module: module,
        types: new Array<string>(),
      };
      this.uses.push(mod);
    }
    if (!mod.types.find((v: string, i: number, o: Array<string>) => { return v === type; })) {
      mod.types.push(type);
    }
  }

  // adds the specified module and types if not already in the list
  addTypes(module: string, types: Array<string>): void {
    if (types.length === 0) {
      throw new Error('types can\'t be empty');
    }
    for (const type of types) {
      this.addType(module, type);
    }
  }

  // adds the specified type if not already in the list
  addForType(type: rust.Client | rust.Type): void {
    switch (type.kind) {
      case 'client': {
        const mod = codegen.deconstruct(type.name).join('_');
        this.addType(`crate::${mod}`, type.name);
        break;
      }
      case 'external':
        this.addType(type.crate, type.name);
        break;
      case 'generic':
        if (type.use) {
          this.addType(type.use, type.name);
        }
        for (const t of type.types) {
          this.addForType(t);
        }
        break;
      case 'enum':
      case 'model':
        this.addType('crate::models', type.name);
        break;
      case 'requestContet':
        this.addType('azure_core', 'RequestContent');
        this.addForType(type.type);
        break;
    }
  }

  // returns Rust formatted use statements
  text(): string {
    if (this.uses.length === 0) {
      return '';
    }

    let content = '';

    const indentation = new helpers.indentation();

    // sort by module name, then sort types if more than one type
    const sortedMods = this.uses.sort((a: moduleTypes, b: moduleTypes) => { return helpers.sortAscending(a.module, b.module); });
    for (const sortedMod of sortedMods) {
      if (sortedMod.types.length === 1) {
        content += `use ${sortedMod.module}::${sortedMod.types[0]};\n\n`;
      } else {
        const sortedTypes = sortedMod.types.sort((a: string, b: string) => { return helpers.sortAscending(a, b); });
        content += `use ${sortedMod.module}::{\n`;
        content += `${indentation.get()}${sortedTypes.join(', ')}`;
        content += ',\n};\n\n';
      }
    }

    return content;
  }
}

interface moduleTypes {
  module: string;
  types: Array<string>;
}
