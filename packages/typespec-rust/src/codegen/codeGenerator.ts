/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { emitCargoToml } from './cargotoml.js';
import { emitClients } from './clients.js';
import { Context } from './context.js';
import { emitEnums } from './enums.js';
import { emitLibRs } from './lib.js';
import { emitHeaderTraits } from './headerTraits.js';
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
   * @param existingLibRs contents of preexisting lib.rs file
   * @returns the content for lib.rs
   */
  emitLibRs(existingLibRs?: string): string {
    return emitLibRs(this.crate, existingLibRs);
  }

  /**
   * generates all clients, models, and any helper content
   * 
   * @returns an array of files to emit
   */
  emitContent(): Array<File> {
    const generatedModRS = new Array<string>();
    const files = new Array<File>();
    const clientsSubDir = 'clients';

    const clients = emitClients(this.crate, clientsSubDir);
    if (clients) {
      generatedModRS.push('pub(crate) mod clients');
      files.push(...clients.clients);
      files.push({name: `${clientsSubDir}/mod.rs`, content: emitClientsModRs(this.crate)});
    }

    const enums = emitEnums(this.crate, this.context);
    if (enums) {
      generatedModRS.push('pub(crate) mod enums');
      files.push({name: 'enums.rs', content: enums});
    }

    const models = emitModels(this.crate, this.context);
    if (models.public) {
      generatedModRS.push('pub(crate) mod models');
      files.push({name: 'models.rs', content: models.public});
    }
    if (models.serde) {
      generatedModRS.push('pub(crate) mod models_serde');
      files.push({name: 'models_serde.rs', content: models.serde});
    }
    if (models.internal) {
      generatedModRS.push('pub(crate) mod internal_models');
      files.push({name: `internal_models.rs`, content: models.internal});
    }
    const headerTraits = emitHeaderTraits(this.crate);
    if (headerTraits) {
      generatedModRS.push('pub(crate) mod header_traits');
      files.push({name: 'header_traits.rs', content: headerTraits});
    }
    if (models.xmlHelpers) {
      generatedModRS.push('mod xml_helpers');
      files.push({name: 'xml_helpers.rs', content: models.xmlHelpers});
    }

    // there will always be something in the generated/mod.rs file
    files.push({name: 'mod.rs', content: emitGeneratedMod(generatedModRS)});

    return files;
  }
}
