/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore responseheader subclients lropaging

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import { DateTimeKnownEncoding, DiagnosticTarget, EmitContext, NoTarget } from '@typespec/compiler';
import * as http from '@typespec/http';
import * as helpers from './helpers.js';
import * as naming from './naming.js';
import { RustEmitterOptions } from '../lib.js';
import * as shared from '../shared/shared.js';
import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as rust from '../codemodel/index.js';

/** ErrorCode defines the types of adapter errors */
export type ErrorCode =
  /** the emitter encountered an internal error. this is always a bug in the emitter */
  'InternalError' |

  /** invalid arguments were passed to the emitter */
  'InvalidArgument' |

  /**
   * renaming items resulted in one or more name collisions.
   * this will likely require an update to client.tsp to resolve.
   */
  'NameCollision' |

  /** the emitter does not support the encountered TypeSpec construct */
  'UnsupportedTsp';

/**
 * AdapterError is thrown when the emitter fails to convert part of the tcgc code
 * model to the emitter code model. this could be due to the emitter not supporting
 * some tsp construct.
 */
export class AdapterError extends Error {
  readonly code: ErrorCode;
  readonly target: DiagnosticTarget | typeof NoTarget;

  constructor(code: ErrorCode, message: string, target?: DiagnosticTarget) {
    super(message);
    this.code = code;
    this.target = target ?? NoTarget;
  }
}

/** Adapter converts the tcgc code model to a Rust Crate */
export class Adapter {
  /**
   * Creates an Adapter for the specified EmitContext.
   * 
   * @param context the compiler context from which to create the Adapter
   * @returns 
   */
  static async create(context: EmitContext<RustEmitterOptions>): Promise<Adapter> {
    // @encodedName can be used in XML scenarios, it is effectively the
    // same as TypeSpec.Xml.@name. however, it's filtered out by default
    // so we need to add it to the allow list of decorators
    const ctx = await tcgc.createSdkContext(context, '@azure-tools/typespec-rust', {
      additionalDecorators: ['TypeSpec\\.@encodedName', '@clientName'],
      disableUsageAccessPropagationToBase: true,
    });
    context.program.reportDiagnostics(ctx.diagnostics);
    return new Adapter(ctx, context.options);
  }

  private readonly crate: rust.Crate;
  private readonly ctx: tcgc.SdkContext;
  private readonly options: RustEmitterOptions;

  // cache of adapted types
  private readonly types: Map<string, rust.Type>;

  // cache of adapted client method params
  private readonly clientMethodParams: Map<string, rust.MethodParameter>;

  // contains methods that have been renamed
  private readonly renamedMethods: Set<string>;

  // maps a tcgc model field to the adapted struct field
  private readonly fieldsMap: Map<tcgc.SdkModelPropertyType | tcgc.SdkPathParameter, rust.ModelField>;

  private constructor(ctx: tcgc.SdkContext, options: RustEmitterOptions) {
    this.types = new Map<string, rust.Type>();
    this.clientMethodParams = new Map<string, rust.MethodParameter>();
    this.renamedMethods = new Set<string>();
    this.fieldsMap = new Map<tcgc.SdkModelPropertyType | tcgc.SdkPathParameter, rust.ModelField>();
    this.ctx = ctx;
    this.options = options;

    let serviceType: rust.ServiceType = 'data-plane';
    if (this.ctx.arm === true) {
      serviceType = 'azure-arm';
    }

    this.crate = new rust.Crate(this.options['crate-name'], this.options['crate-version'], serviceType);
  }

  /** performs all the steps to convert tcgc to a crate */
  tcgcToCrate(): rust.Crate {
    this.adaptTypes();
    this.adaptClients();

    // marker models don't require serde so exclude them from the check
    if (this.crate.enums.length > 0 || values(this.crate.models).where(e => e.kind === 'model').any()) {
      this.crate.addDependency(new rust.CrateDependency('serde'));
    }

    if (this.crate.clients.length > 0 || this.crate.enums.length > 0 || this.crate.models.length > 0) {
      this.crate.addDependency(new rust.CrateDependency('typespec_client_core', ['derive']));
    }

    // TODO: remove once https://github.com/Azure/typespec-rust/issues/22 is fixed
    for (const client of this.crate.clients) {
      let done = false;
      for (const method of client.methods) {
        if (method.kind === 'pageable') {
          if (method.returns.type.kind === 'pager') {
            this.crate.addDependency(new rust.CrateDependency('async-trait')); // required for azure_core::http::Page trait
          }
          // TODO: why is this here?
          this.crate.addDependency(new rust.CrateDependency('futures'));
          done = true;
          break;
        }
      }
      if (done) {
        break;
      }
    }
    // end TODO

    this.crate.sortContent();
    return this.crate;
  }

  /** converts tcgc docs to formatted rust.Docs */
  private adaptDocs(summary?: string, doc?: string): rust.Docs {
    if (summary) {
      summary = helpers.formatDocs(summary);
    }
    if (doc) {
      doc = helpers.formatDocs(doc);
    }
    return {
      summary: summary,
      description: doc,
    }
  }

  /** converts all tcgc types to their Rust type equivalent */
  private adaptTypes(): void {
    for (const sdkEnum of this.ctx.sdkPackage.enums) {
      if (<tcgc.UsageFlags>(sdkEnum.usage & tcgc.UsageFlags.ApiVersionEnum) === tcgc.UsageFlags.ApiVersionEnum) {
        // we skip generating the enums for API
        // versions as we expose it as a String
        continue;
      }
      const rustEnum = this.getEnum(sdkEnum);
      this.crate.enums.push(rustEnum);
    }

    for (const model of this.ctx.sdkPackage.models) {
      if ((model.usage & tcgc.UsageFlags.Input) === 0 && (model.usage & tcgc.UsageFlags.Output) === 0 && (model.usage & tcgc.UsageFlags.Spread) === 0) {
        // skip types without input and output usage. this will include core
        // types unless they're explicitly referenced (e.g. a model property).
        // we keep the models for spread params as we internally use them.
        continue;
      }
      const rustModel = this.getModel(model);
      this.crate.models.push(rustModel);
      // presence of models requires the derive feature
      this.crate.addDependency(new rust.CrateDependency('typespec_client_core', ['derive']));
    }
  }

  /**
   * converts a tcgc enum to a Rust enum
   * 
   * @param sdkEnum the tcgc enum to convert
   * @returns a Rust enum
   */
  private getEnum(sdkEnum: tcgc.SdkEnumType): rust.Enum {
    const enumName = codegen.capitalize(sdkEnum.name);
    let rustEnum = this.types.get(enumName);
    if (rustEnum) {
      return <rust.Enum>rustEnum;
    }

    rustEnum = new rust.Enum(enumName, sdkEnum.access === 'public', !sdkEnum.isFixed);
    rustEnum.docs = this.adaptDocs(sdkEnum.summary, sdkEnum.doc);
    this.types.set(enumName, rustEnum);

    for (const value of sdkEnum.values) {
      const rustEnumValue = new rust.EnumValue(helpers.fixUpEnumValueName(value), rustEnum, value.value);
      rustEnumValue.docs = this.adaptDocs(value.summary, value.doc);
      rustEnum.values.push(rustEnumValue);
    }

    return rustEnum;
  }

  /**
   * converts a tcgc enumvalue to a Rust enum value.
   * this is typically used when a literal enum value is specified.
   * 
   * @param sdkEnumValue the tcgc enumvalue to convert
   * @returns a Rust enum value
   */
  private getEnumValue(sdkEnumValue: tcgc.SdkEnumValueType): rust.EnumValue {
    const enumType = this.getEnum(sdkEnumValue.enumType);
    // find the specified enum value
    for (const value of enumType.values) {
      if (value.name === helpers.fixUpEnumValueName(sdkEnumValue)) {
        return value;
      }
    }
    throw new AdapterError('InternalError', `didn't find enum value for name ${sdkEnumValue.name} in enum ${enumType.name}`, sdkEnumValue.__raw?.node);
  }

  /**
   * converts a tcgc model to a Rust model
   * 
   * @param model the tcgc model to convert
   * @param stack is a stack of model type names used to detect recursive type definitions
   * @returns a Rust model
   */
  private getModel(model: tcgc.SdkModelType, stack?: Array<string>): rust.Model {
    if (model.name.length === 0) {
      throw new AdapterError('InternalError', 'unnamed model', model.__raw?.node); // TODO: this might no longer be an issue
    }
    const modelName = codegen.capitalize(model.name);
    let rustModel = this.types.get(modelName);
    if (rustModel) {
      return <rust.Model>rustModel;
    }

    // no stack means this is the first model in
    // the chain of potentially recursive calls
    if (!stack) {
      stack = new Array<string>();
    }
    stack.push(modelName);

    let modelFlags = rust.ModelFlags.Unspecified;
    if (<tcgc.UsageFlags>(model.usage & tcgc.UsageFlags.Input) === tcgc.UsageFlags.Input) {
      modelFlags |= rust.ModelFlags.Input;
    }
    if (<tcgc.UsageFlags>(model.usage & tcgc.UsageFlags.Output) === tcgc.UsageFlags.Output) {
      modelFlags |= rust.ModelFlags.Output;
    }

    rustModel = new rust.Model(modelName, model.access === 'internal' ? 'pubCrate' : 'pub', modelFlags);
    rustModel.docs = this.adaptDocs(model.summary, model.doc);
    rustModel.xmlName = getXMLName(model.decorators);
    this.types.set(modelName, rustModel);

    // aggregate the properties from the provided type and its parent types
    const allProps = new Array<tcgc.SdkModelPropertyType>();
    for (const prop of model.properties) {
      allProps.push(prop);
    }

    let parent = model.baseModel;
    while (parent) {
      for (const parentProp of parent.properties) {
        const exists = values(allProps).where(p => { return p.name === parentProp.name; }).first();
        if (exists) {
          // don't add the duplicate. the TS compiler has better enforcement than OpenAPI
          // to ensure that duplicate fields with different types aren't added.
          continue;
        }
        allProps.push(parentProp);
      }

      // TODO: propagate additional properties https://github.com/Azure/typespec-rust/issues/4
      parent = parent.baseModel;
    }

    for (const property of allProps) {
      if (property.kind !== 'property') {
        if (property.type.kind === 'constant') {
          // typical case is content-type header.
          // we don't need to emit this as a field so skip it.
          continue;
        } else if (property.kind === 'path') {
          // a property of kind path is the model key and
          // will be exposed as a discrete method parameter.
          // we just adapt it here as a regular model field.
        } else {
          throw new AdapterError('UnsupportedTsp', `model property kind ${property.__raw?.kind} NYI`, property.__raw?.node);
        }
      }
      const structField = this.getModelField(property, rustModel.visibility, stack);
      rustModel.fields.push(structField);
    }

    stack.pop();

    return rustModel;
  }

  private getSerializedPropertyName(property: tcgc.SdkModelPropertyType | tcgc.SdkPathParameter): string | undefined {
    return property.kind === 'property' ? property.serializationOptions.json?.name ?? property.serializationOptions.xml?.name ?? property.serializationOptions.multipart?.name : undefined;
  }

  /**
   * converts a tcgc model property to a model field
   * 
   * @param property the tcgc model property to convert
   * @param modelVisibility the visibility of the model that contains the property
   * @param stack is a stack of model type names used to detect recursive type definitions
   * @returns a Rust model field
   */
  private getModelField(property: tcgc.SdkModelPropertyType | tcgc.SdkPathParameter, modelVisibility: rust.Visibility, stack: Array<string>): rust.ModelField {
    let fieldType = this.getType(property.type, stack);

    // if the field's type is a model and it's in the type stack then
    // box it. this is to avoid infinitely recursive type definitions.
    if (fieldType.kind === 'model' && stack.includes(fieldType.name)) {
      fieldType = this.getBoxType(fieldType);
    }

    // for public models each field is always an Option<T>.
    if (modelVisibility === 'pub' || property.optional) {
      fieldType = this.getOptionType(fieldType.kind === 'box' ? fieldType : this.typeToWireType(fieldType));
    }

    const serializedName = this.getSerializedPropertyName(property) ?? property.name;

    const modelField = new rust.ModelField(naming.getEscapedReservedName(snakeCaseName(property.name), 'prop'), serializedName, modelVisibility, fieldType, property.optional);
    modelField.docs = this.adaptDocs(property.summary, property.doc);

    // if this is a literal, add a doc comment explaining its behavior
    const unwrappedType = shared.unwrapOption(fieldType);
    if (unwrappedType.kind === 'literal') {
      const literalDoc = `${modelField.optional ? 'When Some, field' : 'Field'} has constant value ${unwrappedType.value}. Any specified value will be ignored.`;
      if (!modelField.docs.description) {
        modelField.docs.description = '';
      } else {
        modelField.docs.description += '\n\n';
      }
      modelField.docs.description += literalDoc;
    }

    const xmlName = getXMLName(property.decorators);
    if (xmlName) {
      // use the XML name when specified
      modelField.serde = xmlName;
    }
    modelField.xmlKind = getXMLKind(property.decorators, modelField);

    // it's possible for different models to reference the same property definition
    if (!this.fieldsMap.get(property)) {
      this.fieldsMap.set(property, modelField);
    }

    return modelField;
  }

  /**
   * converts a tcgc type to a Rust type
   * 
   * @param type the tcgc type to convert
   * @param stack is a stack of model type names used to detect recursive type definitions
   * @returns the adapted Rust type
   */
  private getType(type: tcgc.SdkType, stack?: Array<string>): rust.Type {
    const getDateTimeEncoding = (encoding: DateTimeKnownEncoding): rust.DateTimeEncoding => {
      switch (encoding) {
        case 'rfc3339':
        case 'rfc7231':
          return encoding;
        case 'unixTimestamp':
          return 'unix_time';
      }
    };

    switch (type.kind) {
      case 'array':
        return this.getVec(this.typeToWireType(this.getType(type.valueType, stack)));
      case 'bytes': {
        let encoding: rust.BytesEncoding = 'std';
        if (type.encode === 'base64url') {
          encoding = 'url';
        }
        return this.getEncodedBytes(encoding, false);
      }
      case 'constant':
        return this.getLiteral(type);
      case 'decimal':
      case 'decimal128': {
        const keyName = 'decimal' + (type.encode ? `-${type.encode}` : '');
        let decimalType = this.types.get(keyName);
        if (!decimalType) {
          decimalType = new rust.Decimal(this.crate, type.encode === 'string');
          this.types.set(keyName, decimalType);
        }
        return decimalType;
      }
      case 'dict':
        return this.getHashMap(this.typeToWireType(this.getType(type.valueType, stack)));
      case 'duration':
        switch (type.wireType.kind) {
          case 'float':
          case 'float32':
          case 'float64':
          case 'int32':
          case 'int64':
            return this.getScalar(type.wireType.kind, type.wireType.encode);
          case 'string':
            return this.getStringType();
          default:
            throw new AdapterError('UnsupportedTsp', `unhandled duration wireType.kind ${type.wireType.kind}`, type.__raw?.node);
        }
      case 'boolean':
      case 'float32':
      case 'float64':
      case 'int16':
      case 'int32':
      case 'int64':
      case 'int8':
      case 'uint16':
      case 'uint32':
      case 'uint64':
      case 'uint8':
        return this.getScalar(type.kind, type.encode);
      case 'enum':
        return this.getEnum(type);
      case 'enumvalue':
        return this.getEnumValue(type);
      case 'model':
        return this.getModel(type, stack);
      case 'endpoint':
      case 'plainDate':
      case 'plainTime':
      case 'string':
      case 'url': {
        if (type.kind === 'string' && type.crossLanguageDefinitionId === 'Azure.Core.eTag') {
          const etagKey = 'Etag';
          let etagType = this.types.get(etagKey);
          if (etagType) {
            return etagType;
          }
          etagType = new rust.Etag(this.crate);
          this.types.set(etagKey, etagType);
          return etagType;
        }
        return this.getStringType();
      }
      case 'nullable':
        // TODO: workaround until https://github.com/Azure/typespec-rust/issues/42 is fixed
        return this.getType(type.type, stack);
      case 'offsetDateTime': {
        const encoding = getDateTimeEncoding(type.encode);
        const keyName = `offsetDateTime-${encoding}`;
        let timeType = this.types.get(keyName);
        if (timeType) {
          return timeType;
        }
        timeType = new rust.OffsetDateTime(this.crate, encoding, false);
        this.types.set(keyName, timeType);
        return timeType;
      }
      case 'safeint': {
        const keyName = type.kind + (type.encode ? `-${type.encode}` : '');
        let safeint = this.types.get(keyName);
        if (!safeint) {
          safeint = new rust.SafeInt(this.crate, type.encode === 'string');
          this.types.set(keyName, safeint);
        }
        return safeint;
      }
      case 'unknown': {
        const keyName = 'jsonValue';
        let anyType = this.types.get(keyName);
        if (anyType) {
          return anyType;
        }
        anyType = new rust.JsonValue(this.crate);
        this.types.set(keyName, anyType);
        return anyType;
      }
      case 'utcDateTime': {
        const encoding = getDateTimeEncoding(type.encode);
        const keyName = `offsetDateTime-${encoding}-utc`;
        let timeType = this.types.get(keyName);
        if (timeType) {
          return timeType;
        }
        timeType = new rust.OffsetDateTime(this.crate, encoding, true);
        this.types.set(keyName, timeType);
        return timeType;
      }
      default:
        throw new AdapterError('UnsupportedTsp', `unhandled tcgc type ${type.kind}`, type.__raw?.node);
    }
  }

  /** returns a Box type */
  private getBoxType(type: rust.WireType): rust.Box {
    const typeKey = recursiveKeyName('box', type);
    let boxType = this.types.get(typeKey);
    if (!boxType) {
      boxType = new rust.Box(type);
      this.types.set(typeKey, boxType);
    }
    return <rust.Box>boxType;
  }

  /** returns an EncodedBytes type with the specified encoding */
  private getEncodedBytes(encoding: rust.BytesEncoding, asSlice: boolean): rust.EncodedBytes {
    const keyName = `encodedBytes-${encoding}${asSlice ? '-slice' : ''}`;
    let encodedBytesType = this.types.get(keyName);
    if (encodedBytesType) {
      return <rust.EncodedBytes>encodedBytesType;
    }
    encodedBytesType = new rust.EncodedBytes(encoding, asSlice);
    this.types.set(keyName, encodedBytesType);
    return encodedBytesType;
  }

  /** returns a HashMap<String, type> */
  private getHashMap(type: rust.WireType): rust.HashMap {
    const keyName = recursiveKeyName('hashmap', type);
    let hashmapType = this.types.get(keyName);
    if (hashmapType) {
      return <rust.HashMap>hashmapType;
    }
    hashmapType = new rust.HashMap(type);
    this.types.set(keyName, hashmapType);
    return hashmapType;
  }

  /** returns an Option<T> where T is specified in type */
  private getOptionType<T extends rust.OptionType = rust.OptionType>(type: T): rust.Option<T> {
    const typeKey = recursiveKeyName('option', type);
    let optionType = this.types.get(typeKey);
    if (!optionType) {
      optionType = new rust.Option(type);
      this.types.set(typeKey, optionType);
    }
    return <rust.Option<T>>optionType;
  }

  /** returns the specified type wrapped in a Ref */
  private getRefType(type: rust.RefType): rust.Ref {
    const typeKey = recursiveKeyName('ref', type);
    let refType = this.types.get(typeKey);
    if (!refType) {
      refType = new rust.Ref(type);
      this.types.set(typeKey, refType);
    }
    return <rust.Ref>refType;
  }

  /** returns a scalar for the specified scalar type */
  private getScalar(type: tcgcScalarKind, encode?: string): rust.Scalar {
    let scalarType: rust.ScalarType;
    switch (type) {
      case 'boolean':
        scalarType = 'bool';
        break;
      case 'float':
      case 'float32':
        scalarType = 'f32';
        break;
      case 'float64':
        scalarType = 'f64';
        break;
      case 'int16':
        scalarType = 'i16';
        break;
      case 'int32':
        scalarType = 'i32';
        break;
      case 'int64':
        scalarType = 'i64';
        break;
      case 'int8':
        scalarType = 'i8';
        break;
      case 'uint16':
        scalarType = 'u16';
        break;
      case 'uint32':
        scalarType = 'u32';
        break;
      case 'uint64':
        scalarType = 'u64';
        break;
      case 'uint8':
        scalarType = 'u8';
        break;
    }

    const keyName = scalarType + (encode ? `-${encode}` : '');
    let scalar = this.types.get(keyName);
    if (!scalar) {
      scalar = new rust.Scalar(scalarType, encode === 'string');
      this.types.set(keyName, scalar);
    }
    return <rust.Scalar>scalar;
  }

  /** returns a slice of the specified type */
  private getSlice(type: rust.WireType): rust.Slice {
    const typeKey = recursiveKeyName('slice', type);
    let slice = this.types.get(typeKey);
    if (!slice) {
      slice = new rust.Slice(type);
      this.types.set(typeKey, slice);
    }
    return <rust.Slice>slice;
  }

  /** returns the Rust string slice type */
  private getStringSlice(): rust.StringSlice {
    const typeKey = 'str';
    let stringSlice = this.types.get(typeKey);
    if (!stringSlice) {
      stringSlice = new rust.StringSlice();
      this.types.set(typeKey, stringSlice);
    }
    return <rust.StringSlice>stringSlice;
  }

  /** returns the Rust String type */
  private getStringType(): rust.StringType {
    const typeKey = 'String';
    let stringType = this.types.get(typeKey);
    if (stringType) {
      return <rust.StringType>stringType;
    }
    stringType = new rust.StringType();
    this.types.set(typeKey, stringType);
    return stringType;
  };

  /** returns the Rust unit type */
  private getUnitType(): rust.Unit {
    const typeKey = 'rust-unit';
    let unitType = this.types.get(typeKey);
    if (unitType) {
      return <rust.Unit>unitType;
    }
    unitType = new rust.Unit();
    this.types.set(typeKey, unitType);
    return unitType;
  }

  /** returns a Vec<type> */
  private getVec(type: rust.WireType): rust.Vector {
    const keyName = recursiveKeyName('Vec', type);
    let vectorType = this.types.get(keyName);
    if (vectorType) {
      return <rust.Vector>vectorType;
    }
    vectorType = new rust.Vector(type);
    this.types.set(keyName, vectorType);
    return vectorType;
  }

  /**
   * converts a tcgc constant to a Rust literal
   * 
   * @param constType the constant to convert
   * @returns a Rust literal
   */
  private getLiteral(constType: tcgc.SdkConstantType): rust.Literal {
    let valueKind: rust.Scalar | rust.StringType;
    let keyKind: string;
    switch (constType.valueType.kind) {
      case 'boolean':
      case 'float32':
      case 'float64':
      case 'int16':
      case 'int32':
      case 'int64':
      case 'int8':
      case 'uint16':
      case 'uint32':
      case 'uint64':
      case 'uint8':
        valueKind = this.getScalar(constType.valueType.kind, constType.valueType.encode);
        keyKind = valueKind.type;
        break;
      case 'string':
        valueKind = this.getStringType();
        keyKind = valueKind.kind;
        break;
      default:
        throw new AdapterError('UnsupportedTsp', `unhandled constant value kind ${constType.valueType.kind}`, constType.__raw?.node);
    }

    const literalKey = `literal-${keyKind}-${constType.value}`;
    let literalType = this.types.get(literalKey);
    if (literalType) {
      return <rust.Literal>literalType;
    }
    literalType = new rust.Literal(valueKind, constType.value);
    this.types.set(literalKey, literalType);
    return literalType;
  }

  /** converts all tcgc clients and their methods into Rust clients/methods */
  private adaptClients(): void {
    for (const client of this.ctx.sdkPackage.clients) {
      // start with instantiable clients and recursively work down
      if (client.clientInitialization.initializedBy & tcgc.InitializedByFlags.Individually) {
        this.recursiveAdaptClient(client);
      }
    }
  }

  /**
   * formats input as a doc link.
   * e.g. [`${id}`](${link})
   * if doc links are disabled, id is returned
   * 
   * @param id the ID of the doc link
   * @param link the target of the doc link
   * @returns the doc link or id
   */
  private asDocLink(id: string, link: string): string {
    if (this.options['temp-omit-doc-links'] === true) {
      return `\`${id}\``;
    }
    return `[\`${id}\`](${link})`;
  }

  /**
   * recursively converts a client and its methods.
   * this simplifies the case for hierarchical clients.
   * 
   * @param client the tcgc client to recursively convert
   * @param parent contains the parent Rust client when converting a child client
   * @returns a Rust client
   */
  private recursiveAdaptClient(client: tcgc.SdkClientType<tcgc.SdkHttpOperation>, parent?: rust.Client): rust.Client {
    let clientName = client.name;
    // NOTE: if the client has the @clientName decorator applied then use that verbatim
    if (parent && !client.decorators.find((decorator) => decorator.name === 'Azure.ClientGenerator.Core.@clientName')) {
      // for hierarchical clients, the child client names are built
      // from the parent client name. this is because tsp allows subclients
      // with the same name. consider the following example.
      //
      // namespace Chat {
      //   interface Completions {
      //     ...
      //   }
      // }
      // interface Completions { ... }
      //
      // we want to generate two clients from this,
      // one name ChatCompletions and the other Completions

      // strip off the Client suffix from the parent client name
      clientName = parent.name.substring(0, parent.name.length - 6) + clientName;
    }

    if (!clientName.match(/Client$/)) {
      clientName += 'Client';
    }

    const rustClient = new rust.Client(clientName);
    rustClient.docs = this.adaptDocs(client.summary, client.doc);
    rustClient.parent = parent;
    rustClient.fields.push(new rust.StructField('pipeline', 'pubCrate', new rust.ExternalType(this.crate, 'Pipeline', 'azure_core::http')));

    // anything other than public means non-instantiable client
    if (client.clientInitialization.initializedBy & tcgc.InitializedByFlags.Individually) {
      const clientOptionsStruct = new rust.Struct(`${rustClient.name}Options`, 'pub');
      const clientOptionsField = new rust.StructField('client_options', 'pub', new rust.ExternalType(this.crate, 'ClientOptions', 'azure_core::http'));
      clientOptionsField.docs.summary = 'Allows customization of the client.';
      clientOptionsField.defaultValue = 'ClientOptions::default()';
      clientOptionsStruct.fields.push(clientOptionsField);
      rustClient.constructable = new rust.ClientConstruction(new rust.ClientOptions(clientOptionsStruct));
      clientOptionsStruct.docs.summary = `Options used when creating a ${this.asDocLink(rustClient.name, rustClient.name)}`;

      // NOTE: per tcgc convention, if there is no param of kind credential
      // it means that the client doesn't require any kind of authentication.
      // HOWEVER, if there *is* a credential param, then the client *does not*
      // automatically support unauthenticated requests. a credential with
      // the noAuth scheme indicates support for unauthenticated requests.

      // bit flags for auth types
      enum AuthTypes {
        Default = 0, // unspecified
        NoAuth = 1, // explicit NoAuth
        WithAut = 2, // explicit credential
      }

      let authType = AuthTypes.Default;

      /**
       * processes a credential, potentially adding its supporting client constructor
       *
       * @param cred the credential type to process
       * @param constructable the constructable for the current Rust client
       * @param throwOnDefault when true, throws an error on unsupported credential types
       * @returns the AuthTypes enum for the credential that was handled, or AuthTypes.Default if none were
       */
      const processCredential = (rustClient: rust.Client, cred: http.HttpAuth, constructable: rust.ClientConstruction, throwOnDefault: boolean): AuthTypes => {
        switch (cred.type) {
          case 'noAuth':
            return AuthTypes.NoAuth;
          case 'oauth2': {
            constructable.constructors.push(this.createTokenCredentialCtor(rustClient, cred));
            return AuthTypes.WithAut;
          }
          default:
            if (throwOnDefault) {
              throw new AdapterError('UnsupportedTsp', `credential scheme type ${cred.type} NYI`);
            }
            return AuthTypes.Default;
        }
      };

      const ctorParams = new Array<rust.ClientParameter>();
      for (const param of client.clientInitialization.parameters) {
        switch (param.kind) {
          case 'credential':
            switch (param.type.kind) {
              case 'credential':
                authType |= processCredential(rustClient, param.type.scheme, rustClient.constructable, true);
                break;
              case 'union': {
                const variantKinds = new Array<string>();
                for (const variantType of param.type.variantTypes) {
                  variantKinds.push(variantType.scheme.type);
                  // if OAuth2 is specified then emit that and skip any unsupported ones.
                  // this prevents emitting the with_no_credential constructor in cases
                  // where it might not actually be supported.
                  authType |= processCredential(rustClient, variantType.scheme, rustClient.constructable, false);
                }

                // no supported credential types were specified
                if (authType === AuthTypes.Default) {
                  throw new AdapterError('UnsupportedTsp', `credential scheme types ${variantKinds.join()} NYI`, param.__raw?.node);
                }
                continue;
              }
            }
            break;
          case 'endpoint': {
            let endpointType: tcgc.SdkEndpointType;
            switch (param.type.kind) {
              case 'endpoint':
                // single endpoint without any supplemental path
                endpointType = param.type;
                break;
              case 'union':
                // this is a union of endpoints. the first is the endpoint plus
                // the supplemental path. the second is a "raw" endpoint which
                // requires the caller to provide the complete endpoint. we only
                // expose the former at present. languages that support overloads
                // MAY support both but it's not a requirement.
                endpointType = param.type.variantTypes[0];
            }

            for (let i = 0; i < endpointType.templateArguments.length; ++i) {
              const templateArg = endpointType.templateArguments[i];
              if (i === 0) {
                // the first template arg is always the endpoint parameter.
                // note that the types of the param and the field are different.
                // NOTE: we use param.name here instead of templateArg.name as
                // the former has the fixed name "endpoint" which is what we want.
                const adaptedParam = new rust.ClientMethodParameter(param.name, this.getRefType(this.getStringSlice()), false);
                adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
                ctorParams.push(adaptedParam);
                rustClient.fields.push(new rust.StructField(param.name, 'pubCrate', new rust.Url(this.crate)));

                // if the server's URL is *only* the endpoint parameter then we're done.
                // this is the param.type.kind === 'endpoint' case.
                if (endpointType.serverUrl === `{${templateArg.serializedName}}`) {
                  break;
                }

                // there's either a suffix on the endpoint param, more template arguments, or both.
                // either way we need to create supplemental info on the constructable.
                // NOTE: we remove the {endpoint} segment and trailing forward slash as we use
                // Url::join to concatenate the two and not string replacement.
                let serverUrl = endpointType.serverUrl.replace(`{${templateArg.serializedName}}/`, '');

                // NOTE: the behavior of Url::join requires that the path ends with a forward slash.
                // if there are any query params, splice it in as required else just append it.
                if (serverUrl.includes('?')) {
                  if (serverUrl[serverUrl.indexOf('?') - 1] !== '/') {
                    serverUrl = serverUrl.replace('?', '/?');
                  }
                } else if (serverUrl[serverUrl.length - 1] !== '/') {
                  serverUrl += '/';
                }

                rustClient.constructable.endpoint = new rust.SupplementalEndpoint(serverUrl);
                continue;
              }

              const clientParam = this.adaptClientParameter(templateArg, rustClient.constructable);
              if (clientParam.kind !== 'clientEndpoint') {
                throw new AdapterError('InternalError', `unexpected client parameter kind ${clientParam.kind}`, templateArg.__raw?.node);
              }
              rustClient.constructable.endpoint?.parameters.push(clientParam);
              ctorParams.push(clientParam);
            }
            break;
          }
          case 'method': {
            const clientParam = this.adaptClientParameter(param, rustClient.constructable);
            rustClient.fields.push(new rust.StructField(clientParam.name, 'pubCrate', clientParam.type));
            ctorParams.push(clientParam);
            break;
          }
        }
      }

      if (authType === AuthTypes.Default || <AuthTypes>(authType & AuthTypes.NoAuth) === AuthTypes.NoAuth) {
        const ctorWithNoCredential = new rust.Constructor('with_no_credential');
        ctorWithNoCredential.docs.summary = `Creates a new ${rustClient.name} requiring no authentication.`;
        rustClient.constructable.constructors.push(ctorWithNoCredential);
      }

      // propagate ctor params to all client ctors
      for (const constructor of rustClient.constructable.constructors) {
        constructor.params.push(...ctorParams);
        // ensure param order of endpoint, credential, other
        helpers.sortClientParameters(constructor.params);
      }
    } else if (parent) {
      // this is a sub-client. it will share some/all the fields of the parent.
      // NOTE: we must propagate parent params before a potential recursive call
      // to create a child client that will need to inherit our client params.
      for (const prop of client.clientInitialization.parameters) {
        const name = snakeCaseName(prop.name);
        const parentField = parent.fields.find((v) => v.name === name);
        if (parentField) {
          rustClient.fields.push(parentField);
          continue;
        } else if (prop.kind !== 'method') {
          // we don't need to care about non-method properties (e.g. credential)
          // as these are handled in the parent client.
          continue;
        }

        // unique field for this client
        rustClient.fields.push(new rust.StructField(name, 'pubCrate', this.getType(prop.type)));
      }
    } else {
      throw new AdapterError('InternalError', `uninstantiatable client ${client.name} has no parent`);
    }

    for (const child of values(client.children)) {
      const subClient = this.recursiveAdaptClient(child, rustClient);
      this.adaptClientAccessor(client, child, rustClient, subClient);
    }

    for (const method of client.methods) {
      if (method.kind === 'lropaging') {
        // skip Paging LROs for now so that codegen is unblocked
        // TODO: https://github.com/Azure/typespec-rust/issues/188
        this.ctx.program.reportDiagnostic({
          code: 'LroPagingNotSupported',
          severity: 'warning',
          message: `skip emitting Paging LRO ${method.name}`,
          target: method.__raw?.node ?? NoTarget,
        });
        continue;
      }
      this.adaptMethod(method, rustClient);
    }

    this.crate.clients.push(rustClient);
    return rustClient;
  }

  /**
   * creates a client constructor for the TokenCredential type.
   * the constructor is named new.
   * 
   * @param cred the OAuth2 credential to adapt
   * @returns a client constructor for TokenCredential
   */
  private createTokenCredentialCtor(rustClient: rust.Client, cred: http.Oauth2Auth<http.OAuth2Flow[]>): rust.Constructor {
    if (cred.flows.length === 0) {
      throw new AdapterError('InternalError', `no flows defined for credential type ${cred.type}`, cred.model);
    }
    const scopes = new Array<string>();
    for (const scope of cred.flows[0].scopes) {
      scopes.push(scope.value);
    }
    if (scopes.length === 0) {
      throw new AdapterError('InternalError', 'scopes must contain at least one entry', cred.model);
    }
    const ctorTokenCredential = new rust.Constructor('new');
    const tokenCredParam = new rust.ClientMethodParameter('credential', new rust.Arc(new rust.TokenCredential(this.crate, scopes)), false);
    tokenCredParam.docs.summary = `An implementation of [\`TokenCredential\`](azure_core::credentials::TokenCredential) that can provide an Entra ID token to use when authenticating.`;
    ctorTokenCredential.params.push(tokenCredParam);
    ctorTokenCredential.docs.summary = `Creates a new ${rustClient.name}, using Entra ID authentication.`;
    return ctorTokenCredential;
  }

  /**
   * converts a tcgc client parameter to a Rust client parameter
   * 
   * @param param the tcgc client parameter to convert
   * @param constructable contains client construction info. if the param is optional, it will go in the options type
   * @returns the Rust client parameter
   */
  private adaptClientParameter(param: tcgc.SdkMethodParameter | tcgc.SdkPathParameter, constructable: rust.ClientConstruction): rust.ClientParameter {
    let paramType: rust.Type;
    // the second clause is a workaround for https://github.com/Azure/typespec-azure/issues/2745
    if (param.isApiVersionParam || (param.type.kind === 'enum' && <tcgc.UsageFlags>(param.type.usage & tcgc.UsageFlags.ApiVersionEnum) === tcgc.UsageFlags.ApiVersionEnum)) {
      if (param.clientDefaultValue) {
        // this is optional so it goes into the client options type as a String
        paramType = this.getStringType();
      } else {
        // this is a required param so its type is a &str
        paramType = this.getRefType(this.getStringSlice());
      }
    } else {
      paramType = this.getType(param.type);
    }

    const paramName = snakeCaseName(param.name);

    let optional = false;
    // client-side default value makes the param optional
    if (param.optional || param.clientDefaultValue) {
      optional = true;
      const paramField = new rust.StructField(paramName, 'pub', paramType);
      paramField.docs = this.adaptDocs(param.summary, param.doc);
      constructable.options.type.fields.push(paramField);
      if (param.clientDefaultValue) {
        paramField.defaultValue = `String::from("${<string>param.clientDefaultValue}")`;
      }
    }

    let adaptedParam: rust.ClientParameter;
    switch (param.kind) {
      case 'method':
        adaptedParam = new rust.ClientMethodParameter(paramName, paramType, optional);
        break;
      case 'path':
        adaptedParam = new rust.ClientEndpointParameter(paramName, paramType, optional, param.serializedName);
        break;
    }

    adaptedParam.docs = this.adaptDocs(param.summary, param.doc);

    return adaptedParam;
  }

  /**
   * converts a tcgc client accessor method to a Rust method
   * 
   * @param client the tcgc client that contains the accessor method
   * @param method the tcgc client accessor method to convert
   * @param rustClient the client to which the method belongs
   * @param subClient the sub-client type that the method returns
   */
  private adaptClientAccessor(parentClient: tcgc.SdkClientType<tcgc.SdkHttpOperation>, childClient: tcgc.SdkClientType<tcgc.SdkHttpOperation>, rustClient: rust.Client, subClient: rust.Client): void {
    const clientAccessor = new rust.ClientAccessor(`get_${snakeCaseName(subClient.name)}`, rustClient, subClient);
    clientAccessor.docs.summary = `Returns a new instance of ${subClient.name}.`;
    for (const param of childClient.clientInitialization.parameters) {
      // check if the client's initializer already has this parameter.
      // if it does then omit it from the method sig as we'll populate
      // the child client's value from the parent.
      let existsOnParent = false;
      for (const clientParam of parentClient.clientInitialization.parameters) {
        if (clientParam.name === param.name) {
          existsOnParent = true;
          break;
        }
      }
      if (existsOnParent) {
        continue;
      }
      const adaptedParam = new rust.Parameter(snakeCaseName(param.name), this.getType(param.type));
      adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
      clientAccessor.params.push(adaptedParam);
    }
    rustClient.methods.push(clientAccessor);
  }

  /**
   * converts a tcgc method to a Rust method for the specified client
   * 
   * @param method the tcgc method to convert
   * @param rustClient the client to which the method belongs
   */
  private adaptMethod(method: tcgc.SdkServiceMethod<tcgc.SdkHttpOperation>, rustClient: rust.Client): void {
    let srcMethodName = method.name;
    if (method.kind === 'paging' && !srcMethodName.match(/^list/i)) {
      const chunks = codegen.deconstruct(srcMethodName);
      chunks[0] = 'list';
      srcMethodName = codegen.camelCase(chunks);
      this.renamedMethods.add(srcMethodName);
      this.ctx.program.reportDiagnostic({
        code: 'PagingMethodRename',
        severity: 'warning',
        message: `renamed paging method from ${method.name} to ${srcMethodName}`,
        target: method.__raw?.node ?? NoTarget,
      });
    } else if (this.renamedMethods.has(srcMethodName)) {
      throw new AdapterError('NameCollision', `method name ${srcMethodName} collides with a renamed method`, method.__raw?.node);
    }

    const languageIndependentName = method.crossLanguageDefinitionId;
    const methodName = naming.getEscapedReservedName(snakeCaseName(srcMethodName), 'fn');
    const optionsLifetime = new rust.Lifetime('a');
    const methodOptionsStruct = new rust.Struct(`${rustClient.name}${codegen.pascalCase(srcMethodName)}Options`, 'pub');
    methodOptionsStruct.lifetime = optionsLifetime;
    methodOptionsStruct.docs.summary = `Options to be passed to ${this.asDocLink(`${rustClient.name}::${methodName}()`, `crate::generated::clients::${rustClient.name}::${methodName}()`)}`;

    const clientMethodOptions = new rust.ExternalType(this.crate, 'ClientMethodOptions', 'azure_core::http');
    clientMethodOptions.lifetime = optionsLifetime;
    const methodOptionsField = new rust.StructField('method_options', 'pub', clientMethodOptions);
    methodOptionsField.docs.summary = 'Allows customization of the method call.';
    methodOptionsStruct.fields.push(methodOptionsField);

    if (method.kind === 'lro') {
      const pollerOptions = new rust.ExternalType(this.crate, 'PollerOptions', 'azure_core::http::poller');
      const pollerOptionsField = new rust.StructField('poller_options', 'pub', pollerOptions);
      pollerOptionsField.docs.summary = 'Allows customization of the [`Poller`](azure_core::http::poller::Poller).';
      methodOptionsStruct.fields.push(pollerOptionsField);
    }

    const pub: rust.Visibility = method.access === 'public' ? 'pub' : 'pubCrate';
    const methodOptions = new rust.MethodOptions(methodOptionsStruct);
    const httpMethod = method.operation.verb;

    // if path is more than just "/" strip off any leading forward slash.
    // this is because Url::join will treat the path as absolute, overwriting
    // any existing path on the endpoint.
    // e.g. if endpoint is https://contoso.com/foo/bar and httpPath is /some/sub/path
    // then calling Url::join will provide result https://contoso.com/some/sub/path
    // which is not what we want.
    // the only exception is if this is the root before the query string
    let httpPath = method.operation.path;
    if (httpPath.length > 1 && httpPath[0] === '/' && !httpPath.startsWith('/?')) {
      httpPath = httpPath.slice(1);
    }

    let rustMethod: MethodType;
    switch (method.kind) {
      case 'basic':
        rustMethod = new rust.AsyncMethod(methodName, languageIndependentName, rustClient, pub, methodOptions, httpMethod, httpPath);
        break;
      case 'paging':
        rustMethod = new rust.PageableMethod(methodName, languageIndependentName, rustClient, pub, methodOptions, httpMethod, httpPath);
        break;
      case 'lro':
        rustMethod = new rust.LroMethod(methodName, languageIndependentName, rustClient, pub, methodOptions, httpMethod, httpPath);
        break;
      default:
        throw new AdapterError('UnsupportedTsp', `method kind ${method.kind} NYI`, method.__raw?.node);
    }

    rustMethod.docs = this.adaptDocs(method.summary, method.doc);
    rustClient.methods.push(rustMethod);

    // stuff all of the operation parameters into one array for easy traversal
    const allOpParams = new Array<tcgc.SdkHttpParameter>();
    allOpParams.push(...method.operation.parameters);
    if (method.operation.bodyParam) {
      allOpParams.push(method.operation.bodyParam);
    }

    // maps tcgc method header/query params to their Rust method params
    const paramsMap = new Map<tcgc.SdkMethodParameter, rust.HeaderScalarParameter | rust.QueryScalarParameter>();

    for (const param of method.parameters) {
      // we need to translate from the method param to its underlying operation param.
      // most params have a one-to-one mapping. however, for spread params, there will
      // be a many-to-one mapping. i.e. multiple params will map to the same underlying
      // operation param. each param corresponds to a field within the operation param.
      const opParam = values(allOpParams).where((opParam: tcgc.SdkHttpParameter) => {
        return values(opParam.correspondingMethodParams).where((methodParam: tcgc.SdkMethodParameter | tcgc.SdkModelPropertyType) => {
          return methodParam.name === param.name;
        }).any();
      }).first();

      if (!opParam) {
        throw new AdapterError('InternalError', `didn't find operation parameter for method ${method.name} parameter ${param.name}`, param.__raw?.node);
      }

      let adaptedParam: rust.MethodParameter;
      // for spread params there are two cases we need to consider.
      // if the method param's type doesn't match the op param's type then it's a spread param
      // - e.g. method param's type is string/int/etc which is a field in the op param's body type
      // if the method param's type DOES match the op param's type and the op param has multiple corresponding method params, it's a spread param
      // - e.g. op param is an intersection of multiple model types, and each model type is exposed as a discrete param
      if (opParam.kind === 'body' && opParam.type.kind === 'model' && (opParam.type.kind !== param.type.kind || opParam.correspondingMethodParams.length > 1)) {
        adaptedParam = this.adaptMethodSpreadParameter(param, this.adaptPayloadFormat(opParam.defaultContentType), opParam.type);
      } else {
        adaptedParam = this.adaptMethodParameter(opParam);
      }

      switch (adaptedParam.kind) {
        case 'headerScalar':
        case 'queryScalar':
          paramsMap.set(param, adaptedParam);
          break;
      }

      adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
      rustMethod.params.push(adaptedParam);

      // we specially handle an optional content-type header to ensure it's omitted
      // from the options bag type. this shows up when the request body is optional.
      // we can't generalize this to optional literal headers though.
      if (adaptedParam.optional && (adaptedParam.kind !== 'headerScalar' || adaptedParam.header.toLowerCase() !== 'content-type')) {
        let fieldType: rust.Type;
        if (adaptedParam.kind === 'partialBody') {
          // for partial body params, adaptedParam.type is the model type that's
          // sent in the request. we want the field within the model for this param.
          // NOTE: if the param is optional then the field is optional, thus it's
          // already wrapped in an Option<T> type.
          const field = adaptedParam.type.content.type.fields.find(f => { return f.name === adaptedParam.name; });
          if (!field) {
            throw new AdapterError('InternalError', `didn't find spread param field ${adaptedParam.name} in type ${adaptedParam.type.content.type.name}`);
          }
          fieldType = field.type;
        } else {
          fieldType = this.getOptionType(adaptedParam.type);
        }

        const optionsField = new rust.StructField(adaptedParam.name, 'pub', fieldType);
        optionsField.docs = adaptedParam.docs;
        rustMethod.options.type.fields.push(optionsField);
      }
    }

    // client params aren't included in method.parameters so
    // look for them in the remaining operation parameters.
    for (const opParam of allOpParams) {
      if (opParam.onClient) {
        const adaptedParam = this.adaptMethodParameter(opParam);
        adaptedParam.docs = this.adaptDocs(opParam.summary, opParam.doc);
        rustMethod.params.push(adaptedParam);
      }
    }

    const getResponseFormat = (): rust.PayloadFormatType => {
      // fetch the body format from the HTTP responses.
      // they should all have the same type so no need to match responses to type.
      let defaultContentType: string | undefined;
      for (const httpResp of method.operation.responses) {
        if (!httpResp.defaultContentType) {
          // we can get here if the operation returns multiple status codes
          // and one of them doesn't return a body (e.g. a 200 and a 204)
          continue;
        } else if (defaultContentType && defaultContentType !== httpResp.defaultContentType) {
          throw new AdapterError('InternalError', `method ${method.name} has conflicting content types`, method.__raw?.node);
        }
        defaultContentType = httpResp.defaultContentType;
      }

      if (!defaultContentType) {
        return 'NoFormat';
      }

      return this.adaptPayloadFormatType(defaultContentType);
    };

    // add any response headers
    const responseHeaders = new Array<tcgc.SdkServiceResponseHeader>();
    for (const httpResp of method.operation.responses) {
      for (const header of httpResp.headers) {
        if (responseHeaders.find((e) => e.serializedName === header.serializedName)) {
          continue;
        } else if (header.type.kind === 'constant') {
          // omit response headers that have a constant value
          // which is typically the content-type header. modeling
          // it isn't very useful by itself, plus it has the
          // side-effect of adding marker types and/or header
          // traits to all non application/json method responses.
          // callers can still retrieve the value from the raw
          // response headers if they need it.
          continue;
        } else if (header.access === 'internal') {
          // if a header has been marked as internal then skip it.
          // this happens if the tsp includes the header for documentation
          // purposes but the desire is to omit it from the generated code.
          // we skip them instead of making them pub(crate) to avoid the
          // case where all headers are internal, which would result in a
          // marker type where all its trait methods aren't public, making
          // it effectively useless.
          continue;
        }

        responseHeaders.push(header);
      }
    }

    const responseFormat = getResponseFormat();

    if (method.kind === 'paging') {
      if (responseFormat === 'NoFormat') {
        throw new AdapterError('InternalError', `paged method ${method.name} unexpected response format ${responseFormat}`, method.__raw?.node);
      }

      // for paged methods, tcgc models method.response.type as an Array<T>.
      // however, we want the synthesized paged response envelope type instead.
      const synthesizedType = method.operation.responses[0].type;
      if (!synthesizedType) {
        throw new AdapterError('InternalError', `paged method ${method.name} has no synthesized response type`, method.__raw?.node);
      } else if (synthesizedType.kind !== 'model') {
        throw new AdapterError('UnsupportedTsp', `paged method ${method.name} synthesized response type has unexpected kind ${synthesizedType.kind}`, method.__raw?.node);
      }

      const synthesizedModel = this.getModel(synthesizedType, new Array<string>());
      if (!this.crate.models.includes(synthesizedModel)) {
        this.crate.models.push(synthesizedModel);
      }

      // for the pager response type, remove the Option<T> around the Vec<T> for the page items
      if (!method.pagingMetadata.pageItemsSegments) {
        throw new AdapterError('InternalError', `paged method ${method.name} has no pageItemsSegments`, method.__raw?.node);
      }

      // unwrap all of the segments for the paged response
      let unwrappedCount = 0;
      let typeToUnwrap = synthesizedModel;
      for (const pageItemsSegment of method.pagingMetadata.pageItemsSegments) {
        const segment = pageItemsSegment;
        let serde: string;
        switch (responseFormat) {
          case 'JsonFormat':
            if (segment.kind !== 'property' || !segment.serializationOptions.json) {
              throw new AdapterError('InternalError', `paged method ${method.name} is missing JSON serialization data`, method.__raw?.node);
            }
            serde = segment.serializationOptions.json.name;
            break;
          case 'XmlFormat':
            if (segment.kind !== 'property' || !segment.serializationOptions.xml) {
              throw new AdapterError('InternalError', `paged method ${method.name} is missing XML serialization data`, method.__raw?.node);
            }
            serde = segment.serializationOptions.xml.name;
            break;
        }

        for (let i = 0; i < typeToUnwrap.fields.length; ++i) {
          const field = typeToUnwrap.fields[i];
          if (field.serde === serde) {
            // check if this has already been unwrapped (e.g. type is shared across operations)
            if (field.type.kind === 'option') {
              typeToUnwrap.fields[i].type = <rust.WireType>(<rust.Option>typeToUnwrap.fields[i].type).type;
              typeToUnwrap.fields[i].flags |= rust.ModelFieldFlags.PageItems;
            }

            // move to the next segment
            if (field.type.kind === 'model') {
              typeToUnwrap = field.type;
            }
            ++unwrappedCount;
            break;
          }
        }
      }

      if (unwrappedCount !== method.pagingMetadata.pageItemsSegments.length) {
        throw new AdapterError('InternalError', `failed to unwrap paged items for method ${method.name}`, method.__raw?.node);
      }

      // if the response contains more than the Vec<T> and next_link then use a PageIterator
      if (synthesizedModel.fields.length > 2) {
        rustMethod.returns = new rust.Result(this.crate, new rust.PageIterator(this.crate, new rust.Response(this.crate, synthesizedModel, responseFormat)));
      } else {
        rustMethod.returns = new rust.Result(this.crate, new rust.Pager(this.crate, new rust.Response(this.crate, synthesizedModel, responseFormat)));
      }
    } else if (method.kind === 'lro') {
      const format = responseFormat === 'NoFormat' ? 'JsonFormat' : responseFormat
      const responseType = this.typeToWireType(this.getModel(method.lroMetadata.logicalResult));
      if (responseType.kind !== 'model') {
        throw new AdapterError('InternalError', `envelope result for ${method.name} is not a model`, method.__raw?.node);
      }

      const pushModels = (model: rust.Model, crate: rust.Crate): void => {
        if (crate.models.some(m => m === model)) {
          return;
        }

        crate.models.push(model);
        for (const field of model.fields) {
          let fieldType = field.type;
          fieldType = fieldType.kind === 'option' ? fieldType.type : fieldType;
          fieldType = fieldType.kind === 'Vec' ? fieldType.type : fieldType;
          if (fieldType.kind === 'model') {
            pushModels(fieldType, crate);
          }
        }
      }
      pushModels(responseType, this.crate);

      rustMethod.returns = new rust.Result(this.crate, new rust.Poller(this.crate, new rust.Response(this.crate, responseType, format)));
    } else if (method.response.type && !(method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes')) {
      const response = new rust.Response(this.crate, this.typeToWireType(this.getType(method.response.type)), responseFormat);
      rustMethod.returns = new rust.Result(this.crate, response);
    } else if (responseHeaders.length > 0) {
      // for methods that don't return a modeled type but return headers,
      // we need to return a marker type
      const markerType = new rust.MarkerType(`${rustClient.name}${codegen.pascalCase(method.name)}Result`);
      markerType.docs.summary = `Contains results for ${this.asDocLink(`${rustClient.name}::${methodName}()`, `crate::generated::clients::${rustClient.name}::${methodName}()`)}`;
      this.crate.models.push(markerType);
      rustMethod.returns = new rust.Result(this.crate, new rust.Response(this.crate, markerType, responseFormat));
    } else if (method.response.type && method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes') {
      // bytes encoding indicates a streaming binary response
      rustMethod.returns = new rust.Result(this.crate, new rust.RawResponse(this.crate));
    } else {
      rustMethod.returns = new rust.Result(this.crate, new rust.Response(this.crate, this.getUnitType(), responseFormat));
    }

    const responseHeadersMap = this.adaptResponseHeaders(responseHeaders);
    rustMethod.responseHeaders = this.adaptResponseHeadersTrait(rustClient, rustMethod, Array.from(responseHeadersMap.values()));

    if (method.kind === 'paging') {
      // can't do this until the method has been completely adapted
      (<rust.PageableMethod>rustMethod).strategy = this.adaptPageableMethodStrategy(method, paramsMap, responseHeadersMap);
    }
  }

  /**
   * adapts response headers into Rust response headers and provides
   * a mapping from the tcgc response header to the Rust equivalent.
   * if there are no headers to adapt, an empty map is returned.
   * 
   * @param responseHeaders the response headers to adapt (can be empty)
   * @returns the map of response headers
   */
  private adaptResponseHeaders(responseHeaders: Array<tcgc.SdkServiceResponseHeader>): Map<tcgc.SdkServiceResponseHeader, rust.ResponseHeader> {
    const responseHeadersMap = new Map<tcgc.SdkServiceResponseHeader, rust.ResponseHeader>();
    // adapt the response headers and add them to the trait
    for (const header of responseHeaders) {
      let responseHeader: rust.ResponseHeader;
      if (header.type.kind === 'dict') {
        if (header.serializedName !== 'x-ms-meta' && header.serializedName !== 'x-ms-or') {
          throw new AdapterError('InternalError', `unexpected response header collection ${header.serializedName}`, header.__raw.node);
        }
        responseHeader = new rust.ResponseHeaderHashMap(snakeCaseName(header.name), header.serializedName);
      } else {
        responseHeader = new rust.ResponseHeaderScalar(snakeCaseName(header.name), fixETagName(header.serializedName), this.typeToWireType(this.getType(header.type)));
      }

      responseHeader.docs = this.adaptDocs(header.summary, header.doc);
      responseHeadersMap.set(header, responseHeader);
    }
    return responseHeadersMap;
  }

  /**
   * creates a Rust ResponseHeadersTrait for the specified response headers.
   * if there are no response headers, undefined is returned.
   * 
   * @param client the client that contains the method
   * @param method the method for which to create the trait
   * @param responseHeaders the response headers array (can be empty)
   * @returns a ResponseHeadersTrait or undefined
   */
  private adaptResponseHeadersTrait(client: rust.Client, method: MethodType, responseHeaders: Array<rust.ResponseHeader>): rust.ResponseHeadersTrait | undefined {
    if (responseHeaders.length === 0) {
      return undefined;
    }

    /**
     * recursively builds a name from the specified type.
     * e.g. Vec<FooModel> would be VecFooModel etc.
     * 
     * @param type the type for which to build a name
     * @returns the name
     */
    const recursiveTypeName = function (type: rust.MarkerType | rust.WireType): string {
      switch (type.kind) {
        case 'enum':
        case 'marker':
        case 'model':
          return type.name;
        case 'hashmap':
          return `${type.name}${recursiveTypeName(type.type)}`;
        case 'ref':
          return `Ref${recursiveTypeName(type.type)}`;
        case 'scalar':
          return codegen.capitalize(type.type);
        case 'slice':
          return `Slice${recursiveTypeName(type.type)}`;
        case 'Vec':
          return `${type.kind}${recursiveTypeName(type.type)}`;
        default:
          return codegen.capitalize(type.kind);
      }
    };

    // response header traits are only ever for marker types and payloads
    let implFor: rust.Response<rust.MarkerType | rust.WireType>;
    switch (method.returns.type.kind) {
      case 'pageIterator':
      case 'pager':
      case 'poller':
        implFor = method.returns.type.type;
        break;
      case 'response':
        if (method.returns.type.content.kind === 'unit') {
          // this is to filter out unit from ResponseTypes.
          // methods that return unit should have been skipped by our caller
          // so we should never hit this (if we do, we have a bug elsewhere).
          throw new AdapterError('InternalError', `unexpected method content kind ${method.returns.type.content.kind}`);
        }
        implFor = <rust.Response<rust.MarkerType | rust.WireType>>method.returns.type;
        break;
      default:
        // this is RawResponse which should have been previously skipped
        throw new AdapterError('InternalError', `unexpected method return kind ${method.returns.type.kind}`);
    }

    const traitName = `${recursiveTypeName(implFor.content)}Headers`;

    // NOTE: the complete doc text will be emitted at codegen time
    const docs = this.asDocLink(`${client.name}::${method.name}()`, `crate::generated::clients::${client.name}::${method.name}()`);
    const responseHeadersTrait = new rust.ResponseHeadersTrait(traitName, implFor, docs);
    responseHeadersTrait.headers.push(...responseHeaders);

    return responseHeadersTrait;
  }

  /**
   * creates the pageable strategy based on the method definition
   * 
   * @param method the pageable method for which to create a strategy
   * @param paramsMap maps tcgc method params to Rust params (needed for continuation token strategy)
   * @param respHeadersMap maps tcgc response headers to Rust response headers (needed for continuation token strategy)
   * @returns the pageable strategy
   */
  private adaptPageableMethodStrategy(method: tcgc.SdkPagingServiceMethod<tcgc.SdkHttpOperation>, paramsMap: Map<tcgc.SdkMethodParameter, rust.HeaderScalarParameter | rust.QueryScalarParameter>, respHeadersMap: Map<tcgc.SdkServiceResponseHeader, rust.ResponseHeader>): rust.PageableStrategyKind {
    if (method.pagingMetadata.nextLinkOperation) {
      // TODO: https://github.com/Azure/autorest.rust/issues/103
      throw new AdapterError('UnsupportedTsp', 'next page operation NYI', method.__raw?.node);
    } else if (method.pagingMetadata.nextLinkSegments) {
      if (method.pagingMetadata.nextLinkSegments.length > 1) {
        // TODO: https://github.com/Azure/autorest.rust/issues/102
        throw new AdapterError('UnsupportedTsp', 'nested next link path NYI', method.__raw?.node);
      }

      // this is the field in the response type that contains the next link URL
      const nextLinkSegment = method.pagingMetadata.nextLinkSegments[0];
      if (nextLinkSegment.kind !== 'property') {
        throw new AdapterError('InternalError', `unexpected kind ${nextLinkSegment.kind} for next link segment in operation ${method.name}`, method.__raw?.node);
      }

      const nextLinkField = this.fieldsMap.get(nextLinkSegment);
      if (!nextLinkField) {
        // the most likely explanation for this is lack of reference equality
        throw new AdapterError('InternalError', `missing next link field name ${nextLinkSegment.name} for operation ${method.name}`, method.__raw?.node);
      }
      return new rust.PageableStrategyNextLink(nextLinkField);
    } else if (method.pagingMetadata.continuationTokenParameterSegments && method.pagingMetadata.continuationTokenResponseSegments) {
      if (method.pagingMetadata.continuationTokenParameterSegments.length > 1) {
        throw new AdapterError('UnsupportedTsp', `nested continuationTokenParameterSegments NYI`, method.__raw?.node);
      }
      if (method.pagingMetadata.continuationTokenResponseSegments.length > 1) {
        throw new AdapterError('UnsupportedTsp', `nested continuationTokenResponseSegments NYI`, method.__raw?.node);
      }

      const tokenReq = method.pagingMetadata.continuationTokenParameterSegments[0];
      const tokenResp = method.pagingMetadata.continuationTokenResponseSegments[0];

      // find the continuation token parameter
      let requestToken: rust.HeaderScalarParameter | rust.QueryScalarParameter;
      switch (tokenReq.kind) {
        case 'method': {
          const tokenParam = paramsMap.get(tokenReq);
          if (!tokenParam) {
            throw new AdapterError('InternalError', `missing continuation token request parameter name ${tokenResp.name} for operation ${method.name}`, method.__raw?.node);
          }
          requestToken = tokenParam;
          break;
        }
        default:
          throw new AdapterError('InternalError', `unhandled continuationTokenParameterSegment kind ${tokenReq.kind}`, tokenReq.__raw?.node);
      }

      // find the continuation token response
      let responseToken: rust.ResponseHeaderScalar | rust.ModelField;
      switch (tokenResp.kind) {
        case 'property': {
          const tokenField = this.fieldsMap.get(tokenResp);
          if (!tokenField) {
            throw new AdapterError('InternalError', `missing continuation token response field name ${tokenResp.name} for operation ${method.name}`, method.__raw?.node);
          }
          responseToken = tokenField;
          break;
        }
        case 'responseheader': {
          const tokenHeader = respHeadersMap.get(tokenResp);
          if (!tokenHeader) {
            throw new AdapterError('InternalError', `missing continuation token response header name ${tokenResp.name} for operation ${method.name}`, method.__raw?.node);
          }
          if (tokenHeader.kind !== 'responseHeaderScalar') {
            throw new AdapterError('InternalError', `unexpected response header kind ${tokenHeader.kind}`);
          }
          responseToken = tokenHeader;
          break;
        }
        default:
          throw new AdapterError('InternalError', `missing continuation token`, method.__raw?.node);
      }
      return new rust.PageableStrategyContinuationToken(requestToken, responseToken);
    } else {
      throw new AdapterError('InternalError', `unknown paging strategy for operation ${method.name}`, method.__raw?.node);
    }
  }

  /**
   * converts a tcgc operation parameter into a Rust method parameter
   * 
   * @param param the tcgc operation parameter to convert
   * @returns a Rust method parameter
   */
  private adaptMethodParameter(param: tcgc.SdkHttpParameter): rust.MethodParameter {
    /**
     * used to create keys for this.clientMethodParams
     * @param param the param for which to create a key
     * @returns the map's key
     */
    const getClientParamsKey = function (param: tcgc.SdkHttpParameter): string {
      // include the param kind in the key name as a client param can be used
      // in different places across methods (path/query)
      return `${param.name}-${param.kind}`;
    };

    const paramLoc = param.onClient ? 'client' : 'method';

    // if this is a client method param, check if we've already adapted it
    if (paramLoc === 'client') {
      const clientMethodParam = this.clientMethodParams.get(getClientParamsKey(param));
      if (clientMethodParam) {
        return clientMethodParam;
      }
    }

    /** returns the corresponding client param field name for a client parameter */
    const getCorrespondingClientParamName = function (param: tcgc.SdkHttpParameter): string {
      if (param.onClient && param.correspondingMethodParams.length === 1) {
        // we get here if the param was aliased via the @paramAlias decorator.
        // this gives us the name of the client param's backing field which has
        // the aliased name.
        return param.correspondingMethodParams[0].name;
      }
      return param.name;
    };

    const paramName = naming.getEscapedReservedName(snakeCaseName(getCorrespondingClientParamName(param)), 'param');
    let paramType = this.getType(param.type);

    // for required header/path/query method string params, we might emit them as borrowed types
    if (!param.optional && !param.onClient && (param.kind === 'header' || param.kind === 'path' || param.kind === 'query')) {
      const borrowedType = this.canBorrowMethodParam(paramType, param.kind);
      if (borrowedType) {
        paramType = borrowedType;
      }
    }

    let adaptedParam: rust.MethodParameter;
    switch (param.kind) {
      case 'body': {
        let requestType: rust.Bytes | rust.Payload;
        if (param.type.kind === 'bytes' && param.type.encode === 'bytes') {
          // bytes encoding indicates a streaming binary request
          requestType = new rust.Bytes(this.crate);
        } else {
          requestType = new rust.Payload(this.typeToWireType(paramType), this.adaptPayloadFormat(param.defaultContentType));
        }
        const requestFormatType = this.adaptPayloadFormatType(param.defaultContentType);
        adaptedParam = new rust.BodyParameter(paramName, paramLoc, param.optional, new rust.RequestContent(this.crate, requestType, requestFormatType));
        break;
      }
      case 'cookie':
        // TODO: https://github.com/Azure/typespec-rust/issues/192
        throw new AdapterError('UnsupportedTsp', 'cookie parameters are not supported', param.__raw?.node);
      case 'header':
        if (param.collectionFormat) {
          if (paramType.kind !== 'Vec' && !isRefSlice(paramType)) {
            throw new AdapterError('InternalError', `unexpected kind ${paramType.kind} for HeaderCollectionParameter`, param.__raw?.node);
          }
          let format: rust.CollectionFormat;
          switch (param.collectionFormat) {
            case 'csv':
            case 'simple':
              format = 'csv';
              break;
            case 'pipes':
            case 'ssv':
            case 'tsv':
              format = param.collectionFormat;
              break;
            default:
              throw new AdapterError('InternalError', `unexpected format ${param.collectionFormat} for HeaderCollectionParameter`, param.__raw?.node);
          }
          adaptedParam = new rust.HeaderCollectionParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, format);
        } else if (param.serializedName === 'x-ms-meta') {
          if (paramType.kind !== 'hashmap') {
            throw new AdapterError('InternalError', `unexpected kind ${paramType.kind} for header ${param.serializedName}`, param.__raw?.node);
          }
          adaptedParam = new rust.HeaderHashMapParameter(paramName, param.serializedName, paramLoc, param.optional, paramType);
        } else {
          paramType = this.typeToWireType(paramType);
          switch (paramType.kind) {
            case 'hashmap':
            case 'jsonValue':
            case 'model':
            case 'slice':
            case 'str':
            case 'Vec':
              throw new AdapterError('InternalError', `unexpected kind ${paramType.kind} for scalar header ${param.serializedName}`, param.__raw?.node);
          }
          adaptedParam = new rust.HeaderScalarParameter(paramName, param.serializedName, paramLoc, param.optional, paramType);
          adaptedParam.isApiVersion = param.isApiVersionParam;
        }
        break;
      case 'path': {
        paramType = this.typeToWireType(paramType);
        let style: rust.ParameterStyle = 'simple';
        const tspStyleString = (param.style as string);
        if (!['simple', 'path', 'label', 'matrix'].includes(tspStyleString)) {
          throw new AdapterError('InternalError', `unsupported style ${tspStyleString} for parameter ${param.serializedName}`, param.__raw?.node);
        } else {
          style = tspStyleString as rust.ParameterStyle;
        }

        if (isRefSlice(paramType)) {
          adaptedParam = new rust.PathCollectionParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, param.allowReserved, style, param.explode);
        } else if (paramType.kind === 'hashmap') {
          adaptedParam = new rust.PathHashMapParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, param.allowReserved, style, param.explode);
        } else {
          switch (paramType.kind) {
            case 'jsonValue':
            case 'model':
            case 'slice':
            case 'str':
            case 'Vec':
              throw new AdapterError('InternalError', `unexpected kind ${paramType.kind} for scalar path ${param.serializedName}`, param.__raw?.node);
          }

          adaptedParam = new rust.PathScalarParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, param.allowReserved, style);
        }
      } break;
      case 'query':
        paramType = this.typeToWireType(paramType);
        if (paramType.kind === 'Vec' || isRefSlice(paramType)) {
          let format: rust.ExtendedCollectionFormat = param.explode ? 'multi' : 'csv';
          if (param.collectionFormat) {
            format = param.collectionFormat === 'simple' ? 'csv' : (param.collectionFormat === 'form' ? 'multi' : param.collectionFormat);
          }
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryCollectionParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true, format);
        } else if (paramType.kind === 'hashmap') {
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryHashMapParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true, param.explode);
        } else {
          switch (paramType.kind) {
            case 'jsonValue':
            case 'model':
            case 'slice':
            case 'str':
              throw new AdapterError('InternalError', `unexpected kind ${paramType.kind} for scalar query ${param.serializedName}`, param.__raw?.node);
          }
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryScalarParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true);
          adaptedParam.isApiVersion = param.isApiVersionParam;
        }
        break;
    }

    adaptedParam.docs = this.adaptDocs(param.summary, param.doc);

    if (paramLoc === 'client') {
      this.clientMethodParams.set(getClientParamsKey(param), adaptedParam);
    }

    return adaptedParam;
  }

  /**
   * updates the specified type to a borrowed type based on its type and kind.
   * if no such transformation is necessary, undefined is returned.
   * e.g. a String param that doesn't need to be owned will be
   * returned as a &str.
   * 
   * @param type the param type to be updated
   * @param kind the kind of param
   * @returns the updated param type or undefined
   */
  private canBorrowMethodParam(type: rust.Type, kind: 'header' | 'path' | 'query'): rust.Type | undefined {
    const recursiveBuildVecStr = (v: rust.WireType): rust.WireType => {
      switch (v.kind) {
        case 'encodedBytes':
          return this.getRefType(this.getEncodedBytes(v.encoding, true));
        case 'hashmap':
          return this.getHashMap(this.typeToWireType(recursiveBuildVecStr(v.type)));
        case 'String':
          return this.getRefType(this.getStringSlice());
        case 'Vec':
          return this.getVec(this.typeToWireType(recursiveBuildVecStr(v.type)));
        default:
          throw new AdapterError('InternalError', `unexpected kind ${v.kind}`);
      }
    };

    const recursiveUnwrapVec = function (type: rust.Type): rust.Type {
      if (type.kind === 'Vec') {
        return recursiveUnwrapVec(type.type);
      }
      return type;
    };

    switch (type.kind) {
      case 'String':
        // header String params are always owned
        if (kind !== 'header') {
          return this.getRefType(this.getStringSlice());
        }
        break;
      case 'Vec': {
        // if this is an array of string, we ultimately want a slice of &str
        const unwrapped = recursiveUnwrapVec(type);
        if (unwrapped.kind === 'String' || unwrapped.kind === 'encodedBytes') {
          return this.getRefType(this.getSlice(recursiveBuildVecStr(type.type)));
        }
        return this.getRefType(this.getSlice(type.type));
      }
      case 'encodedBytes':
        return this.getRefType(this.getEncodedBytes(type.encoding, true));
    }
    return undefined;
  }

  /**
   * narrows a rust.Type to a rust.WireType.
   * if type isn't a rust.WireType, an error is thrown.
   * 
   * @param type the type to narrow
   * @returns the narrowed type
   */
  private typeToWireType(type: rust.Type): rust.WireType {
    switch (type.kind) {
      case 'bytes':
      case 'decimal':
      case 'encodedBytes':
      case 'enum':
      case 'enumValue':
      case 'Etag':
      case 'hashmap':
      case 'jsonValue':
      case 'literal':
      case 'model':
      case 'offsetDateTime':
      case 'ref':
      case 'safeint':
      case 'scalar':
      case 'slice':
      case 'str':
      case 'String':
      case 'Url':
      case 'Vec':
        return type;
      default:
        throw new AdapterError('InternalError', `cannot convert ${type.kind} to a wire type`);
    }
  }

  /**
   * converts a tcgc spread parameter into a Rust partial body parameter.
   * 
   * @param param the tcgc method parameter to convert
   * @param format the wire format for the underlying body type
   * @param opParamType the tcgc model to which the spread parameter belongs
   * @returns a Rust partial body parameter
   */
  private adaptMethodSpreadParameter(param: tcgc.SdkMethodParameter, format: rust.PayloadFormat, opParamType: tcgc.SdkModelType): rust.PartialBodyParameter {
    // find the corresponding field within the model so we can get its index
    let serializedName: string | undefined;
    for (const property of opParamType.properties) {
      if (property.kind === 'property' && property.name === param.name) {
        serializedName = this.getSerializedPropertyName(property);
        break;
      }
    }

    if (serializedName === undefined) {
      throw new AdapterError('InternalError', `didn't find body model property for spread parameter ${param.name}`, param.__raw?.node);
    }

    // this is the internal model type that the spread params coalesce into
    const payloadType = this.getType(opParamType);
    if (payloadType.kind !== 'model') {
      throw new AdapterError('InternalError', `unexpected kind ${payloadType.kind} for spread body param`, opParamType.__raw?.node);
    }

    const paramName = naming.getEscapedReservedName(snakeCaseName(param.name), 'param');
    const paramLoc: rust.ParameterLocation = 'method';
    const formatType = shared.getPayloadFormatType(format);
    const adaptedParam = new rust.PartialBodyParameter(paramName, paramLoc, param.optional, serializedName, this.getType(param.type), new rust.RequestContent(this.crate, new rust.Payload(payloadType, format), formatType));
    return adaptedParam;
  }

  /**
   * converts a Content-Type header value into a payload format
   * 
   * @param contentType the value of the Content-Type header
   * @returns a payload format
   */
  private adaptPayloadFormat(contentType: string): rust.PayloadFormat {
    // we only recognize/support JSON and XML content types.
    if (contentType.match(/json/i)) {
      return 'json';
    } else if (contentType.match(/xml/i)) {
      // XML support is disabled by default
      this.crate.addDependency(new rust.CrateDependency('azure_core', ['xml']));
      return 'xml';
    } else {
      throw new AdapterError('InternalError', `unexpected contentType ${contentType}`);
    }
  }

  /**
   * converts an accept or content-type header value into a payload format type
   * 
   * @param contentType the value of the Accept or Content-Type header
   * @returns a response format
   */
  private adaptPayloadFormatType(contentType: string): rust.PayloadFormatType {
    // we only recognize/support JSON and XML content types.
    // anything else is NoFormat
    if (contentType.match(/json/i)) {
      return 'JsonFormat';
    } else if (contentType.match(/xml/i)) {
      // XML support is disabled by default
      this.crate.addDependency(new rust.CrateDependency('azure_core', ['xml']));
      return 'XmlFormat';
    } else {
      return 'NoFormat';
    }
  }
}

/** type guard to determine if type is a Ref<Slice> */
function isRefSlice(type: rust.Type): type is rust.Ref<rust.Slice> {
  return shared.asTypeOf<rust.Ref<rust.Slice>>(type, 'slice', 'ref') !== undefined;
}

/** method types that send/receive data */
type MethodType = rust.AsyncMethod | rust.PageableMethod | rust.LroMethod;

/** supported kinds of tcgc scalars */
type tcgcScalarKind = 'boolean' | 'float' | 'float32' | 'float64' | 'int16' | 'int32' | 'int64' | 'int8' | 'uint16' | 'uint32' | 'uint64' | 'uint8';

/**
 * transforms Etag etc to all lower case.
 * this is to prevent inadvertently snake-casing
 * Etag to e_tag.
 * 
 * if name isn't some variant of Etag the
 * original value is returned.
 * 
 * @param name the name to transform
 * @returns etag or the original value
 */
function fixETagName(name: string): string {
  return name.match(/^etag$/i) ? 'etag' : name;
}

/**
 * removes any illegal characters from the provided name.
 * note that characters _ and - are preserved so that the
 * proper snake-casing can be performed.
 * 
 * @param name the name to transform
 * @returns the transformed name or the original value
 */
function removeIllegalChars(name: string): string {
  return name.replace(/[!@#$%^&*()+=]/g, '');
}

/**
 * snake-cases the provided name
 * 
 * @param name the name to snake-case
 * @returns name in snake-case format
 */
function snakeCaseName(name: string): string {
  return codegen.deconstruct(fixETagName(removeIllegalChars(name))).join('_');
}

/**
 * recursively creates a map key from the specified type.
 * this is idempotent so providing the same type will create
 * the same key.
 * 
 * type is recursively unwrapped, and each layer is used to construct
 * the key. e.g. if obj is a HashMap<String, Vec<i32>> this would
 * unwrap to hashmap-Vec-i32.
 * 
 * @param root the starting value for the key
 * @param type the type for which to create the key
 * @returns a string containing the complete map key
 */
function recursiveKeyName(root: string, type: rust.Box | rust.Payload | rust.RequestContent | rust.Struct | rust.WireType): string {
  switch (type.kind) {
    case 'Vec':
    case 'box':
      return recursiveKeyName(`${root}-${type.kind}`, type.type);
    case 'encodedBytes':
      return `${root}-${type.kind}-${type.encoding}${type.slice ? '-slice' : ''}`;
    case 'enum':
      return `${root}-${type.kind}-${type.name}`;
    case 'enumValue':
      return `${root}-${type.type.name}-${type.name}`;
    case 'hashmap':
      return recursiveKeyName(`${root}-${type.kind}`, type.type);
    case 'offsetDateTime':
      return `${root}-${type.kind}-${type.encoding}${type.utc ? '-utc' : ''}`;
    case 'model':
    case 'struct':
      return `${root}-${type.kind}-${type.name}`;
    case 'literal':
      return `${recursiveKeyName(`${root}-${type.kind}`, type.valueKind)}-${type.value}`;
    case 'payload':
      return recursiveKeyName(`${root}-${type.kind}-${type.format}`, type.type);
    case 'ref':
      return recursiveKeyName(`${root}-${type.kind}`, type.type);
    case 'requestContent':
      return recursiveKeyName(`${root}-${type.kind}`, type.content);
    case 'safeint':
    case 'decimal':
      return `${root}-${type.kind}${type.stringEncoding ? '-string' : ''}`;
    case 'scalar':
      return `${root}-${type.kind}-${type.type}${type.stringEncoding ? '-string' : ''}`;
    case 'slice':
      return recursiveKeyName(`${root}-${type.kind}`, type.type);
    default:
      return `${root}-${type.kind}`;
  }
}

/**
 * returns the XML-specific name based on the provided decorators
 * 
 * @param decorators the decorators to enumerate
 * @returns the XML-specific name or undefined if there isn't one
 */
function getXMLName(decorators: Array<tcgc.DecoratorInfo>): string | undefined {
  if (decorators.length === 0) {
    return undefined;
  }

  for (const decorator of decorators) {
    switch (decorator.name) {
      case 'TypeSpec.@encodedName':
        if (decorator.arguments['mimeType'] === 'application/xml') {
          return <string>decorator.arguments['name'];
        }
        break;
      case 'TypeSpec.Xml.@name':
        return <string>decorator.arguments['name'];
    }
  }

  return undefined;
}

/**
 * returns the XML-specific kind for field based on the provided decorators
 * 
 * @param decorators the decorators to enumerate
 * @param field the Rust model field to which the kind will apply
 * @returns the XML-specific field kind or undefined if there isn't one
 */
function getXMLKind(decorators: Array<tcgc.DecoratorInfo>, field: rust.ModelField): rust.XMLKind | undefined {
  if (decorators.length === 0) {
    return undefined;
  }

  for (const decorator of decorators) {
    switch (decorator.name) {
      case 'TypeSpec.Xml.@attribute':
        return 'attribute';
      case 'TypeSpec.Xml.@unwrapped': {
        const fieldType = shared.unwrapOption(field.type);
        switch (fieldType.kind) {
          case 'Vec':
            return 'unwrappedList';
          case 'String':
            // an unwrapped string means it's text
            return 'text';
        }
      }
    }
  }

  return undefined;
}
