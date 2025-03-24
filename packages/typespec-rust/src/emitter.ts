/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CodeGenerator } from './codegen/codeGenerator.js';
import { Adapter } from './tcgcadapter/adapter.js';
import { RustEmitterOptions } from './lib.js';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { EmitContext, NoTarget } from '@typespec/compiler';
import 'source-map-support/register.js';

/**
 * entry point called by the tsp compiler
 * 
 * @param context the emit context
 */
export async function $onEmit(context: EmitContext<RustEmitterOptions>) {
  const adapter = await Adapter.create(context);
  const crate = adapter.tcgcToCrate();

  await mkdir(`${context.emitterOutputDir}/src`, {recursive: true});

  const codegen = new CodeGenerator(crate);

  // don't overwrite an existing Cargo.toml file by default
  // TODO: consider merging existing dependencies with emitted dependencies when overwriting
  // https://github.com/Azure/typespec-rust/issues/22
  const cargoTomlPath = `${context.emitterOutputDir}/Cargo.toml`;
  if (existsSync(cargoTomlPath) && context.options['overwrite-cargo-toml'] !== true) {
    context.program.reportDiagnostic({
      code: 'FileAlreadyExists',
      severity: 'warning',
      message: `skip overwriting file ${cargoTomlPath}`,
      target: NoTarget,
    });
  } else {
    await writeFile(cargoTomlPath, codegen.emitCargoToml());
  }

  const libRsPath = `${context.emitterOutputDir}/src/lib.rs`;
  if (existsSync(libRsPath) && context.options['overwrite-lib-rs'] !== true) {
    context.program.reportDiagnostic({
      code: 'FileAlreadyExists',
      severity: 'warning',
      message: `skip overwriting file ${libRsPath}`,
      target: NoTarget,
    });
  } else {
    await writeFile(libRsPath, codegen.emitLibRs());
  }

  const files = codegen.emitContent();
  rmSync(path.join(context.emitterOutputDir, 'src', 'generated'), { force: true, recursive: true });
  for (const file of files) {
    await writeToGeneratedDir(context.emitterOutputDir, file.name, file.content);
  }

  // probe to see if cargo is on the path before executing cargo fmt.
  // we do this to avoid having to parse any output from cargo fmt to
  // distinguish between failure due to not on the path vs a legit failure
  // like choking on malformed code.
  try {
    execSync('cargo --version', { encoding: 'ascii' });
  } catch {
    context.program.reportDiagnostic({
      code: 'CargoFmt',
      severity: 'warning',
      message: 'skip executing cargo fmt (is cargo on the path?)',
      target: NoTarget,
    });

    // no cargo available so exit
    return;
  }

  try {
    execSync('cargo fmt -- --emit files', { cwd: context.emitterOutputDir, encoding: 'ascii' });
  } catch (err) {
    context.program.reportDiagnostic({
      code: 'CargoFmt',
      severity: 'error',
      message: (<Error>err).message,
      target: NoTarget,
    });
  }
}

/**
 * 
 * @param outDir the output directory provided by the tsp compiler
 * @param filename the name of the file to write. can contain sub-directories
 * @param content the contents of the file
 */
async function writeToGeneratedDir(outDir: string, filename: string, content: string): Promise<void> {
  const fullFilePath = path.join(outDir, 'src', 'generated', filename);
  const fullDirPath = fullFilePath.substring(0, fullFilePath.lastIndexOf(path.sep));
  await mkdir(fullDirPath, {recursive: true});
  await writeFile(fullFilePath, content);
}
