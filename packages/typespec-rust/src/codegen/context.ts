/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CodegenError } from './errors.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';
import { getPayloadFormatType } from '../shared/shared.js';

/**
 * Context contains contextual information about how types are used.
 * It's an implementation detail of CodeGenerator and isn't intended
 * for use outside of that class.
 */
export class Context {
  private readonly bodyFormatForModels = new Map<rust.Model, helpers.ModelFormat>();
  private readonly tryFromForRequestTypes = new Map<string, rust.PayloadFormat>();
  private readonly pagedResponseTypes = new Set<rust.Model>();
  private readonly lroTypes = new Set<rust.Model>();

  /**
   * instantiates a new Context for the provided crate
   * 
   * @param crate the crate for which the context will be constructed
   */
  constructor(crate: rust.Crate) {
    const recursiveAddBodyFormat = (type: rust.Type, format: helpers.ModelFormat) => {
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
        throw new CodegenError('InternalError', `found conflicting body formats for model ${type.name}`);
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
        } else if (method.kind === 'pageable' && method.returns.type.kind === 'pager') {
          // impls are for pagers only (not page iterators)
          this.pagedResponseTypes.add(method.returns.type.type.content);
        } else if (method.kind === 'lro' && method.returns.type.kind === 'poller') {
          this.lroTypes.add(method.returns.type.type.content);
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

        switch (method.returns.type.kind) {
          case 'pageIterator':
          case 'pager': {
            recursiveAddBodyFormat(method.returns.type.type.content, helpers.convertResponseFormat(method.returns.type.type.format));
            break;
          }
          case 'response': {
            if (method.returns.type.format !== 'NoFormat') {
              recursiveAddBodyFormat(method.returns.type.content, helpers.convertResponseFormat(method.returns.type.format));
            }
            break;
          }
        }
      }
    }
  }

  /**
   * returns the impl TryFrom<T> for RequestContent<T> where T is type.
   * if no impl is required, it returns undefined.
   * 
   * @param model the model for which to implement TryFrom
   * @param use the use statement builder currently in scope
   * @returns the impl TryFrom<T> block for type or undefined
   */
  getTryFromForRequestContent(model: rust.Enum | rust.Model, use: Use): string | undefined {
    const format = this.tryFromForRequestTypes.get(helpers.getTypeDeclaration(model));
    if (!format) {
      return undefined;
    }
    
    const formatType = getPayloadFormatType(format);
    if (formatType != 'JsonFormat') {
      use.add('azure_core::http', formatType);
    }
    use.add('azure_core', 'Result');
    use.add('azure_core::http', 'RequestContent');
    use.add('azure_core', `${format}::to_${format}`);

    const indent = new helpers.indentation();
    const formatTypeDeclaration = `${formatType !== 'JsonFormat' ? `, ${formatType}` : ''}`;
    let content = `impl TryFrom<${helpers.getTypeDeclaration(model)}> for RequestContent<${helpers.getTypeDeclaration(model)}${formatTypeDeclaration}> {\n`;
    content += `${indent.get()}type Error = azure_core::Error;\n`;
    content += `${indent.get()}fn try_from(value: ${helpers.getTypeDeclaration(model)}) -> Result<Self> {\n`;
    content += `${indent.push().get()}RequestContent::try_from(to_${format}(&value)?)\n`;
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
  getModelBodyFormat(model: rust.Model): helpers.ModelFormat {
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

  /**
   * returns an azure_core::http::Page impl for the provided model
   * or undefined if the model isn't a paged response type.
   * 
   * @param model the model for which to create the Page impl
   * @param use the use statement builder currently in scope
   * @returns the Page impl or undefined
   */
  getPageImplForType(model: rust.Model, use: Use): string | undefined {
    if (!this.pagedResponseTypes.has(model)) {
      return undefined;
    }

    // find the page items field in the model
    let pageItemsField: rust.ModelField | undefined;
    for (const field of model.fields) {
      if (<rust.ModelFieldFlags>(field.flags & rust.ModelFieldFlags.PageItems) === rust.ModelFieldFlags.PageItems) {
        pageItemsField = field;
        break;
      }
    }

    if (!pageItemsField) {
      throw new CodegenError('InternalError', `didn't find page items field in model ${model.name}`);
    }

    use.addForType(model);
    use.addForType(pageItemsField.type);
    use.add('async_trait', 'async_trait');
    use.add('azure_core', 'http::Page', 'Result');

    const indent = new helpers.indentation();

    let content = '#[cfg_attr(not(target_arch = "wasm32"), async_trait)]\n';
    content += '#[cfg_attr(target_arch = "wasm32", async_trait(?Send))]\n';
    content += `impl Page for ${model.name} {\n`;
    content += `${indent.get()}type Item = ${helpers.getTypeDeclaration(helpers.unwrapType(pageItemsField.type))};\n`;
    content += `${indent.get()}type IntoIter = <${helpers.getTypeDeclaration(pageItemsField.type)} as IntoIterator>::IntoIter;\n`;
    content += `${indent.get()}async fn into_items(self) -> Result<Self::IntoIter> {\n`;
    content += `${indent.push().get()}Ok(self.${pageItemsField.name}.into_iter())\n`;
    content += `${indent.pop().get()}}\n`; // end fn
    content += '}\n\n'; // end impl

    return content;
  }

  /**
   * returns an azure_core::http::poller::StatusMonitor impl for the provided model
   * or undefined if the model isn't an LRO type.
   *
   * @param model the model for which to create the Page impl
   * @param use the use statement builder currently in scope
   * @returns the StatusMonitor impl or undefined
   */
  getStatusMonitorImplForType(model: rust.Model, use: Use): string | undefined {
    if (!this.lroTypes.has(model)) {
      return undefined;
    }

    use.addForType(model);
    use.add('azure_core::http::poller', 'StatusMonitor', 'PollerStatus');

    const indent = new helpers.indentation();

    let content = `impl StatusMonitor for ${model.name} {\n`;
    content += `${indent.get()}type Output = ${helpers.getTypeDeclaration(helpers.unwrapType(model))};\n`;
    content += `${indent.get()}fn status(&self) -> PollerStatus {\n`;

    const statusField = model.fields.find(f => f.name.toLowerCase() === 'status');
    if (statusField) {
      if (statusField.type.kind === 'option') {
        content += `${indent.push().get()}match &self.status { Some(v) => PollerStatus::from(v.as_ref()), None => PollerStatus::InProgress }\n`;
      } else {
        content += `${indent.push().get()}self.status.as_deref().map(Into::into).unwrap_or(PollerStatus::InProgress)\n`;
      }
    } else {
      content += `${indent.push().get()}PollerStatus::Succeeded\n`;
    }

    content += `${indent.pop().get()}}\n`; // end fn
    content += '}\n\n'; // end impl

    return content;
  }
}
