/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/**
 * Context contains contextual information about how types are used.
 * It's an implementation detail of CodeGenerator and isn't intended
 * for use outside of that class.
 */
export class Context {
  private readonly bodyFormatForModels = new Map<rust.Model, rust.BodyFormat>();
  private readonly tryFromForRequestTypes = new Map<string, rust.BodyFormat>();
  private readonly tryFromResponseTypes = new Map<string, rust.BodyFormat>();

  /**
   * instantiates a new Context for the provided crate
   * 
   * @param crate the crate for which the context will be constructed
   */
  constructor(crate: rust.Crate) {
    const recursiveAddBodyFormat = (type: rust.Type, format: rust.BodyFormat) => {
      type = helpers.unwrapType(type);
      if (type.kind !== 'model') {
        return;
      }

      const existingFormat = this.bodyFormatForModels.get(type);
      if (existingFormat) {
        if (existingFormat === format) {
          // already processed this model
          return;
        }
        throw new Error(`found conflicting body formats for model ${type.name}`);
      }

      this.bodyFormatForModels.set(type, format);
      for (const field of type.fields) {
        recursiveAddBodyFormat(field.type, format);
      }
    };

    // enumerate all client methods, looking for enum and model
    // params/responses and their wire format (JSON/XML etc).
    for (const client of crate.clients) {
      for (const method of client.methods) {
        if (method.kind === 'clientaccessor') {
          continue;
        }

        // TODO: this doesn't handle the case where a method sends/receives a HashMap<T>
        // or Vec<T> where T is an enum or model type.
        // https://github.com/Azure/typespec-rust/issues/65

        for (const param of method.params) {
          if (param.kind === 'body' || param.kind === 'partialBody') {
            if (param.type.content.kind === 'bytes') {
              // no body format to propagate
              continue;
            }
            if (param.type.content.type.kind === 'enum' || param.type.content.type.kind === 'model') {
              this.tryFromForRequestTypes.set(helpers.getTypeDeclaration(param.type.content.type), param.type.content.format);
            }
            recursiveAddBodyFormat(param.type.content.type, param.type.content.format);
          }
        }

        if (method.returns.type.kind === 'response' && method.returns.type.content.kind === 'payload') {
          if (!method.returns.type.content.format) {
            throw new Error(`method ${client.name}.${method.name} returns a body but no format was specified`);
          }
          if (method.returns.type.content.type.kind === 'enum' || method.returns.type.content.type.kind === 'model') {
            this.tryFromResponseTypes.set(helpers.getTypeDeclaration(method.returns.type.content.type), method.returns.type.content.format);
          }
          recursiveAddBodyFormat(method.returns.type.content.type, method.returns.type.content.format);
        } else if (method.returns.type.kind === 'pager') {
          this.tryFromResponseTypes.set(helpers.getTypeDeclaration(method.returns.type.type), method.returns.type.format);
          recursiveAddBodyFormat(method.returns.type.type, method.returns.type.format);
        }
      }
    }
  }

  /**
   * returns the impl TryFrom<T> for RequestContent<T> where T is type.
   * if no impl is required, it returns the empty string.
   * 
   * @param type the type for which to implement TryFrom
   * @param use the use statement builder currently in scope
   * @returns the impl TryFrom<T> block for type or the empty string
   */
  getTryFromForRequestContent(type: rust.Type, use: Use): string {
    const format = this.tryFromForRequestTypes.get(helpers.getTypeDeclaration(type));
    if (!format) {
      return '';
    }

    use.addTypes('azure_core', ['RequestContent', 'Result']);
    use.addType('typespec_client_core', `${format}::to_${format}`);

    const indent = new helpers.indentation();
    let content = `impl TryFrom<${helpers.getTypeDeclaration(type)}> for RequestContent<${helpers.getTypeDeclaration(type)}> {\n`;
    content += `${indent.get()}type Error = azure_core::Error;\n`;
    content += `${indent.get()}fn try_from(value: ${helpers.getTypeDeclaration(type)}) -> Result<Self> {\n`;
    content += `${indent.push().get()}RequestContent::try_from(to_${format}(&value)?)\n`;
    content += `${indent.pop().get()}}\n`;
    content += '}\n\n';
    return content;
  }

  /**
   * returns the impl azure_core::Model for the specified type.
   * if no impl is required, it returns the empty string.
   * 
   * @param type the type for which to implement TryFrom
   * @param use the use statement builder currently in scope
   * @returns the impl azure_core::Model block for type or the empty string
   */
  getModelImplForType(type: rust.Type, use: Use): string {
    const format = this.tryFromResponseTypes.get(helpers.getTypeDeclaration(type));
    if (!format) {
      return '';
    }

    use.addType('azure_core', 'ResponseBody');

    const indent = new helpers.indentation();
    let content = `impl azure_core::Model for ${helpers.getTypeDeclaration(type)} {\n`;
    content += `${indent.get()}async fn from_response_body(body: ResponseBody) -> Result<Self> {\n`;
    content += `${indent.push().get()}body.${format}().await\n`;
    content += `${indent.pop().get()}}\n`;
    content += '}\n\n';
    return content;
  }

  /**
   * returns the body format for the provided model
   * 
   * @param model the model for which to determine the format
   * @returns the body format
   */
  getModelBodyFormat(model: rust.Model): rust.BodyFormat {
    let bodyFormat = this.bodyFormatForModels.get(model);
    if (!bodyFormat) {
      // tsp behavior is to default to json when not specified.
      // we should only hit this for cases where a model isn't
      // used by an operation and has explicitly been annotated
      // to not be pruned.
      bodyFormat = 'json';
    }
    return bodyFormat;
  }
}
