/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//cspell: ignore tcgcadapter

import { CodeGenerator } from './codegen/codeGenerator.js';
import { CodegenError } from './codegen/errors.js';
import { Adapter, AdapterError, ExternalError } from './tcgcadapter/adapter.js';
import { reportDiagnostic, RustEmitterOptions } from './lib.js';
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
  let failed = false;
  try {
    const adapter = await Adapter.create(context);
    const crate = adapter.tcgcToCrate(context);

    await mkdir(`${context.emitterOutputDir}/src`, { recursive: true });

    const codegen = new CodeGenerator(crate);

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

    // NOTE: To allow the generated code to add cargo dependencies as needed (by calling crate.addDependency()),
    // we should be calling emitCargoToml() after all the calls to emitContent() above, and not before.
    // https://github.com/Azure/typespec-rust/issues/746

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
  } catch (error) {
    failed = true;
    if (error instanceof AdapterError) {
      reportDiagnostic(context.program, {
        code: error.code,
        target: error.target,
        format: {
          message: error.message,
          stack: error.stack ? truncateStack(error.stack, 'tcgcToCrate') : 'Stack trace unavailable\n',
        }
      });
    } else if (error instanceof CodegenError) {
      reportDiagnostic(context.program, {
        code: error.code,
        target: NoTarget,
        format: {
          message: error.message,
          stack: error.stack ? truncateStack(error.stack, 'tcgcToCrate') : 'Stack trace unavailable\n',
        }
      });
    } else if (error instanceof ExternalError) {
      // we don't want to throw in this case as that will
      // make it appear as if the emitter crashed. just
      // exit so the diagnostic error isn't lost in the noise
      return;
    } else {
      throw error;
    }
  }

  if (failed) {
    // don't try to format etc if the emitter failed
    return;
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
  await mkdir(fullDirPath, { recursive: true });
  await writeFile(fullFilePath, content);
}

/**
 * drop frames after the specified frame.
 * 
 * @param stack the stack to truncate
 * @returns the truncated stack
 */
function truncateStack(stack: string, finalFrame: string): string {
  const lines = stack.split('\n');
  stack = '';
  for (const line of lines) {
    stack += `${line}\n`;
    if (line.includes(finalFrame)) {
      break;
    }
  }
  return stack;
}
