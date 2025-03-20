/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createTypeSpecLibrary, JSONSchemaType } from '@typespec/compiler';

/** the public Rust emitter options */
export interface RustEmitterOptions {
  'crate-name': string;
  'crate-version': string;
  'overwrite-cargo-toml': boolean;
  'overwrite-lib-rs': boolean;
}

const EmitterOptionsSchema: JSONSchemaType<RustEmitterOptions> = {
  type: 'object',
  additionalProperties: true,
  properties: {
    'crate-name': { type: 'string', nullable: false },
    'crate-version': { type: 'string', nullable: false },
    'overwrite-cargo-toml': { type: 'boolean', nullable: false, default: false},
    'overwrite-lib-rs': { type: 'boolean', nullable: false, default: false },
  },
  required: [
    'crate-name',
    'crate-version',
  ],
};

const libDef = {
  name: '@azure-tools/typespec-rust',
  diagnostics: {},
  emitter: {
    options: <JSONSchemaType<RustEmitterOptions>>EmitterOptionsSchema,
  },
} as const;

export const $lib = createTypeSpecLibrary(libDef);
/* eslint-disable-next-line @typescript-eslint/unbound-method */
export const { reportDiagnostic, createStateSymbol, getTracer } = $lib;
