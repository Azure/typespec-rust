/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';

/**
 * emit doc examples for accessing header traits
 * 
 * @param crateName the name of the containing crate
 * @param trait the trait for which to emit the examples
 * @param indent the indentation helper in scope or undefined for no indentation
 * @returns the examples text
 */
export function emitHeaderTraitDocExample(crateName: string, trait: rust.ResponseHeadersTrait, indent?: helpers.indentation): string {
  if (!indent) {
    // missing indent means no indentation
    indent = new helpers.indentation(0);
  }

  let useFromHttp = 'http::Response';
  // JsonFormat is the default so we elide it
  switch (trait.implFor.format) {
    case 'NoFormat':
    case 'XmlFormat':
      useFromHttp = `http::{Response, ${trait.implFor.format}}`;
      break;
  }

  let headerDocs = `${indent.get()}/// ${helpers.emitBackTicks(3)}no_run\n`;
  headerDocs += `${indent.get()}/// use azure_core::{Result, ${useFromHttp}};\n`;
  // we need to unwrap content in case it's a Vec<T> etc
  headerDocs += `${indent.get()}/// use ${crateName}::models::{${helpers.getTypeDeclaration(helpers.unwrapType(trait.implFor.content))}, ${trait.name}};\n`;
  headerDocs += `${indent.get()}/// async fn example() -> Result<()> {\n`;
  headerDocs += `${indent.get()}///     # let response: ${helpers.getTypeDeclaration(trait.implFor)} = unimplemented!();\n`;
  headerDocs += `${indent.get()}///     // Access response headers\n`;

  // show first 3 headers as examples
  const exampleHeaders = trait.headers.slice(0, 3);
  for (const header of exampleHeaders) {
    headerDocs += `${indent.get()}///     if let Some(${header.name}) = response.${header.name}()? {\n`;
    headerDocs += `${indent.get()}///         println!("${header.header}: {:?}", ${header.name});\n`;
    headerDocs += `${indent.get()}///     }\n`;
  }

  headerDocs += `${indent.get()}///     Ok(())\n`;
  headerDocs += `${indent.get()}/// }\n`;
  headerDocs += `${indent.get()}/// ${helpers.emitBackTicks(3)}\n`;

  return headerDocs;
}
