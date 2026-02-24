/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import * as rust from '../codemodel/index.js';
import * as utils from '../utils/utils.js';

/**
 * emit doc examples for accessing header traits
 * 
 * @param trait the trait for which to emit the examples
 * @param indent the indentation helper in scope or undefined for no indentation
 * @returns the examples text
 */
export function emitHeaderTraitDocExample(trait: rust.ResponseHeadersTrait, indent?: helpers.indentation): string {
  if (!indent) {
    // missing indent means no indentation
    indent = new helpers.indentation(0);
  }

  let targetType: rust.MarkerType | rust.Model;
  let useFromHttp = 'http::Response';
  switch (trait.implFor.kind) {
    case 'asyncResponse':
      useFromHttp = 'http::AsyncResponse';
      targetType = trait.implFor.type;
      break;
    case 'response':
      // JsonFormat is the default so we elide it
      switch (trait.implFor.format) {
        case 'NoFormat':
        case 'XmlFormat':
          useFromHttp = `http::{Response, ${trait.implFor.format}}`;
          break;
      }
      targetType = trait.implFor.content;
      break;
  }

  // internal types aren't accessible in doc tests so we ignore them
  let headerDocs = `${indent.get()}/// ${helpers.emitBackTicks(3)}${trait.visibility === 'pub' ? 'no_run' : 'ignore'}\n`;
  headerDocs += `${indent.get()}/// use azure_core::{Result, ${useFromHttp}};\n`;

  const crateName = helpers.getCrate(trait.module).name;
  if (targetType.kind !== 'model' || targetType.module === trait.module) {
    // this is either a marker type or a model in the same module as the trait.
    // either way, we can combine them into a single import statement.
    headerDocs += `${indent.get()}/// use ${utils.buildImportPath(trait.module, trait.module, crateName)}::models::{${helpers.getTypeDeclaration(targetType)}, ${trait.name}};\n`;
  } else {
    // the model and trait are in different modules, so we need to import both
    const imports = new Array<string>(
      `${utils.buildImportPath(trait.module, trait.module, crateName)}::models::${trait.name}`,
      `${utils.buildImportPath(trait.module, targetType.module, crateName)}::models::${helpers.getTypeDeclaration(targetType)}`,
    );
    headerDocs += imports.sort().map(imp => `${indent.get()}/// use ${imp};\n`).join('');
  }

  headerDocs += `${indent.get()}/// async fn example() -> Result<()> {\n`;
  headerDocs += `${indent.get()}///     let response: ${helpers.getTypeDeclaration(trait.implFor)} = unimplemented!();\n`;
  headerDocs += `${indent.get()}///     // Access response headers\n`;

  // show first 3 headers as examples
  const exampleHeaders = trait.headers.slice(0, 3);
  for (const header of exampleHeaders) {
    if (header.kind === 'responseHeaderScalar') {
      headerDocs += `${indent.get()}///     if let Some(${header.name}) = response.${header.name}()? {\n`;
      headerDocs += `${indent.get()}///         println!("${header.header}: {:?}", ${header.name});\n`;
      headerDocs += `${indent.get()}///     }\n`;
    } else {
      headerDocs += `${indent.get()}///     println!("${header.header}: {:?}", response.${header.name}()?);\n`;
    }
  }

  headerDocs += `${indent.get()}///     Ok(())\n`;
  headerDocs += `${indent.get()}/// }\n`;
  headerDocs += `${indent.get()}/// ${helpers.emitBackTicks(3)}\n`;

  return headerDocs;
}
