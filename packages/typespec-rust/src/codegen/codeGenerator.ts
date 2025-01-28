/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { emitCargoToml } from './cargotoml.js';
import { emitClients } from './clients.js';
import { Context } from './context.js';
import { emitEnums } from './enums.js';
import { emitLibRs } from './lib.js';
import { emitClientsModRs, emitGeneratedMod } from './mod.js';
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
    return emitLibRs(this.crate);
  }

  /**
   * generates all clients, models, and any helper content
   * 
   * @returns an array of files to emit
   */
  emitContent(): Array<File> {
    const generatedModRS = new Array<string>();
    const clientsModRS = new Array<string>();
    const files = new Array<File>();
    const clientsSubDir = 'clients';

    const clients = emitClients(this.crate, clientsSubDir);
    if (clients) {
      generatedModRS.push('pub mod clients');
      files.push(...clients.clients);
    }

    const enums = emitEnums(this.crate, this.context);
    if (enums) {
      generatedModRS.push('pub mod enums');
      files.push({name: 'enums.rs', content: enums});
    }

    const models = emitModels(this.crate, this.context);
    if (models.public) {
      generatedModRS.push('pub mod models');
      files.push({name: 'models.rs', content: models.public});
    }
    if (models.serde) {
      generatedModRS.push('pub mod models_serde');
      files.push({name: 'models_serde.rs', content: models.serde});
    }
    if (models.internal) {
      clientsModRS.push('mod internal_models');
      files.push({name: `${clientsSubDir}/internal_models.rs`, content: models.internal});
    }
    if (models.xmlHelpers) {
      generatedModRS.push('mod xml_helpers');
      files.push({name: 'xml_helpers.rs', content: models.xmlHelpers});
    }

    if (clients) {
      files.push({name: `${clientsSubDir}/mod.rs`, content: emitClientsModRs(this.crate, clientsModRS)});
    }

    // there will always be something in the generated/mod.rs file
    files.push({name: 'mod.rs', content: emitGeneratedMod(generatedModRS)});

    return files;
  }
}
