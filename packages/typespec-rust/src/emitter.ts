/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CodeGenerator } from './codegen/codeGenerator.js';
import { Adapter } from './tcgcadapter/adapter.js';
import { RustEmitterOptions } from './lib.js';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { EmitContext } from '@typespec/compiler';
import 'source-map-support/register.js';

export async function $onEmit(context: EmitContext<RustEmitterOptions>) {
  const adapter = await Adapter.create(context);
  const crate = adapter.tcgcToCrate();

  await mkdir(`${context.emitterOutputDir}/src`, {recursive: true});

  const codegen = new CodeGenerator(crate);

  // TODO: don't overwrite an existing Cargo.toml file
  // will likely need to merge existing Cargo.toml file with generated content
  // https://github.com/Azure/typespec-rust/issues/22
  await writeFile(`${context.emitterOutputDir}/Cargo.toml`, codegen.emitCargoToml());

  // TODO: this will overwrite an existing lib.rs file.
  // we will likely need to support merging generated content with a preexisting lib.rs
  // https://github.com/Azure/typespec-rust/issues/20
  await writeFile(`${context.emitterOutputDir}/src/lib.rs`, codegen.emitLibRs());

  const files = codegen.emitContent();
  for (const file of files) {
    await writeToGeneratedDir(context.emitterOutputDir, file.name, file.content);
  }
}

async function writeToGeneratedDir(outDir: string, filename: string, content: string, subdir?: string): Promise<void> {
  let srcGen = `${outDir}/src/generated`;
  if (subdir) {
    srcGen = path.join(srcGen, subdir);
  }
  await mkdir(srcGen, {recursive: true});
  await writeFile(`${srcGen}/${filename}`, content);
}
