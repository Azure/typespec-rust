/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { strictEqual, throws } from 'assert';
import { describe, it } from 'vitest';
import { createCargoRunner } from '../src/utils/cargo.js';

describe('typespec-rust: cargo', () => {
  it('reports cargo availability when command succeeds', () => {
    const cargo = createCargoRunner(() => {
      return {
        status: 0,
        stdout: 'cargo 1.0.0',
        stderr: '',
      } as never;
    });

    strictEqual(cargo.isCargoAvailable(), true);
  });

  it('reports cargo unavailability when command fails', () => {
    const cargo = createCargoRunner(() => {
      return {
        status: null,
        stdout: '',
        stderr: '',
        error: new Error('not found'),
      } as never;
    });

    strictEqual(cargo.isCargoAvailable(), false);
  });

  it('runs cargo fmt in the specified directory', () => {
    const calls: [string, readonly string[], string | undefined, 'utf-8'][] = [];
    const cargo = createCargoRunner((command, args, options) => {
      calls.push([command, args, options.cwd, options.encoding]);
      return {
        status: 0,
        stdout: '',
        stderr: '',
      } as never;
    });

    cargo.runCargoFmt('/tmp/crate');

    strictEqual(calls.length, 1);
    strictEqual(calls[0][0], 'cargo');
    strictEqual(calls[0][1].join(' '), 'fmt -- --emit files');
    strictEqual(calls[0][2], '/tmp/crate');
    strictEqual(calls[0][3], 'utf-8');
  });

  it('surfaces cargo fmt output when command fails', () => {
    const cargo = createCargoRunner(() => {
      return {
        status: 1,
        stdout: 'failed output',
        stderr: 'failed error',
      } as never;
    });

    throws(() => cargo.runCargoFmt('/tmp/crate'), new Error('command failed: cargo fmt -- --emit files: failed output\nfailed error'));
  });
});
