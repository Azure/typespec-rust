/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// cspell: ignore cargotoml
import { emitCargoToml } from './cargotoml.js';
import { emitClients } from './clients.js';
import { Context } from './context.js';
import { emitEnums } from './enums.js';
import { Module } from './helpers.js';
import { emitLibRs } from './lib.js';
import { emitHeaderTraits } from './headerTraits.js';
import { emitClientsModRs, emitGeneratedModRs, emitModelsModRs } from './mod.js';
import { emitModels } from './models.js';

import * as rust from '../codemodel/index.js';

/** a file to emit */
export interface File {
  /** the name of the file. can contain sub-directories */
  readonly name: string;

  /** the contents of the file */
  readonly content: string;
}

/** CodeGenerator exposes the APIs for obtaining generated code content */
export class CodeGenerator {
  private readonly context: Context;
  private readonly crate: rust.Crate;

  /**
   * instantiates a new CodeGenerator instance for the provided crate
   * @param crate the Rust crate for which to generate code
   */
  constructor(crate: rust.Crate) {
    this.context = new Context(crate);
    this.crate = crate;
  }

  /**
   * generates a Cargo.toml file
   * 
   * @returns the contents for the Cargo.toml file
   */
  emitCargoToml(): string {
    return emitCargoToml(this.crate);
  }

  /**
   * generates the lib.rs file for crate
   * 
   * @returns the content for lib.rs
   */
  emitLibRs(): string {
    return emitLibRs();
  }

  /**
   * generates all clients, models, and any helper content
   * 
   * @returns an array of files to emit
   */
  emitContent(): Array<File> {
    const modelsModRS = new Array<string>();
    const files = new Array<File>();
    const clientsSubDir = 'clients';
    const modelsSubDir = 'models';

    const addModelsFile = function (module: Module | undefined, visibility: 'internal' | 'pubUse' | 'pubCrate'): void {
      if (!module) {
        return;
      }
      files.push({ name: `${modelsSubDir}/${module.name}.rs`, content: module.content });
      modelsModRS.push(`${visibility === 'pubCrate' ? 'pub(crate) ' : ''}mod ${module.name}`);
      if (visibility === 'pubUse') {
        modelsModRS.push(`pub use ${module.name}::*`);
      }
    };

    const clientModules = emitClients(this.crate);
    if (clientModules) {
      files.push(...clientModules.modules.map((module) => { return { name: `${clientsSubDir}/${module.name}.rs`, content: module.content }; }));
      files.push({ name: `${clientsSubDir}/mod.rs`, content: emitClientsModRs(clientModules.modules.map((module) => module.name)) });
      addModelsFile(clientModules.options, 'pubUse');
    }

    addModelsFile(emitEnums(this.crate, this.context), 'pubUse');

    const models = emitModels(this.crate, this.context);
    addModelsFile(models.public, 'pubUse');
    addModelsFile(models.serde, 'pubCrate');
    addModelsFile(models.impls, 'internal');
    addModelsFile(models.internal, 'pubCrate');
    addModelsFile(models.xmlHelpers, 'pubCrate');

    addModelsFile(emitHeaderTraits(this.crate), 'pubUse');

    if (modelsModRS.length > 0) {
      files.push({ name: `${modelsSubDir}/mod.rs`, content: emitModelsModRs(modelsModRS) })
    }

    // there will always be something in the generated/mod.rs file
    files.push({ name: 'mod.rs', content: emitGeneratedModRs(this.crate) });

    return files;
  }
}
