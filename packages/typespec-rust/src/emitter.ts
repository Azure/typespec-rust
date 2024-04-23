/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as codegen from './codegen/index.js';
import { tcgcToCrate } from './tcgcadapter/adapter.js';
import { RustEmitterOptions } from './lib.js';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { EmitContext } from '@typespec/compiler';
import 'source-map-support/register.js';

export async function $onEmit(context: EmitContext<RustEmitterOptions>) {
  const crate = tcgcToCrate(context);
  await mkdir(context.emitterOutputDir, {recursive: true});

  // don't overwrite an existing Cargo.toml file
  const cargoTomlFile = `${context.emitterOutputDir}/Cargo.toml`;
  if (!existsSync(cargoTomlFile)) {
    const cargoToml = codegen.generateCargoTomlFile(crate);
    writeFile(cargoTomlFile, cargoToml);
  }
}
