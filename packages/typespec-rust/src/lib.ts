/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createTypeSpecLibrary, JSONSchemaType, paramMessage } from '@typespec/compiler';

/** the public Rust emitter options */
export interface RustEmitterOptions {
  'crate-name': string;
  'crate-version': string;
  'overwrite-cargo-toml': boolean;
  'overwrite-lib-rs': boolean;
  'temp-omit-doc-links': boolean;
}

const EmitterOptionsSchema: JSONSchemaType<RustEmitterOptions> = {
  type: 'object',
  additionalProperties: true,
  properties: {
    'crate-name': { type: 'string', nullable: false },
    'crate-version': { type: 'string', nullable: false },
    'overwrite-cargo-toml': { type: 'boolean', nullable: false, default: false},
    'overwrite-lib-rs': { type: 'boolean', nullable: false, default: false },
    'temp-omit-doc-links': { type: 'boolean', nullable: false, default: false },
  },
  required: [
    'crate-name',
    'crate-version',
  ],
};

const libDef = {
  name: '@azure-tools/typespec-rust',
  diagnostics: {
    'InternalError': {
      severity: 'error',
      messages: {
        default: paramMessage`The emitter encountered an internal error during preprocessing. Please open an issue at https://github.com/Azure/typespec-rust/issues and include the complete error message.\n${'stack'}`
      }
    },
    'InvalidArgument': {
      severity: 'error',
      messages: {
        default: 'Invalid arguments were passed to the emitter.'
      }
    },
    'NameCollision': {
      severity: 'error',
      messages: {
        default: 'The emitter automatically renamed one or more items which resulted in a name collision. Please update the client.tsp to rename the type(s) to avoid the collision.'
      }
    },
    'UnsupportedTsp': {
      severity: 'error',
      messages: {
        default: paramMessage`The emitter encountered a TypeSpec definition that is currently not supported.\n${'stack'}`
      }
    }
  },
  emitter: {
    options: <JSONSchemaType<RustEmitterOptions>>EmitterOptionsSchema,
  },
} as const;

export const $lib = createTypeSpecLibrary(libDef);
/* eslint-disable-next-line @typescript-eslint/unbound-method */
export const { reportDiagnostic, createStateSymbol, getTracer } = $lib;
