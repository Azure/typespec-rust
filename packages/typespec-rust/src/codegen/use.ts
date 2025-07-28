/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import { CodegenError } from './errors.js';
import * as rust from '../codemodel/index.js';

/** used to generate use statements */
export class Use {
  private trees: Array<useTree>;
  private scope: 'clients' | 'models' | 'modelsOther';

  /**
   * instantiates a new instance of the Use type
   *
   * @param scope indicates a scope in which use statements are constructed.
   * this is only applicable when constructing the path to generated types.
   *      clients - we're in generated/clients
   *       models - we're in generated/models/models.rs
   *  modelsOther - we're in generated/models but not models.rs
   */
  constructor(scope: 'clients' | 'models' | 'modelsOther') {
    this.trees = new Array<useTree>();
    this.scope = scope;
  }

  /**
   * adds the specified module and type if not already in the list
   * e.g. ('azure_core', 'Context') or ('super::models', 'FooType')
   * NOTE: the leaf value MUST be a symbol within a module and not
   * just a module.
   *
   * @param module a module name
   * @param type one or more functions/types within the provided module
   */
  add(module: string, ...types: Array<string>): void {
    if (types.length === 0) {
      throw new CodegenError('InternalError', "types can't be empty");
    }

    for (const type of types) {
      // for each type, split it up into the constituent
      // parts that build the fully qualified path.
      const chunks = module.split('::');
      chunks.push(...type.split('::'));

      // each tree starts at the root of the fully qualified path
      let tree = this.trees.find((v) => v.root.name === chunks[0]);
      if (!tree) {
        tree = new useTree(chunks[0]);
        this.trees.push(tree);
      }

      // insert the children of the root node into the tree
      tree.insert(chunks.slice(1));
    }
  }

  /**
   * adds the specified type if not already in the list
   *
   * @param type the Rust type to add
   */
  addForType(type: rust.Client | rust.Payload | rust.ResponseHeadersTrait | rust.Type): void {
    switch (type.kind) {
      case 'arc':
        this.add('std::sync', 'Arc');
        return this.addForType(type.type);
      case 'client': {
        // client type are only referenced from other things in generated/clients so we ignore any scope
        this.add('crate::generated::clients', type.name);
        break;
      }
      case 'enum':
        this.add(this.scope === 'clients' ? 'crate::generated::models' : 'super', type.name);
        break;
      case 'enumValue':
        this.addForType(type.type);
        break;
      case 'marker':
        switch (this.scope) {
          case 'clients':
            this.add('crate::generated::models', type.name);
            break;
          case 'modelsOther':
            this.add('super', type.name);
            break;
          default:
            // marker types are only referenced from clients and model
            // helpers so we should never get here (if we do it's a bug)
            throw new CodegenError('InternalError', `unexpected scope ${this.scope}`);
        }
        break;
      case 'model':
        switch (this.scope) {
          case 'clients':
            this.add(`crate::generated::models${type.visibility !== 'pub' ? '::crate_models' : ''}`, type.name);
            break;
          case 'models':
            // we're in models so no need to bring another model into scope
            break;
          case 'modelsOther':
            this.add('super', type.name);
            break;
        }
        break;
      case 'option':
      case 'ref':
      case 'result':
      case 'hashmap':
      case 'Vec':
        this.addForType(type.type);
        break;
      case 'payload':
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
        if (type.format !== 'JsonFormat') {
          // JsonFormat is the default so no need to bring it into scope
          this.add('azure_core::http', type.format);
        }
        this.addForType(type.content);
        break;
      case 'responseHeadersTrait':
        switch (this.scope) {
          case 'clients':
            this.add(`crate::generated::models`, type.name);
            break;
          case 'models':
          case 'modelsOther':
            this.add('super', type.name);
            break;
        }
        break;
    }

    if (type.kind !== 'client') {
      if ((<rust.QualifiedType>type).name !== undefined && (<rust.QualifiedType>type).path !== undefined) {
        this.add((<rust.QualifiedType>type).path, (<rust.QualifiedType>type).name);
      }
    }
  }

  /**
   * emits Rust use statements for the contents of this Use object
   *
   * @param indent optional indentation helper currently in scope, else defaults to no indentation
   * @returns returns Rust formatted use statements
   */
  text(indent?: helpers.indentation): string {
    if (this.trees.length === 0) {
      return '';
    }

    if (!indent) {
      // default to no indentation
      indent = new helpers.indentation(0);
    }

    let content = '';

    /** recursively populates content with the guts of the use statement */
    const recursiveText = function (node: useNode, siblings: boolean) {
      content += node.name;
      if (node.children.length === 1) {
        content += '::';
        recursiveText(node.children[0], false);
      } else if (node.children.length > 1) {
        node.children.sort((a, b) => helpers.sortAscending(a.name, b.name));
        content += '::{';
        for (const child of node.children) {
          recursiveText(child, true);
        }
        content += '}';
      }

      if (siblings) {
        content += ', ';
      }
    };

    this.trees.sort((a, b) => helpers.sortAscending(a.root.name, b.root.name));
    for (const tree of this.trees) {
      content += `${indent.get()}use `;
      recursiveText(tree.root, false);
      content += ';\n';
    }

    content += '\n';
    return content;
  }
}

/**
 * a tree of use statements
 *
 * the tree starts at a root (e.g. azure_core) and
 * each node has one or more children.
 */
class useTree {
  readonly root: useNode;
  constructor(item: string) {
    this.root = new useNode(item);
  }

  insert(items: Array<string>): void {
    let node = this.root;
    for (const item of items) {
      let next = node.children.find((n) => n.name === item);
      if (!next) {
        next = new useNode(item);
        node.children.push(next);
      }
      node = next;
    }
  }
}

/** a node within the use statement tree */
class useNode {
  readonly name: string;
  readonly children: Array<useNode>;
  constructor(name: string) {
    this.name = name;
    this.children = new Array<useNode>();
  }
}
