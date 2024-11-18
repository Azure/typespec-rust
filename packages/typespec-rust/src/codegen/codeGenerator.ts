/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { emitCargoToml } from './cargotoml.js';
import { emitClients } from './clients.js';
import { Context } from './context.js';
import { emitEnums } from './enums.js';
import { emitLibRs } from './lib.js';
import { emitModRs } from './mod.js';
import { emitModels } from './models.js';

import * as rust from '../codemodel/index.js';

// a file to emit
export interface File {
  readonly name: string;
  readonly content: string;
}

// CodeGenerator exposes the APIs for obtaining generated code content.
export class CodeGenerator {
  private readonly context: Context;
  private readonly crate: rust.Crate;

  constructor(crate: rust.Crate) {
    this.context = new Context(crate);
    this.crate = crate;
  }

  // returns the contents for the Cargo.toml file
  emitCargoToml(): string {
    return emitCargoToml(this.crate);
  }

  // returns the content for lib.rs
  emitLibRs(): string {
    return emitLibRs(this.crate);
  }

  // returns the generated content
  emitContent(): Array<File> {
    const clientsModRS = new Array<rust.Module>();
    const generatedModRS = new Array<rust.Module>();
    const files = new Array<File>();
    const clientsSubDir = 'clients';

    const clients = emitClients(this.crate, clientsSubDir);
    if (clients) {
      clientsModRS.push(...clients.modules);
      generatedModRS.push(new rust.Module('clients', true));
      files.push(...clients.clients);
    }

    const enums = emitEnums(this.crate, this.context);
    if (enums) {
      generatedModRS.push(new rust.Module('enums', true));
      files.push({name: 'enums.rs', content: enums});
    }

    const models = emitModels(this.crate, this.context);
    if (models.public) {
      generatedModRS.push(new rust.Module('models', true));
      files.push({name: 'models.rs', content: models.public});
    }
    if (models.internal) {
      clientsModRS.push(new rust.Module('internal_models', false));
      files.push({name: `${clientsSubDir}/internal_models.rs`, content: models.internal});
    }

    if (clientsModRS.length > 0) {
      files.push({name: `${clientsSubDir}/mod.rs`, content: emitModRs(clientsModRS)});
    }

    // there will always be something in the generated/mod.rs file
    files.push({name: 'mod.rs', content: emitModRs(generatedModRS)});

    return files;
  }
}
