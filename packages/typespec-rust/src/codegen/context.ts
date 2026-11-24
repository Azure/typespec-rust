/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CodegenError } from './errors.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';
// cspell:ignore tcgcadapter
import * as naming from '../tcgcadapter/naming.js';
import * as utils from '../utils/utils.js';

/**
 * Context contains contextual information about how types are used.
 * It's an implementation detail of CodeGenerator and isn't intended
 * for use outside of that class.
 */
export class Context {
  private readonly bodyFormatForModels = new Map<rust.Model, helpers.ModelFormat>();
  private readonly tryFromForRequestTypes = new Map<string, rust.ModelPayloadFormatType>();
  private readonly pagedResponseTypes = new Set<rust.Model>();
  private readonly lroStatusTypes = new Set<rust.Model>();
  private readonly lroStatusMetadata = new Map<rust.Model, rust.LroStatusMetadata | undefined>();
  private readonly lroStatusOperations = new Map<rust.Model, Array<{ name: string; metadata?: rust.LroStatusMetadata }>>();
  private readonly lroResultTypes = new Map<rust.Model, rust.WireType>();

  /**
   * instantiates a new Context for the provided crate
   *
   * @param crate the crate for which the context will be constructed
   */
  constructor(crate: rust.Crate) {
    this.recursivePopulate(crate);
    const errors: string[] = [];
    for (const [model, operations] of this.lroStatusOperations) {
      if (operations.some(operation => helpers.hasCustomTerminalStatus(operation.metadata))
        && new Set(operations.map(operation => statusMetadataKey(operation.metadata))).size > 1) {
        errors.push(`Shared LRO monitor ${model.name} has indistinguishable incompatible status metadata for ${operations.map(operation => operation.name).join(', ')}`);
      }
    }
    if (errors.length > 0) {
      throw new CodegenError('UnsupportedTsp', errors.join('\n'));
    }
  }

  private recursivePopulate(module: rust.ModuleContainer): void {
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
    for (const client of module.clients) {
      for (const method of client.methods) {
        if (method.kind === 'clientaccessor') {
          continue;
        } else if (method.kind === 'pageable' && method.returns.type.kind === 'pager') {
          // impls are for pagers only (not page iterators)
          this.pagedResponseTypes.add(method.returns.type.type.content);
        } else if (method.kind === 'lro' && method.returns.type.kind === 'poller') {
          this.lroStatusTypes.add(method.returns.type.type.content);
          {
            const operations = this.lroStatusOperations.get(method.returns.type.type.content) ?? [];
            operations.push({ name: method.languageIndependentName, metadata: method.statusMetadata });
            this.lroStatusOperations.set(method.returns.type.type.content, operations);
            this.lroStatusMetadata.set(method.returns.type.type.content, method.statusMetadata);
          }

          if (method.returns.type.resultType !== undefined) {
            this.lroResultTypes.set(method.returns.type.type.content, method.returns.type.resultType.content);
          }
        }

        // TODO: this doesn't handle the case where a method sends/receives a HashMap<T>
        // or Vec<T> where T is an enum or model type.
        // https://github.com/Azure/typespec-rust/issues/65

        for (const param of method.params) {
          if (param.kind === 'body' || param.kind === 'partialBody') {
            if (param.type.format === 'NoFormat' || param.type.format === 'BinaryFormat') {
              // no body format to propagate
              continue;
            }
            if (param.type.content.kind === 'enum' || param.type.content.kind === 'model' || param.type.content.kind === 'discriminatedUnion') {
              this.tryFromForRequestTypes.set(helpers.getTypeDeclaration(param.type.content), param.type.format);
            }
            recursiveAddBodyFormat(param.type.content, helpers.convertResponseFormat(param.type.format));
          }
        }

        switch (method.returns.type.kind) {
          case 'pageIterator':
          case 'pager': {
            recursiveAddBodyFormat(method.returns.type.type.content, helpers.convertResponseFormat(method.returns.type.type.format));
            break;
          }
          case 'response': {
            if (method.returns.type.format !== 'NoFormat' && method.returns.type.format !== 'BinaryFormat') {
              recursiveAddBodyFormat(method.returns.type.content, helpers.convertResponseFormat(method.returns.type.format));
            }
            break;
          }
        }
      }
    }

    for (const subModule of module.subModules) {
      this.recursivePopulate(subModule);
    }
  }

  /**
   * returns the impl TryFrom<T> for RequestContent<T> where T is type.
   * if no impl is required, the empty string is returned.
   *
   * @param model the model for which to implement TryFrom
   * @param use the use statement builder currently in scope
   * @returns the impl TryFrom<T> block for type or the empty string
   */
  getTryFromForRequestContent(model: rust.DiscriminatedUnion | rust.Enum | rust.Model, use: Use): string {
    const format = this.tryFromForRequestTypes.get(helpers.getTypeDeclaration(model));
    if (!format) {
      return '';
    }

    if (format != 'JsonFormat') {
      use.add('azure_core::http', format);
    }
    use.add('azure_core', 'Result');
    use.add('azure_core::http', 'RequestContent');
    const moduleName = helpers.convertResponseFormat(format);
    use.add('azure_core', `${moduleName}::to_${moduleName}`);

    const indent = new helpers.indentation();
    const formatTypeDeclaration = `${format !== 'JsonFormat' ? `, ${format}` : ''}`;
    let content = `impl TryFrom<${helpers.getTypeDeclaration(model)}> for RequestContent<${helpers.getTypeDeclaration(model)}${formatTypeDeclaration}> {\n`;
    content += `${indent.get()}type Error = azure_core::Error;\n`;
    content += `${indent.get()}fn try_from(value: ${helpers.getTypeDeclaration(model)}) -> Result<Self> {\n`;
    content += `${indent.push().get()}Ok(to_${moduleName}(&value)?.into())\n`;
    content += `${indent.pop().get()}}\n`;
    content += '}\n\n';
    return content;
  }

  /**
   * returns the impl azure_core::Error for the error type.
   * if no impl is required, the empty string is returned.
   *
   * @param model the model for which to implement TryFrom
   * @param use the use statement builder currently in scope
   * @returns the impl TryFrom<T> block for type or the empty string
   */
  getTryFromForError(model: rust.Model, use: Use): string {
    if ((model.flags & rust.ModelFlags.Error) === 0) {
      return '';
    }

    // eslint-disable-next-line no-useless-assignment
    let deserialize = '';
    const bodyFormat = this.getModelBodyFormat(model) as string;
    switch (bodyFormat) {
      case 'json':
        deserialize = 'Ok(raw_response.body().json()?)';
        break;
      case 'xml':
        deserialize = 'Ok(raw_response.body().xml()?)';
        break;
      default:
        throw new CodegenError('InternalError', `found unknown model body format '${bodyFormat}' for model ${model.name}.`);
    }

    use.add('azure_core::error', 'ErrorKind');
    const indent = new helpers.indentation();
    let content = `impl TryFrom<azure_core::Error> for ${helpers.getTypeDeclaration(model)} {\n`;
    content += `${indent.get()}type Error = azure_core::Error;\n`;
    content += `${indent.get()}fn try_from(error: azure_core::Error) -> std::result::Result<Self, Self::Error> {\n`;
    content += `${indent.push().get()}match error.kind() {`
    content += `${indent.push().get()}ErrorKind::HttpResponse { raw_response: Some(raw_response), .. } => ${deserialize},`;
    content += `${indent.get()}_ => Err(azure_core::Error::with_message(azure_core::error::ErrorKind::DataConversion, "ErrorKind was not HttpResponse and could not be parsed."))`;
    content += `${indent.pop().get()}}\n`;
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

    // find the page items field in the model.
    // since the items can be nested, we need to
    // traverse through the models.

    const fieldPaths = new Array<string>();
    const recursiveFindPageItemsField = function(model: rust.Model): rust.ModelField | undefined {
      for (const field of model.fields) {
        if (field.kind === 'additionalProperties') {
          continue;
        }
        if ((field.flags & rust.ModelFieldFlags.PageItems) !== 0) {
          fieldPaths.push(field.name);
          let pageItemsField: rust.ModelField | undefined;
          if (field.type.kind === 'model') {
            pageItemsField = recursiveFindPageItemsField(field.type);
          }

          // if the child type has a paged items field then favor that (nested case)
          if (pageItemsField) {
            return pageItemsField;
          } else {
            return field;
          }
        }
      }
      return undefined;
    };

    const pageItemsField = recursiveFindPageItemsField(model);
    if (!pageItemsField) {
      throw new CodegenError('InternalError', `didn't find page items field in model ${model.name}`);
    }

    use.addForType(model);
    use.addForType(pageItemsField.type);
    use.add('async_trait', 'async_trait');
    use.add('azure_core', 'Result');
    use.add('azure_core::http::pager', 'Page');

    const indent = new helpers.indentation();

    let content = '#[async_trait]\n';
    content += `impl Page for ${model.name} {\n`;
    content += `${indent.get()}type Item = ${helpers.getTypeDeclaration(helpers.unwrapType(pageItemsField.type))};\n`;
    content += `${indent.get()}type IntoIter = <${helpers.getTypeDeclaration(pageItemsField.type)} as IntoIterator>::IntoIter;\n`;
    content += `${indent.get()}async fn into_items(self) -> Result<Self::IntoIter> {\n`;
    content += `${indent.push().get()}Ok(self.${fieldPaths.join('.')}.into_iter())\n`;
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
    if (!this.lroStatusTypes.has(model)) {
      return undefined;
    }

    const resultType = this.lroResultTypes.get(model);
    const formatType = resultType === undefined && helpers.getCrate(model.module).type === 'azure-arm' ? 'NoFormat'
      : this.getModelBodyFormat(model) === 'json' ? 'JsonFormat' : 'XmlFormat';
    use.add('azure_core::http', formatType);

    use.addForType(model);
    if (resultType !== undefined) {
      use.addForType(resultType);
    }
    use.add('azure_core::http::poller', 'StatusMonitor', 'PollerStatus');

    const indent = new helpers.indentation();

    const outputType = resultType !== undefined ? helpers.getTypeDeclaration(resultType) : '()';
    const statusMetadata = this.lroStatusMetadata.get(model);
    let content = '';
    const modelStatusField = helpers.getStatusField(model);
    const modelStatusType = modelStatusField ? helpers.unwrapType(modelStatusField.type) : undefined;
    const hasCustomTerminalStatus = helpers.hasCustomTerminalStatus(statusMetadata);
    const statusFields = hasCustomTerminalStatus && statusMetadata?.polling
      ? getModelFieldPath(model, statusMetadata.polling.path)
      : undefined;
    const statusField = statusFields?.[statusFields.length - 1] ?? modelStatusField;
    const statusEnum = statusField ? helpers.unwrapType(statusField.type) : modelStatusType;
    if (hasCustomTerminalStatus) {
      if (statusEnum?.kind === 'enum') {
        use.addForType(statusEnum);
      }

      if (statusMetadata) {
        helpers.getCrate(model.module).addDependency(new rust.CrateDependency('serde_json'));
        content += emitStatusResponseDecoders(model, statusMetadata, indent.pop());
        indent.push();
      }
      content += `impl ${model.name} {\n`;
      const mappings = new Map<string, rust.Enum | undefined>([['lro_status_from_str', statusEnum?.kind === 'enum' ? statusEnum : undefined]]);
      for (const [kind, source] of statusMetadata ? getStatusResponseSources(statusMetadata) : []) {
        mappings.set(statusHelper(kind, source, statusEnum, statusMetadata), source.statusEnum);
      }
      for (const [helper, sourceEnum] of mappings) {
        content += `${indent.get()}fn ${helper}(status: &str) -> PollerStatus {\n`;
        content += `${indent.push().get()}${helpers.buildMatch(indent, 'status', [
          ...terminalMapping(sourceEnum).map(([value, classification]) => ({
            pattern: `_ if status.eq_ignore_ascii_case(${JSON.stringify(value)})`,
            body: (indent: helpers.indentation) => `${indent.get()}PollerStatus::${classification}\n`,
          })),
          {
            pattern: '_',
            body: (indent: helpers.indentation) => `${indent.get()}PollerStatus::InProgress\n`,
          },
        ])}\n`;
        content += `${indent.pop().get()}}\n`;
      }

      if (statusEnum?.kind === 'enum') {
        content += `${indent.get()}fn lro_status_from_enum(value: &${helpers.getTypeDeclaration(statusEnum)}) -> PollerStatus {\n`;
        content += `${indent.push().get()}Self::lro_status_from_str(value.as_ref())\n`;
        content += `${indent.pop().get()}}\n`;
      }
      content += '}\n\n';
    }

    content += `impl StatusMonitor for ${model.name} {\n`;
    content += `${indent.get()}type Output = ${outputType};\n`;
    content += `${indent.get()}type Format = ${formatType};\n`;
    content += `${indent.get()}fn status(&self) -> PollerStatus {\n`;

    indent.push();
    const statusExpression = hasCustomTerminalStatus
      ? getCustomMonitorStatusExpression(statusFields, statusField, indent)
      : helpers.getPollerStatusExpression('self', modelStatusField);
    content += `${indent.get()}${statusExpression}\n`;

    content += `${indent.pop().get()}}\n`; // end fn
    if (hasCustomTerminalStatus && statusMetadata) {
      content += emitStatusResponseClassifier(model, statusMetadata, use, indent, statusEnum);
    }
    content += '}\n\n'; // end impl

    return content;
  }
}

function getModelFieldPath(model: rust.Model, path: string[]): Array<rust.ModelField> | undefined {
  const fields: rust.ModelField[] = [];
  let current = model;
  for (const serializedName of path) {
    const field = current.fields.find(
      (candidate): candidate is rust.ModelField => candidate.kind === 'modelField' && candidate.serde === serializedName,
    );
    if (!field) {
      return undefined;
    }
    fields.push(field);
    const type = helpers.unwrapType(field.type);
    if (type.kind !== 'model') {
      if (serializedName !== path[path.length - 1]) {
        return undefined;
      }
    } else {
      current = type;
    }
  }
  return fields;
}

function getCustomMonitorStatusExpression(
  statusFields: Array<rust.ModelField> | undefined,
  statusField: rust.ModelField | undefined,
  indent: helpers.indentation,
): string {
  if (!statusField) {
    return 'PollerStatus::Succeeded';
  }
  if (!statusFields || statusFields.length === 1) {
    return helpers.getPollerStatusExpression('self', statusField, true);
  }

  let content = '{\n';
  indent.push();
  let receiver = 'self';
  for (const [index, field] of statusFields.slice(0, -1).entries()) {
    const binding = `status_parent_${index}`;
    if (field.type.kind === 'option') {
      content += `${indent.get()}let Some(${binding}) = ${receiver}.${field.name}.as_ref() else { return PollerStatus::InProgress; };\n`;
    } else {
      content += `${indent.get()}let ${binding} = &${receiver}.${field.name};\n`;
    }
    receiver = binding;
  }
  content += `${indent.get()}${helpers.getPollerStatusExpression(receiver, statusField, true)}\n`;
  content += `${indent.pop().get()}}`;
  return content;
}

function terminalMapping(statusEnum?: rust.Type): Array<[string, string]> {
  const values = new Map<string, [string, string]>([
    ['succeeded', ['Succeeded', 'Succeeded']], ['failed', ['Failed', 'Failed']],
    ['canceled', ['Canceled', 'Canceled']], ['cancelled', ['Cancelled', 'Canceled']],
  ]);
  if (statusEnum?.kind === 'enum') {
    for (const value of statusEnum.values) {
      if (value.lroTerminalStatus && typeof value.value === 'string') {
        values.set(value.value.replace(/[A-Z]/g, c => c.toLowerCase()), [value.value, value.lroTerminalStatus]);
      }
    }
  }
  return Array.from(values).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

function mappingKey(type?: rust.Type): string {
  return JSON.stringify(terminalMapping(type).map(([wire, role]) => [wire.replace(/[A-Z]/g, c => c.toLowerCase()), role]));
}

function statusHelper(kind: string, source: rust.LroStatusSource, instance?: rust.Type, metadata?: rust.LroStatusMetadata): string {
  const key = mappingKey(source.statusEnum);
  if (key === mappingKey(instance)) {
    return 'lro_status_from_str';
  }
  const firstKind = metadata
    ? Array.from(getStatusResponseSources(metadata)).find(([, candidate]) => mappingKey(candidate.statusEnum) === key)?.[0]
    : undefined;
  return `lro_${(firstKind ?? kind).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()}_status_from_str`;
}

function statusMetadataKey(metadata?: rust.LroStatusMetadata): string {
  if (!metadata) {
    return '';
  }
  return JSON.stringify(Array.from(getStatusResponseSources(metadata)).sort(([a], [b]) => a.localeCompare(b)).map(([kind, source]) =>
    [kind, source.path, getStatusFieldNames(source), source.optional ?? source.path.map(() => false),
      source.nullable ?? source.path.map(() => false), mappingKey(source.statusEnum)]));
}

function getStatusResponseSources(metadata: rust.LroStatusMetadata): Map<string, rust.LroStatusSource> {
  const sources = new Map<string, rust.LroStatusSource>();
  if (metadata.initial) {
    sources.set('Initial', metadata.initial);
  }
  for (const kind of metadata.pollingKinds ?? []) {
    const source = metadata.resourcePolling && (kind === 'Location' || kind === 'OriginalUrl')
      ? metadata.resource
      : metadata.polling;
    if (source) {
      sources.set(kind, source);
    }
  }
  return sources;
}

function getStatusFieldNames(source: rust.LroStatusSource): string[] {
  return source.fieldNames ?? source.path.map(name => naming.getEscapedReservedName(utils.snakeCaseName(name), 'prop'));
}

function emitStatusResponseDecoders(model: rust.Model, metadata: rust.LroStatusMetadata, indent: helpers.indentation): string {
  let content = '';
  content += `${indent.get()}/// Borrows ordinary status strings and owns decoded escaped strings.\n`;
  content += `${indent.get()}#[derive(serde::Deserialize)]\n${indent.get()}#[serde(transparent)]\n`;
  content += `${indent.get()}struct ${model.name}StatusValue<'a>(#[serde(borrow)] std::borrow::Cow<'a, str>);\n\n`;
  for (const [kind, source] of getStatusResponseSources(metadata)) {
    const { path, optional, nullable } = source;
    const fieldNames = getStatusFieldNames(source);
    const prefix = `${model.name}${kind}StatusResponse`;
    const typeNames = fieldNames.map((_, index) =>
      prefix + fieldNames.slice(0, index).map(name => utils.pascalCase(name, false)).join(''));
    content += `${indent.get()}/// Reads operation status without deserializing the public resource model.\n`;
    for (let index = path.length - 1; index >= 0; index--) {
      const currentType = typeNames[index];
      const fieldType = index === path.length - 1 ? `${model.name}StatusValue<'a>` : `${typeNames[index + 1]}<'a>`;
      content += `${indent.get()}#[derive(serde::Deserialize)]\n${indent.get()}struct ${currentType}<'a> {\n`;
      indent.push();
      content += `${indent.get()}#[serde(rename = ${JSON.stringify(path[index])})]\n${indent.get()}#[serde(borrow)]\n`;
      if (nullable?.[index] && !optional?.[index]) {
        content += `${indent.get()}#[serde(deserialize_with = "serde::Deserialize::deserialize")]\n`;
      }
      content += `${indent.get()}${fieldNames[index]}: ${optional?.[index] || nullable?.[index] ? `Option<${fieldType}>` : fieldType},\n`;
      content += `${indent.pop().get()}}\n\n`;
    }
  }
  return content;
}

function emitStatusResponseClassifier(
  model: rust.Model,
  metadata: rust.LroStatusMetadata,
  use: Use,
  indent: helpers.indentation,
  instance?: rust.Type,
): string {
  const sources = getStatusResponseSources(metadata);
  if (sources.size === 0) {
    return '';
  }

  use.add('azure_core::http', 'RawResponse');
  use.add('azure_core::http::poller', 'StatusResponseKind');

  let content = `${indent.get()}fn status_from_response(response: &RawResponse, kind: StatusResponseKind) -> azure_core::Result<Option<PollerStatus>> where Self: Sized {\n`;
  content += `${indent.push().get()}if response.body().is_empty() { return Ok(None); }\n`;
  content += `${indent.get()}match kind {\n`;
  indent.push();
  for (const [kind, source] of sources) {
    const { path, optional, nullable } = source;
    const fieldNames = getStatusFieldNames(source);
    const prefix = `${model.name}${kind}StatusResponse`;
    content += `${indent.push().get()}StatusResponseKind::${kind} => {\n`;
    content += `${indent.push().get()}let response: ${prefix}<'_> = serde_json::from_slice(response.body())?;\n`;
    let access = 'response';
    for (const [index] of path.entries()) {
      const fieldName = fieldNames[index];
      if (optional?.[index] || nullable?.[index]) {
        content += `${indent.get()}let Some(${fieldName}) = ${access}.${fieldName} else { return Ok(Some(PollerStatus::InProgress)); };\n`;
      } else {
        content += `${indent.get()}let ${fieldName} = ${access}.${fieldName};\n`;
      }
      access = fieldName;
    }
    content += `${indent.get()}Ok(Some(Self::${statusHelper(kind, source, instance, metadata)}(${access}.0.as_ref())))\n`;
    content += `${indent.pop().get()}},\n`;
    indent.pop();
  }
  content += `${indent.get()}_ => Ok(None),\n`;
  content += `${indent.pop().get()}}\n`;
  content += `${indent.pop().get()}}\n`;
  return content;
}
