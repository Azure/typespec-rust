/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { EmitContext } from '@typespec/compiler';
import { RustEmitterOptions } from '../lib.js';
import * as rust from '../codemodel/index.js';

export function tcgcToCrate(context: EmitContext<RustEmitterOptions>): rust.Crate {
  const crate = new rust.Crate(context.options['crate-name'], context.options['crate-version']);
  crate.sortContent();
  return crate;
}
