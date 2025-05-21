/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { Context } from './context.js';
import { CodegenError } from './errors.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/** contains different types of models to emit */
export interface Models {
  /** models that are part of public surface area */
  public?: helpers.Module;

  /** serde helpers for public models */
  serde?: helpers.Module;

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
    serde: emitModelsSerde(crate, context),
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

    body += helpers.formatDocComment(model.docs);
    body += helpers.annotationDerive('Default', 'azure_core::http::Model');
    if (<rust.ModelFlags>(model.flags & rust.ModelFlags.Output) === rust.ModelFlags.Output && (model.flags & rust.ModelFlags.Input) === 0) {
      // output-only models get the non_exhaustive annotation
      body += helpers.AnnotationNonExhaustive;
    }
    if (model.xmlName) {
      body += `#[serde(rename = "${model.xmlName}")]\n`;
    }
    if (bodyFormat === 'xml') {
      // json is the default if not specified so no need to handle it
      body += `#[typespec(format = "xml")]\n`;
    }
    body += `${helpers.emitVisibility(model.visibility)}struct ${model.name} {\n`;

    for (const field of model.fields) {
      use.addForType(field.type);
      body += helpers.formatDocComment(field.docs);
      const serdeParams = new Set<string>();
      const fieldRename = getSerDeRename(field);
      if (fieldRename) {
        serdeParams.add(`rename = "${fieldRename}"`);
      }

      // NOTE: usage of serde annotations like this means that base64 encoded bytes and
      // XML wrapped lists are mutually exclusive. it's not a real scenario at present.
      if (helpers.unwrapType(field.type).kind === 'encodedBytes' || helpers.unwrapType(field.type).kind === 'offsetDateTime') {
        getSerDeHelper(field, serdeParams, use);
      } else if (bodyFormat === 'xml' && helpers.unwrapOption(field.type).kind === 'Vec' && field.xmlKind !== 'unwrappedList') {
        // this is a wrapped list so we need a helper type for serde
        const xmlListWrapper = getXMLListWrapper(field);
        serdeParams.add('default');
        serdeParams.add(`deserialize_with = "${xmlListWrapper.name}::unwrap"`);
        serdeParams.add(`serialize_with = "${xmlListWrapper.name}::wrap"`);
        use.add('super::xml_helpers', xmlListWrapper.name);
      }

      // TODO: omit skip_serializing_if if we need to send explicit JSON null
      // https://github.com/Azure/typespec-rust/issues/78
      if (field.type.kind === 'option') {
        if (field.type.type.kind === 'literal') {
          getSerDeHelper(field, serdeParams, use);
        }
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

      if (serdeParams.size > 0) {
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
 * @param crate the crate for which to emit model serde helpers
 * @param context the context for the provided crate
 * @returns the model serde helpers content or undefined
 */
function emitModelsSerde(crate: rust.Crate, context: Context): helpers.Module | undefined {
  const use = new Use('modelsOther');
  let body = '';

  // emit TryFrom as required
  for (const model of crate.models) {
    if (model.kind === 'marker' || model.visibility !== 'pub') {
      // skip internal models as their serde helpers are in the same file
      continue;
    }

    const forReq = context.getTryFromForRequestContent(model, use);

    // helpers aren't required for all types, so only
    // add a use statement for a type if it has a helper
    if (forReq.length > 0) {
      use.addForType(model);
    }

    body += forReq;
  }

  const serdeHelpers = emitSerDeHelpers(use);

  if (body.length === 0 && !serdeHelpers) {
    // no helpers
    return undefined;
  }

  let content = helpers.contentPreamble();

  if (body.length > 0) {
    content += use.text();
    content += body;
  }

  if (serdeHelpers) {
    content += serdeHelpers;
  }

  return {
    name: 'models_serde',
    content: content,
  };
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
const serdeHelpers = new Map<string, rust.ModelField>();

/**
 * defines serde helpers for encodedBytes and offsetDateTime types.
 * any other type will cause this function to throw.
 * 
 * @param field the model field for which to build serde helpers
 * @param serdeParams the params that will be passed to the serde annotation
 * @param use the use statement builder currently in scope
 */
function getSerDeHelper(field: rust.ModelField, serdeParams: Set<string>, use: Use): void {
  const unwrapped = helpers.unwrapType(field.type);
  switch (unwrapped.kind) {
    case 'encodedBytes':
    case 'literal':
    case 'offsetDateTime':
      break;
    default:
      throw new CodegenError('InternalError', `getSerDeHelper unexpected kind ${unwrapped.kind}`);
  }

  /**
   * for hash maps and vectors, we emit a module containing the necessary
   * helper functions to be used in a serde "with = <module>" statement.
   * the module names are a concatenation of the type names.
   * e.g. vec_offset_date_time, hashmap_vec_encoded_bytes_std etc
   */
  const buildSerDeModName = function(type: rust.Type): string {
    let name = codegen.deconstruct(type.kind).join('_');
    let unwrapped = type;
    while (unwrapped.kind === 'hashmap' || unwrapped.kind === 'option' || unwrapped.kind === 'Vec') {
      unwrapped = unwrapped.type;
      name += '_' + codegen.deconstruct(unwrapped.kind).join('_');
    }

    switch (unwrapped.kind) {
      case 'encodedBytes':
      case 'offsetDateTime':
        name += `_${unwrapped.encoding}`;
        break;
      default:
        throw new CodegenError('InternalError', `unexpected kind ${unwrapped.kind}`);
    }

    // we can reuse identical helpers across model types
    if (!serdeHelpers.has(name)) {
      serdeHelpers.set(name, field);
    }
    return name;
  };

  /** non-collection based impl */
  const serdeEncodedBytes = function(encoding: rust.BytesEncoding): void {
    const format = encoding === 'url' ? '_url_safe' : '';
    serdeParams.add('default');
    serdeParams.add(`deserialize_with = "base64::deserialize${format}"`);
    serdeParams.add(`serialize_with = "base64::serialize${format}"`);
    use.add('azure_core', 'base64');
  };

  /** non-collection based impl */
  const serdeOffsetDateTime = function(encoding: rust.DateTimeEncoding, optional: boolean): void {
    serdeParams.add('default');
    serdeParams.add(`with = "azure_core::date::${encoding}${optional ? '::option' : ''}"`);
  };

  /** serializing literal values */
  const serdeLiteral = function(): void {
    const literal = <rust.Literal>helpers.unwrapOption(field.type);
    let literalValueName = literal.value.toString();
    if (literal.valueKind.kind === 'scalar') {
      // if the scalar is a float, replace the . as it's illegal in an identifier
      literalValueName = literalValueName.replace('.', 'point');
    }

    const optional = field.optional ? 'optional_' : '';
    const typeName = literal.valueKind.kind === 'scalar' ? literal.valueKind.type : literal.valueKind.kind.toLowerCase();
    const name = `serialize_${optional}${typeName}_literal_${literalValueName}`;
    serdeParams.add(`serialize_with = "models_serde::${name}"`);

    // we can reuse identical helpers
    if (!serdeHelpers.has(name)) {
      serdeHelpers.set(name, field);
      use.add('super', 'models_serde');
    }
  };

  // the first two cases are for spread params where the internal model's field isn't Option<T>
  switch (field.type.kind) {
    case 'encodedBytes':
      return serdeEncodedBytes((<rust.EncodedBytes>unwrapped).encoding);
    case 'literal':
      return serdeLiteral();
    case 'offsetDateTime':
      return serdeOffsetDateTime((<rust.OffsetDateTime>unwrapped).encoding, false);
    default:
      if (field.type.kind === 'option') {
        switch (field.type.type.kind) {
          case 'encodedBytes':
            return serdeEncodedBytes((<rust.EncodedBytes>unwrapped).encoding);
          case 'literal':
            return serdeLiteral();
          case 'offsetDateTime':
            return serdeOffsetDateTime((<rust.OffsetDateTime>unwrapped).encoding, true);
        }
      }
      // if we get here, it means we have one of the following cases
      //  - HashMap/Vec of encoded thing (spread params)
      //  - Option of HashMap/Vec of encoded thing
      use.add('super', 'models_serde');
      serdeParams.add('default');
      serdeParams.add(`with = "models_serde::${buildSerDeModName(field.type)}"`);
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
  if (serdeHelpers.size === 0) {
    return undefined;
  }

  let content = '';

  const helperKeys = Array.from(serdeHelpers.keys()).sort();
  for (const helperKey of helperKeys) {
    const indent = new helpers.indentation();
    const field = serdeHelpers.get(helperKey)!;

    if (helpers.unwrapOption(field.type).kind === 'literal') {
      content += buildLiteralSerialize(indent, helperKey, field, use);
      continue;
    }

    const modUse = new Use('modelsOther');

    let modContent = `pub mod ${helperKey} {\n`;
    modContent += `${indent.get()}#![allow(clippy::type_complexity)]\n`;
    const deserialize = buildDeserialize(indent, field.type, modUse);
    const serialize = buildSerialize(indent, field.type, modUse);
    modContent += modUse.text(indent);
    modContent += `${deserialize}\n${serialize}`;
    modContent += '}\n\n'; // end pub mod

    content += modContent;
  }

  return content;
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
  const literal = helpers.unwrapOption(field.type);
  if (literal.kind !== 'literal') {
    throw new CodegenError('InternalError', `unexpected kind ${literal.kind}`); 
  }

  use.add('serde', 'Serializer');
  const fieldVar = field.optional ? 'value' : '_ignored';
  let content = `pub(crate) fn ${name}<S>(${fieldVar}: &${helpers.getTypeDeclaration(field.type)}, serializer: S) -> std::result::Result<S::Ok, S::Error> where S: Serializer {\n`;

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
    }])}`
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
  const getTypeDeclaration = function(type: rust.Type): string {
    if (type.kind === 'Vec') {
      return `[${helpers.getTypeDeclaration(type.type)}]`;
    }
    return helpers.getTypeDeclaration(type);
  };

  let content = `${indent.get()}pub fn serialize<S>(to_serialize: &${getTypeDeclaration(type)}, serializer: S) -> Result<S::Ok, S::Error>\n`;
  content += `${indent.get()}where S: Serializer\n${indent.get()}{\n`;
  content += recursiveBuildSerializeBody(indent.push(), use, {
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
  const insertOrPush = function(val: string, valAsDefault: boolean): string {
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
      use.add('azure_core', 'base64');
      const base64Decode = `base64::${ctx.type.encoding === 'std' ? 'decode' : 'decode_url_safe'}`;
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
      if (ctx.type.encoding !== 'unix_time') {
        use.add('azure_core', 'date');
      }
      const dateParse = ctx.type.encoding === 'unix_time' ? 'OffsetDateTime::from_unix_timestamp' : `date::parse_${ctx.type.encoding}`;
      content = `${dateParse}(${ctx.type.encoding !== 'unix_time' ? '&' : ''}${ctx.srcVar}).map_err(serde::de::Error::custom)?`;
      content = insertOrPush(content, true);
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
  const hashMapInsert = function(val: string): string {
    return `${indent.get()}${ctx.destVar.prev()}.insert(kv.0, ${val});\n`
  };

  let content = '';
  switch (ctx.type.kind) {
    case 'encodedBytes': {
      // terminal case (NEVER the start case)
      use.add('azure_core', 'base64');
      const base64Encode = `base64::${ctx.type.encoding === 'std' ? 'encode' : 'encode_url_safe'}`;
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
      if (ctx.type.encoding !== 'unix_time') {
        use.add('azure_core', 'date');
      }
      content = ctx.type.encoding === 'unix_time' ? `${ctx.srcVar}.unix_timestamp()` : `date::to_${ctx.type.encoding}`;
      switch (ctx.caller) {
        case 'hashmap':
          content = `${hashMapInsert(`${content}${ctx.type.encoding !== 'unix_time' ? `(${ctx.srcVar})` : ''}`)}`;
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
