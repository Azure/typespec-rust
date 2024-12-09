/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Context } from './context.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/** contains different types of models to emit */
export interface Models {
  /** models that are part of public surface area */
  public?: string;

  /** serde helpers for public models */
  serde?: string;

  /** models that are for internal use only */
  internal?: string;

  /** XML-specific helpers for internal use only */
  xmlHelpers?: string;
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
    public: emitModelsInternal(crate, context, true),
    serde: emitModelsSerde(crate, context),
    internal: emitModelsInternal(crate, context, false),
    xmlHelpers: emitXMLListWrappers(),
  };
}

/**
 * the implementation of emitModels
 * 
 * @param crate the crate for which to emit models
 * @param context the context for the provided crate
 * @param pub true if we want public models, false for internal models
 * @returns the model content or empty
 */
function emitModelsInternal(crate: rust.Crate, context: Context, pub: boolean): string | undefined {
  // for the internal models we might need to use public model types
  const use = new Use(pub ? 'models' : undefined);
  use.addTypes('serde', ['Deserialize', 'Serialize']);

  const indent = new helpers.indentation();

  let body = '';
  for (const model of crate.models) {
    if (model.internal === pub) {
      continue;
    }

    body += helpers.formatDocComment(model.docs);
    body += helpers.annotationDerive('Default', 'azure_core::Model');
    body += helpers.AnnotationNonExhaustive;
    if (model.xmlName) {
      body += `#[serde(rename = "${model.xmlName}")]\n`;
    }
    body += `pub struct ${model.name} {\n`;

    for (const field of model.fields) {
      use.addForType(field.type);
      body += helpers.formatDocComment(field.docs);
      const serdeParams = new Array<string>();
      const fieldRename = getSerDeRename(field);
      if (fieldRename) {
        serdeParams.push(`rename = "${fieldRename}"`);
      }

      // NOTE: usage of serde annotations like this means that base64 encoded bytes and
      // XML wrapped lists are mutually exclusive. it's not a real scenario at present.
      if (helpers.unwrapOption(field.type).kind === 'encodedBytes') {
        // TODO: https://github.com/Azure/typespec-rust/issues/56
        // specifically need to handle nested arrays of base64 encoded bytes
        let format = '';
        if ((<rust.EncodedBytes>helpers.unwrapOption(field.type)).encoding === 'url') {
          format = '_url_safe';
        }
        serdeParams.push(`deserialize_with = "base64::deserialize${format}"`);
        serdeParams.push(`serialize_with = "base64::serialize${format}"`);
        use.addType('azure_core', 'base64');
      } else if (context.getModelBodyFormat(model) === 'xml' && helpers.unwrapOption(field.type).kind === 'vector' && field.xmlKind !== 'unwrappedList') {
        // this is a wrapped list so we need a helper type for serde
        const xmlListWrapper = getXMLListWrapper(field);
        serdeParams.push(`deserialize_with = "${xmlListWrapper.name}::unwrap"`);
        serdeParams.push(`serialize_with = "${xmlListWrapper.name}::wrap"`);
        use.addType('crate', `generated::xml_helpers::${xmlListWrapper.name}`);
      }

      // TODO: omit skip_serializing_if if we need to send explicit JSON null
      // https://github.com/Azure/typespec-rust/issues/78
      if (field.type.kind === 'option') {
        serdeParams.push('skip_serializing_if = "Option::is_none"');
      }

      if (serdeParams.length > 0) {
        body += `${indent.get()}#[serde(${serdeParams.join(', ')})]\n`;
      }
      body += `${indent.get()}${helpers.emitPub(field.pub)}${field.name}: ${helpers.getTypeDeclaration(field.type)},\n\n`;
    }

    body += '}\n\n';
  }

  if (body === '') {
    // no models for this value of pub
    return undefined;
  }

  // emit TryFrom as required for internal models only.
  // public models will have their helpers in a separate file.
  if (!pub) {
    for (const model of crate.models) {
      if (!model.internal) {
        continue;
      }

      body += context.getTryFromForRequestContent(model, use);
      body += context.getTryFromResponseForType(model, use);
    }
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return content;
}

/**
 * returns serde helpers for public models.
 * if no helpers are required, undefined is returned.
 * 
 * @param crate the crate for which to emit model serde helpers
 * @param context the context for the provided crate
 * @returns the model serde helpers content or undefined
 */
function emitModelsSerde(crate: rust.Crate, context: Context): string | undefined {
  const use = new Use();
  let body = '';

  // emit TryFrom as required
  for (const model of crate.models) {
    if (model.internal) {
      // skip internal models as their serde helpers are in the same file
      continue;
    }

    const forReq = context.getTryFromForRequestContent(model, use);
    const forRes = context.getTryFromResponseForType(model, use);

    // helpers aren't required for all types, so only
    // add a use statement for a type if it has a helper
    if (forReq.length > 0 || forRes.length > 0) {
      use.addForType(model);
    }

    body += forReq;
    body += forRes;
  }

  if (body.length === 0) {
    // no helpers
    return undefined;
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return content;
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
  let fieldName = field.name === field.serde ? field.name : field.serde;
  if (field.xmlKind === 'attribute') {
    fieldName = '@' + fieldName;
  }
  return fieldName;
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
function emitXMLListWrappers(): string | undefined {
  if (xmlListWrappers.size === 0) {
    return undefined;
  }

  const wrapperTypes = Array.from(xmlListWrappers.values());
  wrapperTypes.sort((a, b) => { return helpers.sortAscending(a.name, b.name); });

  const indent = new helpers.indentation();
  const use = new Use();

  use.addTypes('serde', ['Deserialize', 'Deserializer', 'Serialize', 'Serializer']);

  let body = '';
  for (const wrapperType of wrapperTypes) {
    body += '#[derive(Deserialize, Serialize)]\n';
    if (wrapperType.serde) {
      body += `#[serde(rename = "${wrapperType.serde}")]\n`;
    }

    use.addForType(wrapperType.fieldType);
    const fieldType = helpers.getTypeDeclaration(wrapperType.fieldType);

    body += `pub struct ${wrapperType.name} {\n`;
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

  return content;
}
