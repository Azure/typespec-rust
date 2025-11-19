/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

//cspell: ignore addl

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import { Context } from './context.js';
import { CodegenError } from './errors.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';
import * as shared from '../shared/shared.js';

/** contains different types of models to emit */
export interface Models {
  /** models that are part of public surface area */
  public?: helpers.Module;

  /** serde helpers for public models */
  serde?: helpers.Module;

  /** trait impls for public models */
  impls?: helpers.Module;

  /** models that are for internal use only */
  internal?: helpers.Module;

  /** XML-specific helpers for internal use only */
  xmlHelpers?: helpers.Module;
}

/**
 * returns the emitted model types, or empty if the
 * crate contains no model types.
 * 
 * @param crate the crate for which to emit models
 * @param context the context for the provided crate
 * @returns the model content or empty
 */
export function emitModels(crate: rust.Crate, context: Context): Models {
  if (crate.models.length === 0) {
    return {};
  }

  return {
    public: emitModelsInternal(crate, context, 'pub'),
    serde: emitModelsSerde(),
    impls: emitModelImpls(crate, context),
    internal: emitModelsInternal(crate, context, 'pubCrate'),
    xmlHelpers: emitXMLListWrappers(),
  };
}

/**
 * the implementation of emitModels
 * 
 * @param crate the crate for which to emit models
 * @param context the context for the provided crate
 * @param visibility the visibility of the models to emit
 * @returns the model content or empty
 */
function emitModelsInternal(crate: rust.Crate, context: Context, visibility: rust.Visibility): helpers.Module | undefined {
  // for the internal models we might need to use public model types
  const use = new Use(visibility === 'pub' ? 'models' : 'modelsOther');
  use.add('azure_core::fmt', 'SafeDebug');

  const indent = new helpers.indentation();

  let body = '';
  for (const model of crate.models) {
    if (visibility === 'pub' && model.kind === 'marker') {
      body += helpers.formatDocComment(model.docs);
      // marker types don't have any fields
      // and don't participate in serde.
      body += '#[derive(SafeDebug)]\n';
      body += `pub struct ${model.name};\n\n`;
      continue;
    } else if (model.kind === 'marker') {
      // marker types are always public, so we skip them for the internal models file
      continue;
    }

    // we add this here to avoid using serde for marker-only models
    use.add('serde', 'Deserialize', 'Serialize');

    if (model.visibility !== visibility) {
      continue;
    }

    const bodyFormat = context.getModelBodyFormat(model);

    // if the model is XML and contains additional properties,
    // it will need a full custom serde implementation. so, we
    // need to omit any serde derive annotations.
    const hasXmlAddlProps = bodyFormat === 'xml' ? values(model.fields).where((each) => each.kind === 'additionalProperties').any() : false;

    body += helpers.formatDocComment(model.docs);
    body += helpers.annotationDerive(!hasXmlAddlProps, 'Default');
    if (<rust.ModelFlags>(model.flags & rust.ModelFlags.Output) === rust.ModelFlags.Output && (model.flags & rust.ModelFlags.Input) === 0) {
      // output-only models get the non_exhaustive annotation
      body += helpers.AnnotationNonExhaustive;
    }

    if (!hasXmlAddlProps && model.xmlName) {
      body += `#[serde(rename = "${model.xmlName}")]\n`;
    }
    body += `${helpers.emitVisibility(model.visibility)}struct ${model.name} {\n`;

    for (const field of model.fields) {
      if (bodyFormat === 'xml' && field.kind === 'additionalProperties') {
        // will need to emit some serde helpers for this type.
        // JSON doesn't need a helper, we can use serde's flatten.
        serdeHelpersForXmlAddlProps.set(model, field);
      }

      use.addForType(field.type);
      body += helpers.formatDocComment(field.docs);

      if (field.kind === 'additionalProperties') {
        if (bodyFormat === 'json') {
          body += `#[serde(flatten)]\n`;
        }
        body += `${indent.get()}${helpers.emitVisibility(field.visibility)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n\n`;
        continue;
      }

      const serdeParams = new Set<string>();
      const fieldRename = getSerDeRename(field);
      if (fieldRename) {
        serdeParams.add(`rename = "${fieldRename}"`);
      }

      // NOTE: usage of serde annotations like this means that base64 encoded bytes and
      // XML wrapped lists are mutually exclusive. it's not a real scenario at present.
      const unwrappedType = helpers.unwrapType(field.type);
      if (unwrappedType.kind === 'encodedBytes' || unwrappedType.kind === 'literal' || unwrappedType.kind === 'offsetDateTime' || encodeAsString(unwrappedType)) {
        addSerDeHelper(field, serdeParams, bodyFormat, use);
      } else if (bodyFormat === 'xml' && shared.unwrapOption(field.type).kind === 'Vec' && field.xmlKind !== 'unwrappedList') {
        // this is a wrapped list so we need a helper type for serde
        const xmlListWrapper = getXMLListWrapper(field);
        serdeParams.add('default');
        serdeParams.add(`deserialize_with = "${xmlListWrapper.name}::unwrap"`);
        serdeParams.add(`serialize_with = "${xmlListWrapper.name}::wrap"`);
        use.add('super::xml_helpers', xmlListWrapper.name);
      } else if (<rust.ModelFieldFlags>(field.flags & rust.ModelFieldFlags.DeserializeEmptyStringAsNone) === rust.ModelFieldFlags.DeserializeEmptyStringAsNone) {
        use.add('azure_core::fmt', 'empty_as_null');
        serdeParams.add(`deserialize_with = "empty_as_null::deserialize"`);
      }

      // TODO: omit skip_serializing_if if we need to send explicit JSON null
      // https://github.com/Azure/typespec-rust/issues/78
      if (field.type.kind === 'option') {
        // optional literals need to skip serializing when it's None
        if (field.type.type.kind !== 'literal' || field.optional) {
          serdeParams.add('skip_serializing_if = "Option::is_none"');
        }
      } else if (visibility === 'pub') {
        // for public models, non-optional fields (e.g. Vec<T> in pageable responses) requires default.
        // crate models don't need this as those are used for spread params and the required params map
        // to the required fields in the struct.
        serdeParams.add('default');
      }

      // default behavior of rust_decimal is to encode/decode
      // as string, so disable that as required
      if (unwrappedType.kind === 'decimal' && !unwrappedType.stringEncoding) {
        serdeParams.add(`with = "rust_decimal::serde::float${field.type.kind === 'option' ? '_option' : ''}"`);
      }

      if (!hasXmlAddlProps && serdeParams.size > 0) {
        body += `${indent.get()}#[serde(${Array.from(serdeParams).sort().join(', ')})]\n`;
      }
      body += `${indent.get()}${helpers.emitVisibility(field.visibility)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n\n`;
    }

    body += '}\n\n';
  }

  if (body === '') {
    // no models for this value of pub
    return undefined;
  }

  // emit TryFrom as required for internal models only.
  // public models will have their helpers in a separate file.
  if (visibility !== 'pub') {
    for (const model of crate.models) {
      if (model.kind === 'marker' || model.visibility === 'pub') {
        continue;
      }

      body += context.getTryFromForRequestContent(model, use);
    }
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: visibility === 'pub' ? 'pub_models' : 'crate_models',
    content: content,
  };
}

/**
 * returns serde helpers for public models.
 * if no helpers are required, undefined is returned.
 * 
 * @returns the model serde helpers content or undefined
 */
function emitModelsSerde(): helpers.Module | undefined {
  const use = new Use('modelsOther');
  const serdeHelpers = emitSerDeHelpers(use);

  if (!serdeHelpers) {
    // no helpers
    return undefined;
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += serdeHelpers;

  return {
    name: 'models_serde',
    content: content,
  };
}

/**
 * returns any trait impls for public models.
 * if no helpers are required, undefined is returned.
 * 
 * @param crate the crate for which to emit model serde helpers
 * @param context the context for the provided crate
 * @returns the model serde helpers content or undefined
 */
function emitModelImpls(crate: rust.Crate, context: Context): helpers.Module | undefined {
  const use = new Use('modelsOther');
  const entries = new Array<string>();

  // emit TryFrom as required
  for (const model of crate.models) {
    if (model.kind === 'marker' || model.visibility !== 'pub') {
      // skip internal models as their serde helpers are in the same file
      continue;
    }

    const forReq = context.getTryFromForRequestContent(model, use);

    // helpers aren't required for all types, so only
    // add a use statement for a type if it has a helper
    if (forReq) {
      use.addForType(model);
      entries.push(forReq);
    }

    const pageImpl = context.getPageImplForType(model, use);
    if (pageImpl) {
      use.addForType(model);
      entries.push(pageImpl);
    }

    const statusMonitorImpl = context.getStatusMonitorImplForType(model, use);
    if (statusMonitorImpl) {
      use.addForType(model);
      entries.push(statusMonitorImpl);
    }
  }

  if (entries.length === 0) {
    // no helpers
    return undefined;
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += entries.sort().join('');

  return {
    name: 'models_impl',
    content: content,
  };
}

/**
 * returns a @ if the field is an XML attribute or the empty string
 * @param field the field for which to emit the symbol
 * @returns the symbol or the empty string
 */
function xmlAttr(field: rust.ModelField): string {
  return field.xmlKind === 'attribute' ? '@' : '';
}

/**
 * returns the value for the rename option in a serde derive macro
 * or undefined if no rename is required.
 * 
 * @param field the field for which to emit a rename
 * @returns the value for the rename option or undefined
 */
function getSerDeRename(field: rust.ModelField): string | undefined {
  if (field.name === field.serde && field.xmlKind !== 'attribute' && field.xmlKind !== 'text') {
    return undefined;
  } else if (field.xmlKind === 'text') {
    return '$text';
  }

  // build the potential attribute and renamed field
  const fieldName = field.name === field.serde ? field.name : field.serde;
  return `${xmlAttr(field)}${fieldName}`;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// XML helpers infrastructure
///////////////////////////////////////////////////////////////////////////////////////////////////

/** helper for wrapped XML lists */
interface XMLListWrapper {
  /** the name of the wrapper type */
  name: string;

  /** the wire name if different from the wrapper type name */
  serde?: string;

  /**
   * the name of the wrapped field.
   * the name is the XML wire name.
   */
  fieldName: string;

  /**
   * the field's type.
   * should be an Option<Vec<T>>
   */
  fieldType: rust.Type;
}

class XMLListWrapper implements XMLListWrapper {
  constructor(name: string, fieldName: string, fieldType: rust.Type) {
    this.name = name;
    this.fieldName = fieldName;
    this.fieldType = fieldType;
  }
}

// used by getXMLListWrapper and emitXMLListWrappers
const xmlListWrappers = new Map<string, XMLListWrapper>();

/**
 * gets or creates an XMLListWrapper for the specified model field.
 * assumes that it's been determined that the wrapper is required.
 * 
 * @param field the field for which to create an XMLWrapper
 * @returns the XMLListWrapper for the provided field
 */
function getXMLListWrapper(field: rust.ModelField): XMLListWrapper {
  // for wrapped lists of scalar types, the element names for
  // scalar types use the TypeSpec defined names. so, we need
  // to translate from Rust scalar types back to TypeSpec.
  let unwrappedFieldTypeName: string;
  const wrappedType = helpers.unwrapType(field.type);
  switch (wrappedType.kind) {
    case 'String':
      unwrappedFieldTypeName = 'string';
      break;
    case 'model':
      if (wrappedType.xmlName) {
        unwrappedFieldTypeName = wrappedType.xmlName;
      } else {
        unwrappedFieldTypeName = wrappedType.name;
      }
      break;
    case 'scalar':
      switch (wrappedType.type) {
        case 'bool':
          unwrappedFieldTypeName = 'boolean';
          break;
        case 'f32':
          unwrappedFieldTypeName = 'float32';
          break;
        case 'f64':
          unwrappedFieldTypeName = 'float64';
          break;
        case 'i16':
          unwrappedFieldTypeName = 'int16';
          break;
        case 'i32':
          unwrappedFieldTypeName = 'int32';
          break;
        case 'i64':
          unwrappedFieldTypeName = 'int64';
          break;
        case 'i8':
          unwrappedFieldTypeName = 'int8';
          break;
        case 'u16':
          unwrappedFieldTypeName = 'uint16';
          break;
        case 'u32':
          unwrappedFieldTypeName = 'uint32';
          break;
        case 'u64':
          unwrappedFieldTypeName = 'uint64';
          break;
        case 'u8':
          unwrappedFieldTypeName = 'uint8';
          break;
      }
      break;
    default:
      unwrappedFieldTypeName = helpers.getTypeDeclaration(wrappedType);
  }

  // the wrapper type name is a combination of the field name and the
  // unwrapped type name of T. this is to ensure unique type names
  const wrapperTypeName = `${helpers.capitalize(field.name)}${helpers.capitalize(unwrappedFieldTypeName)}`;
  let xmlListWrapper = xmlListWrappers.get(wrapperTypeName);
  if (!xmlListWrapper) {
    xmlListWrapper = new XMLListWrapper(wrapperTypeName, unwrappedFieldTypeName, field.type);
    xmlListWrapper.serde = wrapperTypeName === field.serde ? undefined : field.serde;
    xmlListWrappers.set(wrapperTypeName, xmlListWrapper);
  }
  return xmlListWrapper;
}

/**
 * emits helper types for XML lists or returns undefined
 * if no XMLListWrappers are required.
 * 
 * @returns the helper models for wrapped XML lists or undefined
 */
function emitXMLListWrappers(): helpers.Module | undefined {
  if (xmlListWrappers.size === 0) {
    return undefined;
  }

  const wrapperTypes = Array.from(xmlListWrappers.values());
  wrapperTypes.sort((a, b) => { return helpers.sortAscending(a.name, b.name); });

  const indent = new helpers.indentation();
  const use = new Use('modelsOther');

  use.add('serde', 'Deserialize', 'Deserializer', 'Serialize', 'Serializer');

  let body = '';
  for (const wrapperType of wrapperTypes) {
    body += '#[derive(Deserialize, Serialize)]\n';
    if (wrapperType.serde) {
      body += `#[serde(rename = "${wrapperType.serde}")]\n`;
    }

    use.addForType(wrapperType.fieldType);
    const fieldType = helpers.getTypeDeclaration(wrapperType.fieldType);

    body += `pub(crate) struct ${wrapperType.name} {\n`;
    body += `${indent.get()}#[serde(default)]\n`;
    body += `${indent.get()}${wrapperType.fieldName}: ${fieldType},\n`;
    body += '}\n\n';

    body += `impl ${wrapperType.name} {\n`;

    body += `${indent.get()}pub fn unwrap<'de, D>(deserializer: D) -> Result<${fieldType}, D::Error> where D: Deserializer<'de> {\n`;
    body += `${indent.push().get()}Ok(${wrapperType.name}::deserialize(deserializer)?.${wrapperType.fieldName})\n`;
    body += `${indent.pop().get()}}\n\n`;

    const fieldTypeParam = 'to_serialize';
    body += `${indent.get()}pub fn wrap<S>(${fieldTypeParam}: &${fieldType}, serializer: S) -> Result<S::Ok, S::Error> where S: Serializer {\n`;
    body += `${indent.push().get()}${wrapperType.name} {\n`;
    body += `${indent.push().get()}${wrapperType.fieldName}: ${fieldTypeParam}.to_owned(),\n`;
    body += `${indent.pop().get()}}\n`;
    body += `${indent.get()}.serialize(serializer)\n`;
    body += `${indent.pop().get()}}\n`;

    body += '}\n\n'; // end impl
  }

  let content = helpers.contentPreamble();
  // these types aren't publicly available and their fields need to
  // align with the XML names, so they might not always be camel/snake cased.
  content += '#![allow(non_camel_case_types)]\n#![allow(non_snake_case)]\n\n';
  content += use.text();
  content += body;

  return {
    name: 'xml_helpers',
    content: content,
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// serde builder infrastructure
///////////////////////////////////////////////////////////////////////////////////////////////////

// used by getSerDeHelper and emitSerDeHelpers
const serdeHelpers = new Map<string, (indent: helpers.indentation, use: Use) => string>();
const serdeHelpersForXmlAddlProps = new Map<rust.Model, rust.ModelAdditionalProperties>();

/**
 * defines serde helpers for encodedBytes and offsetDateTime types.
 * any other type will cause this function to throw.
 * 
 * @param field the model field for which to build serde helpers
 * @param serdeParams the params that will be passed to the serde annotation
 * @param format the (de)serialization format of the data
 * @param use the use statement builder currently in scope
 */
function addSerDeHelper(field: rust.ModelField, serdeParams: Set<string>, format: helpers.ModelFormat, use: Use): void {
  const unwrapped = helpers.unwrapType(field.type);
  switch (unwrapped.kind) {
    case 'encodedBytes':
    case 'literal':
    case 'offsetDateTime':
    case 'safeint':
    case 'scalar':
      break;
    default:
      throw new CodegenError('InternalError', `getSerDeHelper unexpected kind ${unwrapped.kind}`);
  }

  if (unwrapped.kind === 'safeint' || unwrapped.kind === 'scalar') {
    if (unwrapped.stringEncoding) {
      serdeParams.add(`with = "azure_core::fmt::as_string"`);
    }
    // no other processing for these types is required
    return;
  }

  /**
   * for hash maps and vectors, we emit a module containing the necessary
   * helper functions to be used in a serde "with = <module>" statement.
   * the module names are a concatenation of the type names.
   * e.g. vec_offset_date_time, hashmap_vec_encoded_bytes_std etc
   */
  const buildSerDeModName = function (type: rust.Type): string {
    let name = codegen.deconstruct(type.kind).join('_');
    let unwrapped = type;
    while (unwrapped.kind === 'hashmap' || unwrapped.kind === 'option' || unwrapped.kind === 'Vec') {
      unwrapped = unwrapped.type;
      name += '_' + codegen.deconstruct(unwrapped.kind).join('_');
    }

    switch (unwrapped.kind) {
      case 'encodedBytes':
      case 'offsetDateTime':
        name += `_${codegen.deconstruct(unwrapped.encoding).join('_')}`;
        break;
      default:
        throw new CodegenError('InternalError', `unexpected kind ${unwrapped.kind}`);
    }

    // we can reuse identical helpers across model types
    if (!serdeHelpers.has(name)) {
      serdeHelpers.set(name, (indent: helpers.indentation): string => {
        const modUse = new Use('modelsOther');
        let modContent = `pub mod ${name} {\n`;
        modContent += `${indent.get()}#![allow(clippy::type_complexity)]\n`;
        const deserialize = buildDeserialize(indent, field.type, modUse);
        const serialize = buildSerialize(indent, field.type, modUse);
        modContent += modUse.text(indent);
        modContent += `${deserialize}\n${serialize}`;
        modContent += '}\n\n'; // end pub mod
        return modContent;
      });
    }
    return name;
  };

  /** non-collection based impl */
  const serdeEncodedBytes = function (encoding: rust.BytesEncoding, forOption: boolean): void {
    const format = encoding === 'url' ? '_url_safe' : '';
    const deserializer = `deserialize${format}`;
    const serializer = `serialize${format}`;
    serdeParams.add('default');
    serdeParams.add(`deserialize_with = "${deserializer}"`);
    serdeParams.add(`serialize_with = "${serializer}"`);
    const optionNamespace = forOption ? '::option' : '';
    use.add('azure_core', `base64${optionNamespace}::${deserializer}`, `base64${optionNamespace}::${serializer}`);
  };

  /** non-collection based impl. note that for XML, we don't use the in-box RFC3339 */
  const serdeOffsetDateTime = function (encoding: rust.DateTimeEncoding, optional: boolean): void {
    serdeParams.add('default');
    serdeParams.add(`with = "azure_core::time::${encoding}${optional ? '::option' : ''}"`);
  };

  /** serializing literal values */
  const serdeLiteral = function (literal: rust.Literal): void {
    let literalValueName = literal.value.toString();
    if (literal.valueKind.kind === 'scalar') {
      // if the scalar is a float, replace the . as it's illegal in an identifier
      literalValueName = literalValueName.replace('.', 'point');
    } else if (literal.valueKind.kind === 'String') {
      literalValueName = literalValueName.replace(/\W/g, '_');
    }

    const optional = field.optional ? 'optional_' : '';
    const typeName = literal.valueKind.kind === 'scalar' ? literal.valueKind.type : literal.valueKind.kind.toLowerCase();
    const name = `serialize_${optional}${typeName}_literal_${literalValueName}`;
    serdeParams.add(`serialize_with = "models_serde::${name}"`);

    // we can reuse identical helpers
    if (!serdeHelpers.has(name)) {
      serdeHelpers.set(name, (indent: helpers.indentation, use: Use): string => {
        return buildLiteralSerialize(indent, name, field, use);
      });
      use.add('super', 'models_serde');
    }
  };

  const addSerDeHelper = function(): void {
    use.add('super', 'models_serde');
    serdeParams.add('default');
    serdeParams.add(`with = "models_serde::${buildSerDeModName(field.type)}"`);
  };

  // the first three cases are for spread params where the internal model's field isn't Option<T>
  switch (field.type.kind) {
    case 'encodedBytes':
      return serdeEncodedBytes((<rust.EncodedBytes>unwrapped).encoding, false);
    case 'literal':
      return serdeLiteral(field.type);
    case 'offsetDateTime':
      if (format === 'json' || (<rust.OffsetDateTime>unwrapped).encoding !== 'rfc3339') {
        return serdeOffsetDateTime((<rust.OffsetDateTime>unwrapped).encoding, false);
      }
      return addSerDeHelper();
    default:
      if (field.type.kind === 'option') {
        switch (field.type.type.kind) {
          case 'encodedBytes':
            return serdeEncodedBytes((<rust.EncodedBytes>unwrapped).encoding, true);
          case 'literal':
            return serdeLiteral(field.type.type);
          case 'offsetDateTime':
            if (format === 'json' || ((<rust.OffsetDateTime>unwrapped).encoding !== 'rfc3339' && (<rust.OffsetDateTime>unwrapped).encoding !== 'rfc3339-fixed-width')) {
              return serdeOffsetDateTime((<rust.OffsetDateTime>unwrapped).encoding, true);
            }
            // for XML we intentionally fall through
        }
      }
      // if we get here, it means we have one of the following cases
      //  - HashMap/Vec of encoded thing (spread params)
      //  - Option of HashMap/Vec of encoded thing
      addSerDeHelper();
      break;
  }
}

/**
 * emits serde helper modules or returns undefined
 * if no serde helpers are required.
 * 
 * @param use the use statement builder at the file scope
 * @returns the helper modules or undefined
 */
function emitSerDeHelpers(use: Use): string | undefined {
  if (serdeHelpers.size === 0 && serdeHelpersForXmlAddlProps.size === 0) {
    return undefined;
  }

  let content = '';

  // emit any serde impls for models with additional properties
  if (serdeHelpersForXmlAddlProps.size > 0) {
    use.add('serde', 'Deserialize', 'Serialize');
    use.add('std::collections', 'HashMap');

    const addlPropModels = Array.from(serdeHelpersForXmlAddlProps.keys()).sort();
    for (const addlPropModel of addlPropModels) {
      const addlPropsField = serdeHelpersForXmlAddlProps.get(addlPropModel)!;
      use.addForType(addlPropModel);
      content += buildXmlAddlPropsDeserializeForModel(use, addlPropModel, addlPropsField);
      content += buildXmlAddlPropsSerializeForModel(addlPropModel, addlPropsField);
    }
  }

  const helperKeys = Array.from(serdeHelpers.keys()).sort();
  for (const helperKey of helperKeys) {
    const indent = new helpers.indentation();
    const helperContent = serdeHelpers.get(helperKey)!;
    content += helperContent(indent, use);
  }

  return content;
}

/**
 * constructs the XML Deserialize implementation for a
 * model that contains additional properties
 * @param use the use statement builder at the file scope
 * @param model the model for which to emit Deserialize impl
 * @param addlProps the additional properties field in the model
 * @returns the text for the Deserialize impl
 */
function buildXmlAddlPropsDeserializeForModel(use: Use, model: rust.Model, addlProps: rust.ModelAdditionalProperties): string {
  let body = `impl<'de> Deserialize<'de> for ${model.name} {\n`;
  const indent = new helpers.indentation();
  body += `${indent.get()}fn deserialize<D>(deserializer: D) -> Result<Self, D::Error> where D: serde::Deserializer<'de> {\n`;

  const visitorTypeName = `${codegen.pascalCase(addlProps.name, false)}Visitor`;
  body += `${indent.push().get()}struct ${visitorTypeName};\n`;
  body += `${indent.get()}impl<'de> serde::de::Visitor<'de> for ${visitorTypeName} {\n`;
  body += `${indent.push().get()}type Value = ${model.name};\n`;

  body += `${indent.get()}fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {\n`;
  body += `${indent.push().get()}formatter.write_str("a ${model.name} struct definition")\n`;
  body += `${indent.pop().get()}}\n`; // end fn expecting

  body += `${indent.get()}fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error> where A: serde::de::MapAccess<'de> {\n`;
  indent.push();
  for (const field of model.fields) {
    const defaultValue = field === addlProps ? 'HashMap::new()' : 'None';
    body += `${indent.get()}let mut ${field.name} = ${defaultValue};\n`;
  }
  body += `${indent.get()}${helpers.buildWhile(indent, 'let Some(key) = map.next_key::<String>()?', (indent): string => {
    const optionHashMapValueType = addlProps.type.type.type;
    use.addForType(optionHashMapValueType);
    const addlPropsHandler = (indent: helpers.indentation) => `${indent.get()}let value: ${helpers.getTypeDeclaration(optionHashMapValueType)} = map.next_value()?;\n${indent.get()}${addlProps.name}.insert(key, value);\n`;
    if (model.fields.length === 1) {
      // only has the addlProps field so we can elide the match definition
      return addlPropsHandler(indent);
    } else {
      const arms = new Array<helpers.matchArm>();
      for (const field of model.fields) {
        if (field.kind === 'additionalProperties') {
          // the _ match arm will handle additional property key/values
          continue;
        }
        arms.push({
          pattern: `"${xmlAttr(field)}${field.serde}"`,
          body: (indent): string => `${indent.get()}${field.name} = Some(map.next_value()?)\n`,
        })
      }
      arms.push({
        pattern: '_',
        body: (indent): string => addlPropsHandler(indent),
      })
      return `${indent.get()}${helpers.buildMatch(indent, 'key.as_ref()', arms)}\n`;
    }
  })}`;
  body += `${indent.get()}let ${addlProps.name} = ${helpers.buildMatch(indent, `${addlProps.name}.len()`, [
    {
      pattern: '0',
      body: (indent) => `${indent.get()}None\n`,
    },
    {
      pattern: '_',
      body: (indent) => `${indent.get()}Some(${addlProps.name})\n`,
    }
  ])};\n`;
  body += `${indent.get()}Ok(${model.name} {\n`;
  indent.push();
  for (const field of model.fields) {
    body += `${indent.get()}${field.name},\n`;
  }
  body += `${indent.pop().get()}})\n`;
  body += `${indent.pop().get()}}\n`; // end fn visit_map

  body += `${indent.pop().get()}}\n`; // end impl Visitor
  body += `${indent.get()}deserializer.deserialize_map(${visitorTypeName})\n`;
  body += `${indent.pop().get()}}\n`; // end fn deserialize
  body += '}\n\n'; // end impl Deserialize
  return body;
}

/**
 * constructs the XML Serialize implementation for a
 * model that contains additional properties
 * 
 * @param model the model for which to emit Serialize impl
 * @param addlProps the additional properties field in the model
 * @returns the text for the Serialize impl
 */
function buildXmlAddlPropsSerializeForModel(model: rust.Model, addlProps: rust.ModelAdditionalProperties): string {
  let body = `impl Serialize for ${model.name} {\n`;
  const indent = new helpers.indentation();
  body += `${indent.get()}fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: serde::Serializer {\n`;
  body += `${indent.push().get()}use serde::ser::SerializeMap;\n`;
  // don't count the addlProps field in the count,
  // and if the adjusted count is zero, omit it entirely
  const fieldsLen = model.fields.length > 1 ? `${model.fields.length - 1} + ` : '';
  body += `${indent.get()}let mut map = serializer.serialize_map(Some(${fieldsLen}${helpers.buildMatch(indent, `&self.${addlProps.name}`, [
    {
      pattern: `Some(${addlProps.name})`,
      body: (indent) => `${indent.get()}${addlProps.name}.len()\n`,
    },
    {
      pattern: 'None',
      body: (indent) => `${indent.get()}0\n`,
    }
  ])}))?;\n`;
  for (const field of model.fields) {
    body += `${indent.get()}${helpers.buildIfBlock(indent, {
      condition: `let Some(${field.name}) = &self.${field.name}`,
      body: (indent) => {
        if (field.kind === 'additionalProperties') {
          return `${indent.get()}${helpers.buildForIn(indent, '(k, v)', field.name, (indent) => `${indent.get()}map.serialize_entry(k, v)?;\n`)}`;
        } else {
          return `${indent.get()}map.serialize_entry("${xmlAttr(field)}${field.serde}", ${field.name})?;\n`;
        }
      }
    })}\n`;
  }
  body += `${indent.get()}map.end()\n`;
  body += `${indent.pop().get()}}\n`; // end fn serialize
  body += '}\n\n'; // end impl Serialize
  return body;
}

/**
 * constructs a serde serializer function for a literal value
 * 
 * @param indent the indentation helper currently in scope
 * @param name the name of the serialization function
 * @param field the model field containing a literal to serialize
 * @param use the use statement builder at file scope
 * @returns the pub(crate) serialize function definition
 */
function buildLiteralSerialize(indent: helpers.indentation, name: string, field: rust.ModelField, use: Use): string {
  const literal = shared.unwrapOption(field.type);
  if (literal.kind !== 'literal') {
    throw new CodegenError('InternalError', `unexpected kind ${literal.kind}`);
  }

  use.add('serde', 'Serializer');
  const fieldVar = field.optional ? 'value' : '_ignored';
  let content = '';
  if (name.match(/[A-Z]/)) {
    // disable per instance instead of for the entire file
    content += '#[allow(non_snake_case)]\n';
  }
  content += `pub(crate) fn ${name}<S>(${fieldVar}: &${helpers.getTypeDeclaration(field.type)}, serializer: S) -> std::result::Result<S::Ok, S::Error> where S: Serializer {\n`;

  let serializeMethod: string;
  let serializeValue = literal.value;
  switch (literal.valueKind.kind) {
    case 'String':
      serializeMethod = 'str';
      serializeValue = `"${literal.value}"`;
      break;
    case 'scalar':
      serializeMethod = literal.valueKind.type;
      break;
  }

  const toSerialize = `serializer.serialize_${serializeMethod}(${serializeValue})\n`;
  if (field.optional) {
    content += `${indent.get()}${helpers.buildMatch(indent, `${fieldVar}.is_some()`, [{
      pattern: 'true',
      body: (indent) => `${indent.get()}${toSerialize}`,
    }, {
      pattern: 'false',
      body: (indent) => `${indent.get()}serializer.serialize_none()\n`,
    }])}\n`;
  } else {
    content += `${indent.get()}${toSerialize}`;
  }

  content += '}\n\n';
  return content;
}

/**
 * constructs a serde deserialize function
 * 
 * @param indent the indentation helper currently in scope
 * @param type the type for which to build the helper
 * @param use the use statement builder currently in scope
 * @returns the pub fn deserialize function definition
 */
function buildDeserialize(indent: helpers.indentation, type: rust.Type, use: Use): string {
  use.add('serde', 'Deserialize', 'Deserializer');
  use.add('std', 'result::Result');
  use.addForType(type);
  let content = `${indent.get()}pub fn deserialize<'de, D>(deserializer: D) -> Result<${helpers.getTypeDeclaration(type)}, D::Error>\n`;
  content += `${indent.get()}where D: Deserializer<'de>\n${indent.get()}{\n`;
  content += `${indent.push().get()}let to_deserialize = <Option<${getSerDeTypeDeclaration(type.kind === 'option' ? type.type : type, 'deserialize')}>>::deserialize(deserializer)?;\n`;
  content += `${indent.get()}${helpers.buildMatch(indent, 'to_deserialize', [
    {
      pattern: 'Some(to_deserialize)',
      body: (indent) => recursiveBuildDeserializeBody(indent, use, {
        caller: 'start',
        type: type,
        srcVar: 'to_deserialize',
        destVar: new VarStack('decoded'),
      }),
    },
    {
      pattern: 'None',
      body: (indent) => `${indent.get()}Ok(${type.kind === 'option' ? 'None' : `<${getSerDeTypeDeclaration(type, 'result')}>::default()`})\n`,
    }
  ])}\n`;
  content += `${indent.pop().get()}}\n`;
  return content;
}

/**
 * constructs a serde serialize function
 * 
 * @param indent the indentation helper currently in scope
 * @param type the type for which to build the helper
 * @param use the use statement builder currently in scope
 * @returns the pub fn serialize function definition
 */
function buildSerialize(indent: helpers.indentation, type: rust.Type, use: Use): string {
  use.add('serde', 'Serialize', 'Serializer');
  use.add('std', 'result::Result');
  use.addForType(type);

  // clippy wants the outer-most Vec<T> to be a [] instead
  const getTypeDeclaration = function (type: rust.Type): string {
    if (type.kind === 'Vec') {
      return `[${helpers.getTypeDeclaration(type.type)}]`;
    }
    return helpers.getTypeDeclaration(type);
  };

  let content = `${indent.get()}pub fn serialize<S>(to_serialize: &${getTypeDeclaration(type)}, serializer: S) -> Result<S::Ok, S::Error>\n`;
  content += `${indent.get()}where S: Serializer\n${indent.get()}{\n`;
  indent.push();
  const unwrappedType = helpers.unwrapType(type);
  if (unwrappedType.kind === 'offsetDateTime' && unwrappedType.encoding === 'rfc3339-fixed-width') {
    // create the seven digit, fixed width format
    use.add('std::num', 'NonZero');
    use.add('time::format_description::well_known', 'iso8601', 'Iso8601');
    content += `${indent.get()}let format = Iso8601::<{iso8601::Config::DEFAULT.set_time_precision(iso8601::TimePrecision::Second {decimal_digits: NonZero::new(7)}).encode()}>;\n`;
  }
  content += recursiveBuildSerializeBody(indent, use, {
    caller: 'start',
    type: type,
    srcVar: 'to_serialize',
    destVar: new VarStack('encoded'),
  });
  content += `${indent.pop().get()}}\n`;
  return content;
}

/** a stack for variable names */
class VarStack {
  private readonly prefix: string;
  private suffix: number;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.suffix = 0;
  }

  /**
   * returns the var name at the top of the stack
   * 
   * @returns the var name
   */
  get(): string {
    return `${this.prefix}${this.suffix}`;
  }

  /**
   * returns the previous var name on the stack.
   * if push() has not been called, an error is thrown.
   * 
   * @returns the previous var name
   */
  prev(): string {
    if (this.suffix === 0) {
      throw new CodegenError('InternalError', 'stack underflow');
    }
    return `${this.prefix}${this.suffix - 1}`;
  }

  /**
   * adds the next var to the top of the stack
   * 
   * @returns this with updated stack state
   */
  push(): VarStack {
    ++this.suffix;
    return this;
  }

  /**
   * removes the var at the top of the stack.
   * if push() has not been called, an error is thrown.
   */
  pop(): void {
    if (this.suffix === 0) {
      throw new CodegenError('InternalError', 'stack underflow');
    }
    --this.suffix;
  }
}

/** stateCtx contains the current context of the state machine */
interface stateCtx {
  /**
   * informs the state machine who called us
   *   start - indicates the state machine is being started
   * hashmap - the caller is in process of processing a HashMap<T, U>
   *  option - the caller is in process of processing a Option<T>
   *     vec - the caller is in process of processing a Vec<T>
   */
  caller: 'start' | 'hashmap' | 'option' | 'vec';

  /** the type currently being processed */
  type: rust.Type;

  /** the var name of the content currently being processed */
  srcVar: string

  /** the stack of destination var names */
  destVar: VarStack;
}

/**
 * recursive state machine to construct the body of the deserialize function.
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param ctx the current context of the state machine
 * @returns the contents of the Some(to_deserialize) match arm
 */
function recursiveBuildDeserializeBody(indent: helpers.indentation, use: Use, ctx: stateCtx): string {
  /**
   * adds the var in val to the collection, or does nothing
   * depending on the value of caller.
   * 
   * when valAsDefault is true, the value in val is returned.
   * else the empty string is returned.
   */
  const insertOrPush = function (val: string, valAsDefault: boolean): string {
    switch (ctx.caller) {
      case 'hashmap':
        return `${indent.get()}${ctx.destVar.prev()}.insert(kv.0, ${val});\n`;
      case 'vec':
        return `${indent.get()}${ctx.destVar.prev()}.push(${val});\n`;
      default:
        return valAsDefault ? val : '';
    }
  };

  let content = '';
  switch (ctx.type.kind) {
    case 'encodedBytes': {
      // terminal case (NEVER the start case)
      const base64Decode = helpers.getBytesEncodingMethod(ctx.type.encoding, 'decode', use);
      content = `${base64Decode}(${ctx.srcVar}).map_err(serde::de::Error::custom)?`;
      content = insertOrPush(content, true);
      break;
    }
    case 'hashmap': {
      const destVar = ctx.destVar.get();
      content = `${indent.get()}let mut ${destVar} = <${getSerDeTypeDeclaration(ctx.type, 'result')}>::new();\n`;
      content += `${indent.get()}for kv in ${ctx.srcVar} {\n`;
      content += recursiveBuildDeserializeBody(indent.push(), use, {
        caller: 'hashmap',
        type: ctx.type.type,
        srcVar: 'kv.1',
        destVar: ctx.destVar.push(),
      });
      ctx.destVar.pop();
      content += `${indent.pop().get()}}\n`; // end for
      content += insertOrPush(destVar, false);
      break;
    }
    case 'offsetDateTime': {
      // terminal case (NEVER the start case)
      // for rfc3339-fixed-width we use the same deserializer as rfc3339
      const encoding = ctx.type.encoding === 'rfc3339-fixed-width' ? 'rfc3339' : ctx.type.encoding;
      const dateParse = helpers.getDateTimeEncodingMethod(encoding, 'parse', use);
      content = `${dateParse}(${ctx.type.encoding !== 'unix_time' ? '&' : ''}${ctx.srcVar}).map_err(serde::de::Error::custom)?`;
      if (ctx.caller === 'option') {
        content = `${indent.get()}let ${ctx.destVar.get()} = ${content};\n`;
      } else {
        content = insertOrPush(content, true);
      }
      break;
    }
    case 'option':
      content += recursiveBuildDeserializeBody(indent, use, {
        caller: 'option',
        type: ctx.type.type,
        srcVar: ctx.srcVar,
        destVar: ctx.destVar,
      });
      break;
    case 'Vec': {
      const destVar = ctx.destVar.get();
      content = `${indent.get()}let mut ${destVar} = <${getSerDeTypeDeclaration(ctx.type, 'result')}>::new();\n`;
      content += `${indent.get()}for v in ${ctx.srcVar} {\n`;
      content += recursiveBuildDeserializeBody(indent.push(), use, {
        caller: 'vec',
        type: ctx.type.type,
        srcVar: 'v',
        destVar: ctx.destVar.push(),
      });
      ctx.destVar.pop();
      content += `${indent.pop().get()}}\n`; // end for
      content += insertOrPush(destVar, false);
      break;
    }
    default:
      throw new CodegenError('InternalError', `unexpected kind ${ctx.type.kind}`);
  }

  if (ctx.caller === 'start') {
    const destVar = ctx.destVar.get();
    content += `${indent.get()}Ok(${ctx.type.kind === 'option' ? `Some(${destVar})` : destVar})\n`;
  }

  return content;
}

/**
 * recursive state machine to construct the body of the serialize function.
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param ctx the current context of the state machine
 * @returns the contents of the serialize function
 */
function recursiveBuildSerializeBody(indent: helpers.indentation, use: Use, ctx: stateCtx): string {
  /** inserts the var in val into the current HashMap<T, U> */
  const hashMapInsert = function (val: string): string {
    return `${indent.get()}${ctx.destVar.prev()}.insert(kv.0, ${val});\n`
  };

  let content = '';
  switch (ctx.type.kind) {
    case 'encodedBytes': {
      // terminal case (NEVER the start case)
      const base64Encode = helpers.getBytesEncodingMethod(ctx.type.encoding, 'encode', use);
      switch (ctx.caller) {
        case 'hashmap':
          content = `${hashMapInsert(`${base64Encode}(${ctx.srcVar})`)}`;
          break;
        default:
          content = base64Encode;
      }
      break;
    }
    case 'hashmap': {
      const destVar = ctx.destVar.get();
      let enumerateMap = `${indent.get()}let mut ${destVar} = <${getSerDeTypeDeclaration(ctx.type, 'serialize')}>::new();\n`;
      enumerateMap += `${indent.get()}for kv in ${ctx.srcVar} {\n`;
      enumerateMap += recursiveBuildSerializeBody(indent.push(), use, {
        caller: 'hashmap',
        type: ctx.type.type,
        srcVar: 'kv.1',
        destVar: ctx.destVar.push(),
      });
      ctx.destVar.pop();
      enumerateMap += `${indent.pop().get()}}\n`; // end for

      switch (ctx.caller) {
        case 'hashmap':
          content = enumerateMap;
          content += `${hashMapInsert(destVar)}`;
          break;
        case 'start':
        case 'option':
          content = enumerateMap;
          break;
        case 'vec':
          content = `|${ctx.srcVar}|{\n`;
          content += enumerateMap;
          content += `${indent.get()}${destVar}}`;
          break;
      }
      break;
    }
    case 'offsetDateTime': {
      // terminal case (NEVER the start case)
      const dateTo = ctx.type.encoding === 'rfc3339-fixed-width' ? 'format(&format).map_err(serde::ser::Error::custom)?' : helpers.getDateTimeEncodingMethod(ctx.type.encoding, 'to', use);
      const asMethodCall = ctx.type.encoding === 'rfc3339-fixed-width' || ctx.type.encoding === 'unix_time';
      content = asMethodCall ? `${ctx.srcVar}.${dateTo}` : dateTo;
      switch (ctx.caller) {
        case 'hashmap':
          content = `${hashMapInsert(`${content}${!asMethodCall ? `(${ctx.srcVar})` : ''}`)}`;
          break;
        case 'option':
          content = asMethodCall ? content : `${content}(${ctx.srcVar})`;
          content = `${indent.get()}let ${ctx.destVar.get()} = ${content};\n`;
          break;
        case 'vec':
          if (ctx.type.encoding === 'unix_time') {
            content = `|v|${content}`;
          }
          break;
      }
      break;
    }
    case 'option': {
      content = indent.get() + helpers.buildIfBlock(indent, {
        condition: `let Some(${ctx.srcVar}) = ${ctx.srcVar}`,
        body: (indent) => {
          let body = recursiveBuildSerializeBody(indent, use, {
            caller: 'option',
            type: (<rust.Option>ctx.type).type,
            srcVar: ctx.srcVar,
            destVar: ctx.destVar,
          });
          body += `${indent.get()}<${getSerDeTypeDeclaration(ctx.type, 'serialize')}>::serialize(&Some(${ctx.destVar.get()}), serializer)\n`;
          return body;
        }
      });
      content += ` else {\n${indent.push().get()}serializer.serialize_none()\n${indent.pop().get()}}\n`;
      break;
    }
    case 'Vec': {
      const convertVec = `.iter().map(${recursiveBuildSerializeBody(indent.push(), use, {
        caller: 'vec',
        type: ctx.type.type,
        srcVar: 'v',
        destVar: ctx.destVar.push(),
      })}).collect()`;
      ctx.destVar.pop();
      indent.pop();

      switch (ctx.caller) {
        case 'hashmap':
          content = `${hashMapInsert(`${ctx.srcVar}${convertVec}`)}`;
          break;
        case 'start':
        case 'option':
          content = `${indent.get()}let ${ctx.destVar.get()} = ${ctx.srcVar}${convertVec};\n`;
          break;
        case 'vec':
          content = `|${ctx.srcVar}|${ctx.srcVar}${convertVec}`;
          break;
      }
      break;
    }
    default:
      throw new CodegenError('InternalError', `unexpected kind ${ctx.type.kind}`);
  }

  if (ctx.caller === 'start' && ctx.type.kind !== 'option') {
    // for the Option<T> case, this was emitted within the "if let Some()" body earlier
    content += `${indent.get()}<${getSerDeTypeDeclaration(ctx.type, 'serialize')}>::serialize(&${ctx.destVar.get()}, serializer)\n`;
  }

  return content;
}

/**
 * a specialization of helpers.getTypeDeclaration for constructing
 * the target type declarations in the serde helpers.
 * the type declarations are slightly different depending on the usage
 * context and the underlying generic type.
 * 
 * @param type is the Rust type for which to emit the declaration
 * @param usage defines the context in which the type is being used.
 *              serialize - type is used in the serialize function
 *            deserialize - type is used in the deserialize function
 *                 result - type is used as the result type in the deserialize function
 * @returns 
 */
function getSerDeTypeDeclaration(type: rust.Type, usage: 'serialize' | 'deserialize' | 'result'): string {
  switch (type.kind) {
    case 'encodedBytes':
      return usage === 'result' ? 'Vec<u8>' : 'String';
    case 'offsetDateTime':
      return usage === 'result' ? 'OffsetDateTime' : type.encoding === 'unix_time' ? 'i64' : 'String';
    case 'hashmap':
      return `${type.name}<${usage === 'serialize' ? '&' : ''}String, ${getSerDeTypeDeclaration(type.type, usage)}>`;
    case 'Vec':
      return `${type.kind}<${getSerDeTypeDeclaration(type.type, usage)}>`;
    case 'option':
      return `Option<${getSerDeTypeDeclaration(type.type, usage)}>`;
    default:
      throw new CodegenError('InternalError', `unexpected kind ${type.kind}`);
  }
}

/**
 * returns true if the provided type should be encoded as a string.
 * 
 * @param type the type for which to check the encoding
 * @returns true if string encoding is required
 */
function encodeAsString(type: rust.Type): boolean {
  if (type.kind !== 'safeint' && type.kind !== 'scalar') {
    return false;
  }
  return type.stringEncoding;
}
