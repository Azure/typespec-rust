/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/** used to generate use statements */
export class Use {
  private uses: Array<moduleTypes>;
  private scope: 'clients' | 'models' | 'modelsOther';

  /**
   * instantiates a new instance of the Use type
   * 
   * @param scope indicates a scope in which use statements are constructed.
   * this is only applicable when construcing the path to generated types.
   *      clients - we're in generated/clients
   *       models - we're in generated/models/models.rs
   *  modelsOther - we're in generated/models but not models.rs
   */
  constructor(scope: 'clients' | 'models' | 'modelsOther') {
    this.uses = new Array<moduleTypes>();
    this.scope = scope;
  }

  /**
   * adds the specified module and type if not already in the list
   * e.g. ('azure_core', 'Context') or ('super::models', 'FooType')
   * 
   * @param module a module name
   * @param type a type within the provided module
   */
  addType(module: string, type: string): void {
    let mod = this.uses.find((v: moduleTypes) => { return v.module === module; });
    if (!mod) {
      mod = {
        module: module,
        types: new Array<string>(),
      };
      this.uses.push(mod);
    }
    if (!mod.types.find((v: string) => { return v === type; })) {
      mod.types.push(type);
    }
  }

  /**
   * adds the specified module and types if not already in the list
   * 
   * @param module a module name
   * @param types one or more types within the provided module
   */
  addTypes(module: string, types: Array<string>): void {
    if (types.length === 0) {
      throw new Error('types can\'t be empty');
    }
    for (const type of types) {
      this.addType(module, type);
    }
  }

  /**
   * adds the specified type if not already in the list
   * 
   * @param type the Rust type to add
   */
  addForType(type: rust.Client | rust.Type): void {
    switch (type.kind) {
      case 'arc':
        this.addType('std::sync', 'Arc');
        return this.addForType(type.type);
      case 'client': {
        // client type are only referenced from other things in generated/clients so we ignore any scope
        this.addType('super', type.name);
        break;
      }
      case 'enum':
        this.addType(this.scope === 'clients' ? 'crate::generated::models' : 'super', type.name);
        break;
      case 'enumValue':
        this.addForType(type.type);
        break;
      case 'model':
        switch (this.scope) {
          case 'clients':
            this.addType(`crate::generated::models${type.visibility !== 'pub' ? '::crate_models' : ''}`, type.name);
            break;
          case 'models':
            // we're in models so no need to bring another model into scope
            break;
          case 'modelsOther':
            this.addType('super', type.name);
            break;
        }
        break;
      case 'option':
      case 'result':
      case 'hashmap':
      case 'Vec':
        this.addForType(type.type);
        break;
      case 'requestContent':
        switch (type.content.kind) {
          case 'bytes':
            this.addForType(type.content);
            break;
          case 'payload':
            this.addForType(type.content.type);
            break;
        }
        break;
      case 'response':
        switch (type.content.kind) {
          case 'marker':
            switch (this.scope) {
              case 'clients':
                this.addType('crate::generated::models', type.content.name);
                break;
              case 'modelsOther':
                this.addType('super', type.content.name);
                break;
              default:
                // marker types are only referenced from clients and model
                // helpers so we should never get here (if we do it's a bug)
                throw new Error(`unexpected scope ${this.scope}`);
            }
            break;
          case 'payload':
            this.addForType(type.content.type);
        }
    }

    if (type.kind !== 'client') {
      if ((<rust.StdType>type).name !== undefined && (<rust.StdType>type).use !== undefined) {
        this.addType((<rust.StdType>type).use, (<rust.StdType>type).name);
      } else if ((<rust.External>type).crate !== undefined && (<rust.External>type).name !== undefined) {
        let module = (<rust.External>type).crate;
        if ((<rust.External>type).namespace) {
          module += `::${(<rust.External>type).namespace}`;
        }
        this.addType(module, (<rust.External>type).name);
      }
    }
  }

  /**
   * emits Rust use statements for the contents of this Use object
   * 
   * @param indent optional indentation helper currently in scope, else defauls to no indentation
   * @returns returns Rust formatted use statements
   */
  text(indent?: helpers.indentation): string {
    if (this.uses.length === 0) {
      return '';
    }

    if (!indent) {
      // default to no indentation
      indent = new helpers.indentation(0);
    }

    let content = '';

    // sort by module name, then sort types if more than one type
    const sortedMods = this.uses.sort((a: moduleTypes, b: moduleTypes) => { return helpers.sortAscending(a.module, b.module); });
    for (const sortedMod of sortedMods) {
      if (sortedMod.types.length === 1) {
        content += `${indent.get()}use ${sortedMod.module}::${sortedMod.types[0]};\n`;
      } else {
        const sortedTypes = sortedMod.types.sort((a: string, b: string) => { return helpers.sortAscending(a, b); });
        content += `${indent.get()}use ${sortedMod.module}::{\n`;
        content += `${indent.push().get()}${sortedTypes.join(', ')}`;
        content += `,\n${indent.pop().get()}};\n`;
      }
    }

    content += '\n';
    return content;
  }
}

/** module and types within */
interface moduleTypes {
  /** the module name */
  module: string;

  /** the types within module */
  types: Array<string>;
}
