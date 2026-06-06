/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SpawnSyncReturns, spawnSync } from 'child_process';

type SpawnSyncFunction = (
  command: string,
  args: readonly string[],
  options: { cwd?: string; encoding: 'utf-8' }
) => SpawnSyncReturns<string>;

export function createCargoRunner(spawn: SpawnSyncFunction) {
  function isNonEmptyString(value: string | null): value is string {
    return value !== null && value.trim().length > 0;
  }

  function runCargo(args: string[], cwd?: string): SpawnSyncReturns<string> {
    const result = spawn('cargo', args, { cwd, encoding: 'utf-8' });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const output = [result.stdout, result.stderr]
        .filter(isNonEmptyString)
        .join('\n')
        .trim();
      const details = output.length > 0 ? `: ${output}` : '';
      throw new Error(`command failed: cargo ${args.join(' ')}${details}`);
    }
    return result;
  }

  return {
    isCargoAvailable(): boolean {
      try {
        runCargo(['--version']);
        return true;
      } catch {
        return false;
      }
    },

    runCargoFmt(outputDir: string): void {
      runCargo(['fmt', '--', '--emit', 'files'], outputDir);
    },
  };
}

const cargoRunner = createCargoRunner((command, args, options) => {
  return spawnSync(command, args, options);
});

export function isCargoAvailable(): boolean {
  return cargoRunner.isCargoAvailable();
}

export function runCargoFmt(outputDir: string): void {
  cargoRunner.runCargoFmt(outputDir);
}
