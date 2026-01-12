/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore addl responseheader subclients lropaging

import * as codegen from '@azure-tools/codegen';
import {values} from '@azure-tools/linq';
import * as tsp from '@typespec/compiler';
import * as http from '@typespec/http';
import * as helpers from './helpers.js';
import * as naming from './naming.js';
import {RustEmitterOptions} from '../lib.js';
import * as shared from '../shared/shared.js';
import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as rust from '../codemodel/index.js';
import {FinalStateValue} from "@azure-tools/typespec-azure-core";

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
  readonly target: tsp.DiagnosticTarget | typeof tsp.NoTarget;

  constructor(code: ErrorCode, message: string, target?: tsp.DiagnosticTarget) {
    super(message);
    this.code = code;
    this.target = target ?? tsp.NoTarget;
  }
}

/**
 * ExternalError is thrown when an external component reports a
 * diagnostic error that would prevent the emitter from proceeding.
 */
export class ExternalError extends Error { }

/** Adapter converts the tcgc code model to a Rust Crate */
export class Adapter {
  /**
   * Creates an Adapter for the specified EmitContext.
   * 
   * @param context the compiler context from which to create the Adapter
   * @returns 
   */
  static async create(context: tsp.EmitContext<RustEmitterOptions>): Promise<Adapter> {
    // @encodedName can be used in XML scenarios, it is effectively the
    // same as TypeSpec.Xml.@name. however, it's filtered out by default
    // so we need to add it to the allow list of decorators
    const ctx = await tcgc.createSdkContext(context, '@azure-tools/typespec-rust', {
      additionalDecorators: ['TypeSpec\\.@encodedName', '@clientName', 'Azure.ClientGenerator.Core.@deserializeEmptyStringAsNull'],
      disableUsageAccessPropagationToBase: true,
    });

    context.program.reportDiagnostics(ctx.diagnostics);
    for (const diag of ctx.diagnostics) {
      if (diag.severity === 'error') {
        // there's no point in continuing if tcgc
        // has reported diagnostic errors, so exit.
        // this prevents spurious crashes in the
        // emitter as our input state is invalid.
        throw new ExternalError();
      }
    }

    return new Adapter(ctx, context.options);
  }

  private readonly crate: rust.Crate;
  private readonly ctx: tcgc.SdkContext;
  private readonly options: RustEmitterOptions;

  // cache of adapted types
  private readonly types: Map<string, rust.Type>;

  // cache of adapted client method params
  private readonly clientMethodParams: Map<string, rust.MethodParameter>;

  // maps a tcgc model field to the adapted struct field
  private readonly fieldsMap: Map<tcgc.SdkModelPropertyType | tcgc.SdkPathParameter, rust.ModelField>;

  private constructor(ctx: tcgc.SdkContext, options: RustEmitterOptions) {
    this.types = new Map<string, rust.Type>();
    this.clientMethodParams = new Map<string, rust.MethodParameter>();
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

    if (this.crate.clients.length > 0 || this.crate.enums.length > 0 || this.crate.models.length > 0 || this.crate.unions.length > 0) {
      this.crate.addDependency(new rust.CrateDependency('azure_core'));
    }

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
    for (const sdkUnion of this.ctx.sdkPackage.unions.filter(u => u.kind === 'union')) {
      if (!sdkUnion.discriminatedOptions) {
        throw new AdapterError('UnsupportedTsp', 'non-discriminated unions are not supported', sdkUnion.__raw?.node);
      }
      const rustUnion = this.getDiscriminatedUnion(sdkUnion);
      this.crate.unions.push(rustUnion);
    }

    for (const sdkEnum of this.ctx.sdkPackage.enums) {
      if (<tcgc.UsageFlags>(sdkEnum.usage & tcgc.UsageFlags.ApiVersionEnum) === tcgc.UsageFlags.ApiVersionEnum) {
        // we skip generating the enums for API
        // versions as we expose it as a String
        continue;
      }

      if (sdkEnum.external) {
        this.getExternalType(sdkEnum.external);
      } else {
        const rustEnum = this.getEnum(sdkEnum);
        this.crate.enums.push(rustEnum);
      }
    }

    const processedTypes = new Set<string>();

    for (const model of this.ctx.sdkPackage.models) {
      if ((model.usage & tcgc.UsageFlags.Input) === 0 && (model.usage & tcgc.UsageFlags.Output) === 0 && (model.usage & tcgc.UsageFlags.Spread) === 0) {
        // skip types without input and output usage. this will include core
        // types unless they're explicitly referenced (e.g. a model property).
        // we keep the models for spread params as we internally use them.
        continue;
      }

      // TODO: workaround for https://github.com/Azure/typespec-azure/issues/3614
      if (processedTypes.has(model.name)) {
        continue;
      } else {
        processedTypes.add(model.name);
      }
      // END workaround

      if (model.discriminatedSubtypes) {
        const rustUnion = this.getDiscriminatedUnion(model);
        this.crate.unions.push(rustUnion);
      }

      if (model.external) {
        this.getExternalType(model.external);
      } else {
        const rustModel = this.getModel(model);
        this.crate.models.push(rustModel);
      }
    }
  }

  /**
   * converts a tcgc enum to a Rust enum
   * 
   * @param sdkEnum the tcgc enum to convert
   * @returns a Rust enum
   */
  private getEnum(sdkEnum: tcgc.SdkEnumType): rust.Enum {
    const enumName = codegen.deconstruct(sdkEnum.name).map((each) => codegen.capitalize(each)).join('');
    let rustEnum = this.types.get(enumName);
    if (rustEnum) {
      return <rust.Enum>rustEnum;
    }

    let enumType: rust.EnumType;
    switch (sdkEnum.valueType.kind) {
      case 'float':
      case 'float32':
        enumType = 'f32';
        break;
      case 'float64':
        enumType = 'f64';
        break;
      case 'int8':
      case 'int16':
      case 'int32':
        enumType = 'i32';
        break;
      case 'int64':
        enumType = 'i64';
        break;
      case 'string':
        enumType = 'String';
        break;
      default:
        throw new AdapterError('UnsupportedTsp', `unsupported enum underlying type ${sdkEnum.valueType.kind}`, sdkEnum.__raw?.node);
    }

    rustEnum = new rust.Enum(enumName, adaptAccessFlags(sdkEnum.access), !sdkEnum.isFixed, enumType);
    rustEnum.docs = this.adaptDocs(sdkEnum.summary, sdkEnum.doc);
    this.types.set(enumName, rustEnum);

    // the first pass is to detect any enum values that coalesce into duplicate entries
    const rustEnumNameToSdkEnumName = new Map<string, Array<tcgc.SdkEnumValueType>>();
    for (const value of sdkEnum.values) {
      const enumValueName = naming.fixUpEnumValueName(value);
      let existingMapping = rustEnumNameToSdkEnumName.get(enumValueName);
      if (!existingMapping) {
        existingMapping = new Array<tcgc.SdkEnumValueType>();
        rustEnumNameToSdkEnumName.set(enumValueName, existingMapping);
      }
      existingMapping.push(value);
    }

    // now adapt the values, renaming any collisions as required and reporting diagnostics
    let groupCounter = 1;
    for (const entry of rustEnumNameToSdkEnumName.entries()) {
      const enumValueName = entry[0];
      const enumValues = entry[1];
      if (enumValues.length === 1) {
        const rustEnumValue = new rust.EnumValue(enumValueName, rustEnum, enumValues[0].value);
        rustEnumValue.docs = this.adaptDocs(enumValues[0].summary, enumValues[0].doc);
        rustEnum.values.push(rustEnumValue);
      } else {
        this.ctx.program.reportDiagnostic({
          code: 'NameCollision',
          severity: 'warning',
          message: `enum values ${enumValues.map((each) => `"${each.value}"`).join(', ')} coalesce into the same name ${enumValueName}`,
          target: sdkEnum.__raw?.node ?? tsp.NoTarget,
        });
        for (let i = 0; i < enumValues.length; ++i) {
          const enumValue = enumValues[i];
          const collidingEnumValueName = `COLLIDES_GRP${groupCounter}_ID${i + 1}_${enumValueName}`;
          const rustEnumValue = new rust.EnumValue(collidingEnumValueName, rustEnum, enumValue.value);
          rustEnumValue.docs = this.adaptDocs(enumValue.summary, enumValue.doc);
          rustEnum.values.push(rustEnumValue);
        }
        ++groupCounter;
      }
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
      if (value.name === naming.fixUpEnumValueName(sdkEnumValue)) {
        return value;
      }
    }
    throw new AdapterError('InternalError', `didn't find enum value for name ${sdkEnumValue.name} in enum ${enumType.name}`, sdkEnumValue.__raw?.node);
  }

  /**
   * converts external type info to a Rust external type.
   * 
   * @param eti the tcgc external type info to convert
   * @returns a Rust external type
   */
  private getExternalType(eti: tcgc.ExternalTypeInfo): rust.ExternalType {
    let externalType = this.types.get(eti.identity);
    if (externalType) {
      return <rust.ExternalType>externalType;
    }

    // eti.identity is the fully qualified path to the type.
    // split it into the type name and its import path.
    const splitAt = eti.identity.lastIndexOf('::');
    externalType = new rust.ExternalType(this.crate, eti.identity.substring(splitAt + 2), eti.identity.substring(0, splitAt));
    this.types.set(eti.identity, externalType);
    return externalType;
  }

  /**
   * converts a tcgc model to a Rust model
   * 
   * @param model the tcgc model to convert
   * @param stack is a stack of model type names used to detect recursive type definitions
   * @param modelName optional parameter to override model name
   * @returns a Rust model
   */
  private getModel(model: tcgc.SdkModelType, stack?: Array<string>, modelName?: string): rust.Model {
    modelName = modelName ?? model.name;
    if (modelName.length === 0) {
      throw new AdapterError('InternalError', 'unnamed model', model.__raw?.node); // TODO: this might no longer be an issue
    }

    // remove any non-word characters from the name.
    // the most common case is something like Foo.Bar.Baz
    modelName = codegen.capitalize(modelName).replace(/\W/g, '');
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

    let addlProps = model.additionalProperties;

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

      // propagate parent's additional properties if we don't yet have any.
      // if we do, ensure that their kinds match.
      if (!addlProps) {
        addlProps = parent.additionalProperties;
      } else if (parent.additionalProperties && addlProps.kind !== parent.additionalProperties.kind) {
        throw new AdapterError(
          'UnsupportedTsp',
          `model ${model.name} has additional properties kind ${addlProps.kind} which conflicts with parent model ${parent.name} additional properties kind ${parent.additionalProperties.kind}`,
          model.__raw?.node,
        );
      }

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

    if (addlProps) {
      const addlPropsType = this.getHashMap(this.typeToWireType(this.getType(addlProps)));
      const addlPropsField = new rust.ModelAdditionalProperties('additional_properties', 'pub', this.getOptionType(addlPropsType));
      addlPropsField.docs.summary = 'contains unnamed additional properties';
      rustModel.fields.push(addlPropsField);
    }

    stack.pop();

    return rustModel;
  }

  /**
   * converts a tcgc union to a Rust union
   *
   * @param union the tcgc union to convert
   * @returns a Rust union
   */
  private getDiscriminatedUnion(src: tcgc.SdkModelType | tcgc.SdkUnionType): rust.DiscriminatedUnion {
    if (src.name.length === 0) {
      throw new AdapterError('InternalError', 'unnamed union', src.__raw?.node);
    }

    const unionName = src.kind === 'model' ? `${codegen.capitalize(src.name)}Kind` : codegen.capitalize(src.name);
    const keyName = `discriminated-union-${unionName}`;
    let rustUnion = this.types.get(keyName);
    if (rustUnion) {
      return <rust.DiscriminatedUnion>rustUnion;
    }

    switch (src.kind) {
      case 'model': {
        if (!src.discriminatedSubtypes) {
          // we should have verified this earlier.
          // having this check means the compiler won't bark
          // at us when accessing src.discriminatedSubtypes
          throw new AdapterError('InternalError', 'getDiscriminatedUnion called for non-polymorphic model', src.__raw?.node);
        }

        // find the discriminator field
        let discriminatorPropertyName: string | undefined;
        for (const prop of src.properties) {
          if (prop.kind === 'property' && prop.discriminator) {
            discriminatorPropertyName = prop.name;
            break;
          }
        }
        if (!discriminatorPropertyName) {
          throw new AdapterError('InternalError', `failed to find discriminator field for type ${src.name}`, src.__raw?.node);
        }

        rustUnion = new rust.DiscriminatedUnion(unionName, adaptAccessFlags(src.access), discriminatorPropertyName);
        rustUnion.unionKind = new rust.DiscriminatedUnionBase(this.getModel(src));

        for (const subType of values(src.discriminatedSubtypes)) {
          if (!subType.discriminatorValue) {
            throw new AdapterError('InternalError', `model ${src.name} has no discriminator value`, src.__raw?.node)
          }
          const unionMemberType = this.getModel(subType);
          const rustUnionMember = new rust.DiscriminatedUnionMember(unionMemberType, subType.discriminatorValue);
          rustUnion.members.push(rustUnionMember);
        }
        break;
      }
      case 'union': {
        if (!src.discriminatedOptions) {
          // we should have verified this earlier.
          // having this check means the compiler won't bark
          // at us when accessing src.discriminatedOptions
          throw new AdapterError('InternalError', 'getDiscriminatedUnion called for non-discriminated union', src.__raw?.node);
        }

        rustUnion = new rust.DiscriminatedUnion(unionName, adaptAccessFlags(src.access), src.discriminatedOptions.discriminatorPropertyName);
        if (src.discriminatedOptions.envelopePropertyName) {
          rustUnion.unionKind = new rust.DiscriminatedUnionEnvelope(src.discriminatedOptions.envelopePropertyName);
        }

        // TODO: remove when https://github.com/microsoft/typespec/issues/8455 is complete
        const discriminatorValues = new Map<string, string>();
        const rawUnion = <tsp.Union | undefined>src.__raw;
        if (rawUnion) {
          for (const [variantKey, variant] of rawUnion.variants) {
            const discriminatorValue = typeof variantKey === 'string' ? variantKey : variantKey.toString();
            if (variant.type.kind === 'Model') {
              discriminatorValues.set(variant.type.name, discriminatorValue);
            } else {
              throw new AdapterError('InternalError', `unexpected kind ${variant.type.kind} for discriminated union member`, rawUnion);
            }
          }
        }
        // END WORKAROUND

        for (const unionMember of src.variantTypes) {
          if (unionMember.kind !== 'model') {
            throw new AdapterError('UnsupportedTsp', `non-model union member kind ${unionMember.kind}`, unionMember.__raw?.node);
          }

          // TODO: use unionMember.discriminatorValue
          const discriminatorValue = discriminatorValues.get(unionMember.name);
          if (!discriminatorValue) {
            throw new AdapterError('InternalError', `didn't find discriminant value for type ${unionMember.name}`, unionMember.__raw?.node);
          }

          const unionMemberType = this.getModel(unionMember);
          const rustUnionMember = new rust.DiscriminatedUnionMember(unionMemberType, discriminatorValue);
          rustUnionMember.docs = this.adaptDocs(unionMember.summary, unionMember.doc);
          rustUnion.members.push(rustUnionMember);
        }
        break;
      }
    }

    rustUnion.docs = this.adaptDocs(src.summary, src.doc);
    this.types.set(keyName, rustUnion);

    return rustUnion;
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
    const fieldNeedsBoxing = function(fieldType: rust.Type): fieldType is rust.WireType {
      if (fieldType.kind === 'model' && stack.includes(fieldType.name)) {
        // if the field's type is a model and it's in the type stack then
        // box it. this is to avoid infinitely recursive type definitions.
        return true;
      } else if (fieldType.kind === 'discriminatedUnion') {
        // if the field is a discriminated union whose type
        // is part of the same union then box it.
        for (const member of fieldType.members) {
          if (stack.includes(member.type.name)) {
            return true;
          }
        }
      }
      return false;
    };

    let fieldType = this.getType(property.type, stack);
    if (fieldNeedsBoxing(fieldType)) {
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

    if (property.decorators.find((decorator) => decorator.name === 'Azure.ClientGenerator.Core.@deserializeEmptyStringAsNull') !== undefined) {
      modelField.flags |= rust.ModelFieldFlags.DeserializeEmptyStringAsNone;
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
    const getDateTimeEncoding = (encoding: string): rust.DateTimeEncoding => {
      switch (encoding) {
        case 'rfc3339-fixed-width':
          this.crate.addDependency(new rust.CrateDependency('time'));
          return encoding;
        case 'rfc3339':
        case 'rfc7231':
          return encoding;
        case 'unixTimestamp':
          return 'unix_time';
        default:
          throw new AdapterError('UnsupportedTsp', `unhandled date-time encoding ${encoding}`, type.__raw?.node);
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
        if (type.external) {
          return this.getExternalType(type.external);
        }
        return this.getEnum(type);
      case 'enumvalue':
        return this.getEnumValue(type);
      case 'model':
        if (type.external) {
          return this.getExternalType(type.external);
        } else if (type.discriminatedSubtypes) {
          return this.getDiscriminatedUnion(type);
        }
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
        if (type.type.kind === 'model' && type.type.isGeneratedName) {
          // if the nullable type's target type is a synthesized
          // type, we need to propagate the docs to it
          type.type.doc = type.doc;
        }
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
      case 'union': {
        if (!type.discriminatedOptions) {
          throw new AdapterError('UnsupportedTsp', 'non-discriminated unions are not supported', type.__raw?.node);
        }
        return this.getDiscriminatedUnion(type);
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
    if (parent && !hasClientNameDecorator(client.decorators)) {
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
      rustClient.constructable.suppressed = this.options['omit-constructors'];
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
        OAuth2 = 2, // explicit OAuth2
        WithAuth = 4, // explicit, unsupported credential
      }

      let authType = AuthTypes.Default;

      /**
       * processes a credential, potentially adding its supporting client constructor
       *
       * @param rustClient the client for which the constructor will be added
       * @param param the tsp parameter that contains cred
       * @param cred the credential type to process
       * @param constructable the constructable for the current Rust client
       * @returns the AuthTypes enum for the credential that was handled, or AuthTypes.Default if none were
       */
      const processCredential = (rustClient: rust.Client, param: tcgc.SdkCredentialParameter, cred: http.HttpAuth, constructable: rust.ClientConstruction): AuthTypes => {
        switch (cred.type) {
          case 'noAuth':
            return AuthTypes.NoAuth;
          case 'oauth2': {
            if ((authType & AuthTypes.OAuth2) === 0) {
              // tsp can describe multiple oauth2 credential flow in a union.
              // since each flow is implicitly handled via the credential, we
              // only need to emit one ctor for the oauth2 type.
              constructable.constructors.push(this.createTokenCredentialCtor(rustClient, cred));
            }
            return AuthTypes.OAuth2;
          }
          default:
            this.ctx.program.reportDiagnostic({
              code: 'UnsupportedAuthenticationScheme',
              severity: 'warning',
              message: `authentication scheme ${cred.type} is not supported`,
              target: param.__raw?.node ?? tsp.NoTarget,
            });
            return AuthTypes.WithAuth;
        }
      };

      const ctorParams = new Array<rust.ClientParameter>();
      for (const param of client.clientInitialization.parameters) {
        switch (param.kind) {
          case 'credential':
            switch (param.type.kind) {
              case 'credential':
                authType |= processCredential(rustClient, param, param.type.scheme, rustClient.constructable);
                break;
              case 'union': {
                for (const variantType of param.type.variantTypes) {
                  // if OAuth2 is specified then emit that and skip any unsupported ones.
                  // this prevents emitting the with_no_credential constructor in cases
                  // where it might not actually be supported.
                  authType |= processCredential(rustClient, param, variantType.scheme, rustClient.constructable);
                }
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
                // we default to "endpoint" and will use the defined name IFF
                // it has the @clientName decorator applied
                const endpointName = hasClientNameDecorator(templateArg.decorators) ? snakeCaseName(templateArg.name) : 'endpoint';
                const adaptedParam = new rust.ClientEndpointParameter(endpointName);
                adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
                ctorParams.push(adaptedParam);
                const endpointField = new rust.StructField(endpointName, 'pubCrate', new rust.Url(this.crate));
                rustClient.endpoint = endpointField;
                rustClient.fields.push(endpointField);

                // if the server's URL is *only* the endpoint parameter then we're done.
                // this is the param.type.kind === 'endpoint' case.
                if (endpointType.serverUrl === `{${templateArg.serializedName}}`) {
                  break;
                }

                // there's either a suffix on the endpoint param, more template arguments, or both.
                // either way we need to create supplemental info on the constructable.
                // NOTE: we remove the {endpoint} segment and trailing forward slash as we use
                // UrlExt::append_path() to concatenate the two and not string replacement.
                const serverUrl = endpointType.serverUrl.replace(`{${templateArg.serializedName}}/`, '');

                rustClient.constructable.endpoint = new rust.SupplementalEndpoint(serverUrl);
                continue;
              }

              const clientParam = this.adaptClientParameter(templateArg, rustClient.constructable);
              if (clientParam.kind !== 'clientSupplementalEndpoint') {
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
      rustClient.endpoint = parent.endpoint;
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
          target: method.__raw?.node ?? tsp.NoTarget,
        });
        continue;
      }
      this.adaptMethod(method, rustClient);
    }

    // Set the tracing namespace for tracing based on the client's namespace
    rustClient.languageIndependentName = client.crossLanguageDefinitionId;

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
    const tokenCredParam = new rust.ClientCredentialParameter('credential', new rust.Arc(new rust.TokenCredential(this.crate, scopes)));
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
      if (!param.clientDefaultValue) {
        paramType = this.getOptionType(this.typeToWireType(paramType));
      }
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
        adaptedParam = new rust.ClientSupplementalEndpointParameter(paramName, paramType, optional, param.serializedName);
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
      if (chunks[0] === 'get') {
        chunks[0] = 'list';
      } else {
        chunks.unshift('list');
      }
      srcMethodName = codegen.camelCase(chunks);
      this.ctx.program.reportDiagnostic({
        code: 'PagingMethodRename',
        severity: 'warning',
        message: `renamed paging method from ${method.name} to ${srcMethodName}`,
        target: method.__raw?.node ?? tsp.NoTarget,
      });
    }

    const languageIndependentName = method.crossLanguageDefinitionId;
    const methodName = naming.getEscapedReservedName(snakeCaseName(srcMethodName), 'fn');
    if (srcMethodName !== method.name) {
      // if the method was renamed then ensure it doesn't collide
      for (const existingMethod of rustClient.methods) {
        if (existingMethod.name === methodName) {
          throw new AdapterError('NameCollision', `renamed method ${srcMethodName} collides with an existing method`, method.__raw?.node);
        }
      }
    }
    const optionsLifetime = new rust.Lifetime('a');
    const methodOptionsStruct = new rust.Struct(`${rustClient.name}${codegen.pascalCase(srcMethodName, false)}Options`, 'pub');
    methodOptionsStruct.lifetime = optionsLifetime;
    methodOptionsStruct.docs.summary = `Options to be passed to ${this.asDocLink(`${rustClient.name}::${methodName}()`, `crate::generated::clients::${rustClient.name}::${methodName}()`)}`;

    let clientMethodOptions: rust.ClientMethodOptions | rust.PagerOptions | rust.PollerOptions;
    switch (method.kind) {
      case 'paging':
        // default to nextLink. will update it as required when we have that info
        clientMethodOptions = new rust.PagerOptions(this.crate, optionsLifetime, 'nextLink');
        break;
      case 'lro':
        clientMethodOptions = new rust.PollerOptions(this.crate, optionsLifetime);
        break;
      default:
        clientMethodOptions = new rust.ClientMethodOptions(this.crate, optionsLifetime);
    }

    const methodOptionsField = new rust.StructField('method_options', 'pub', clientMethodOptions);
    methodOptionsField.docs.summary = 'Allows customization of the method call.';
    methodOptionsStruct.fields.push(methodOptionsField);


    const pub: rust.Visibility = adaptAccessFlags(method.access);
    const methodOptions = new rust.MethodOptions(methodOptionsStruct);
    const httpMethod = method.operation.verb;

    let rustMethod: MethodType;
    switch (method.kind) {
      case 'basic':
        rustMethod = new rust.AsyncMethod(methodName, languageIndependentName, rustClient, pub, methodOptions, httpMethod, method.operation.path);
        break;
      case 'paging':
        rustMethod = new rust.PageableMethod(methodName, languageIndependentName, rustClient, pub, methodOptions, httpMethod, method.operation.path);
        break;
      case 'lro': {
        let lroFinalResultStrategy: rust.LroFinalResultStrategyKind = new rust.LroFinalResultStrategyOriginalUri();
        if (method.lroMetadata.finalStateVia !== FinalStateValue.originalUri) {
          switch (method.lroMetadata.finalStateVia) {
            case FinalStateValue.operationLocation:
              lroFinalResultStrategy = new rust.LroFinalResultStrategyHeader('operation-location');
              break;
            case FinalStateValue.location:
              lroFinalResultStrategy = new rust.LroFinalResultStrategyHeader('location');
              break;
            case FinalStateValue.azureAsyncOperation:
              lroFinalResultStrategy = new rust.LroFinalResultStrategyHeader('azure-asyncoperation');
              break;
            case FinalStateValue.customOperationReference:
              // Some existing API specs are not correctly defined so that they are parsed
              // into `custom-operation-reference` which should be `operation-location`.
              // https://github.com/microsoft/typespec/blob/f3d792b252c6f40be0e174496d9f34d453676026/packages/http-client-csharp/emitter/src/type/operation-final-state-via.ts#L23-L27
              lroFinalResultStrategy = new rust.LroFinalResultStrategyHeader('operation-location');
              break;
            default:
              throw new AdapterError('UnsupportedTsp', `lroMetadata.finalStateVia ${method.lroMetadata.finalStateVia} NYI`, method.__raw?.node);
          }

          lroFinalResultStrategy.propertyName = method.lroMetadata.finalResultPath;
        }
        rustMethod = new rust.LroMethod( methodName, languageIndependentName, rustClient, pub, methodOptions, httpMethod, method.operation.path, lroFinalResultStrategy);
      }
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
    const paramsMap = new Map<tcgc.SdkMethodParameter, rust.HeaderScalarParameter | QueryParamType>();

    for (const param of method.parameters) {
      // we need to translate from the method param to its underlying operation param.
      // most params have a one-to-one mapping. however, for spread params, there will
      // be a many-to-one mapping. i.e. multiple params will map to the same underlying
      // operation param. each param corresponds to a field within the operation param.
      const opParam = values(allOpParams).where((opParam: tcgc.SdkHttpParameter) => {
        return values(opParam.methodParameterSegments.map((segment) => segment[segment.length - 1]))
          .where((methodParam: tcgc.SdkMethodParameter | tcgc.SdkModelPropertyType) => {
            return methodParam.name === param.name;
          }).any();
      }).first();

      if (!opParam) {
        throw new AdapterError('InternalError', `didn't find operation parameter for method ${method.name} parameter ${param.name}`, param.__raw?.node);
      }

      if (opParam.kind === 'header' && opParam.serializedName.toLowerCase() === 'x-ms-client-request-id') {
        // x-ms-client-request-id is automatically inserted into requests via
        // a pipeline policy. so we don't want to expose this as an actual param.
        continue;
      }

      let adaptedParam: rust.MethodParameter;
      // for spread params there are two cases we need to consider.
      // if the method param's type doesn't match the op param's type then it's a spread param
      // - e.g. method param's type is string/int/etc which is a field in the op param's body type
      // if the method param's type DOES match the op param's type and the op param has multiple corresponding method params, it's a spread param
      // - e.g. op param is an intersection of multiple model types, and each model type is exposed as a discrete param
      if (opParam.kind === 'body' && opParam.type.kind === 'model'
        && (opParam.type.kind !== param.type.kind || opParam.methodParameterSegments.map((segment) => segment[segment.length - 1]).length > 1)
      ) {
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

    const getStatusCodes = function (httpOp: tcgc.SdkHttpOperation): Array<number> {
      const statusCodes = new Array<number>();
      for (const response of httpOp.responses) {
        const statusCode = response.statusCodes;
        if (isHttpStatusCodeRange(statusCode)) {
          for (let code = statusCode.start; code <= statusCode.end; ++code) {
            statusCodes.push(code);
          }
        } else {
          statusCodes.push(statusCode);
        }
      }
      return statusCodes;
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
          if (field.kind === 'additionalProperties') {
            continue;
          }
          if (field.serde === serde) {
            // check if this has already been unwrapped (e.g. type is shared across operations)
            if (field.type.kind === 'option') {
              field.type = <rust.WireType>(field.type).type;
              field.flags |= rust.ModelFieldFlags.PageItems;
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

      this.crate.addDependency(new rust.CrateDependency('async-trait'));
      // default to nextLink. will update it as required when we have that info
      rustMethod.returns = new rust.Result(this.crate, new rust.Pager(this.crate, new rust.Response(this.crate, synthesizedModel, responseFormat), 'nextLink'));
    } else if (method.kind === 'lro') {
      const format = responseFormat === 'NoFormat' ? 'JsonFormat' : responseFormat

      const statusType = this.typeToWireType(
        this.getModel(method.lroMetadata.pollingInfo.responseModel, undefined, `${rustClient.name}${codegen.pascalCase(rustMethod.name, false)}OperationStatus`));

      if (statusType.kind !== 'model') {
        throw new AdapterError('InternalError', `status type for an LRO method '${method.name}' is not a model`, method.__raw?.node);
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

      pushModels(statusType, this.crate);

      const poller = new rust.Poller(this.crate, new rust.Response(this.crate, statusType, format));
      if (method.response.type?.kind === "model") {
        const responseType = this.typeToWireType(this.getModel(method.response.type));
        if (responseType.kind !== 'model') {
          throw new AdapterError('InternalError', `response type for an LRO method '${method.name}' is not a model`, method.__raw?.node);
        }
        pushModels(responseType, this.crate);
        poller.resultType = new rust.Response(this.crate, responseType, format);
      }

      rustMethod.returns = new rust.Result(this.crate, poller);
    } else if (method.response.type && !(method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes')) {
      const response = new rust.Response(this.crate, this.typeToWireType(this.getType(method.response.type)), responseFormat);
      rustMethod.returns = new rust.Result(this.crate, response);
    } else if (responseHeaders.length > 0) {
      // for methods that don't return a modeled type but return headers,
      // we need to return a marker type
      const markerType = new rust.MarkerType(`${rustClient.name}${codegen.pascalCase(method.name, false)}Result`, rustMethod.visibility);
      markerType.docs.summary = `Contains results for ${this.asDocLink(`${rustClient.name}::${methodName}()`, `crate::generated::clients::${rustClient.name}::${methodName}()`)}`;
      this.crate.models.push(markerType);
      let resultType: rust.ResultTypes;
      if (method.response.type && method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes') {
        // method returns a streaming binary response with headers
        resultType = new rust.AsyncResponse(this.crate, markerType);
      } else {
        resultType = new rust.Response(this.crate, markerType, responseFormat);
      }
      rustMethod.returns = new rust.Result(this.crate, resultType);
    } else if (method.response.type && method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes') {
      // bytes encoding indicates a streaming binary response
      rustMethod.returns = new rust.Result(this.crate, new rust.AsyncResponse(this.crate, this.getUnitType()));
    } else {
      rustMethod.returns = new rust.Result(this.crate, new rust.Response(this.crate, this.getUnitType(), responseFormat));
    }

    // Mark the set of success status codes expected from this method.
    rustMethod.statusCodes = getStatusCodes(method.operation);

    // For long running operations, we add 200 OK if not already present for the LRO polling and terminal states.
    if (method.kind === 'lro') {
      if (!rustMethod.statusCodes.includes(200)) {
        rustMethod.statusCodes.push(200);
      }
    }
    rustMethod.statusCodes.sort((a, b) => a - b);

    const responseHeadersMap = this.adaptResponseHeaders(responseHeaders);
    rustMethod.responseHeaders = this.adaptResponseHeadersTrait(rustClient, rustMethod, Array.from(responseHeadersMap.values()));

    if (method.kind === 'paging') {
      // can't do this until the method has been completely adapted
      const pageableMethod = <rust.PageableMethod>rustMethod;
      pageableMethod.strategy = this.adaptPageableMethodStrategy(method, paramsMap, responseHeadersMap);
      if (pageableMethod.strategy?.kind === 'nextLink') {
        pageableMethod.strategy.reinjectedParams = this.adaptPageableMethodReinjectionParams(method, paramsMap);
      } else if (pageableMethod.strategy?.kind === 'continuationToken') {
        // set the continuation type to token on the Pager and the PagerOptions field in the method options
        pageableMethod.returns.type.continuation = 'token';
        for (const field of pageableMethod.options.type.fields) {
          if (field.type.kind === 'pagerOptions') {
            field.type.continuation = 'token';
          }
        }
      }
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
      const lowerCasedHeader = header.serializedName.toLowerCase();
      if (header.type.kind === 'dict') {
        if (header.serializedName !== 'x-ms-meta' && header.serializedName !== 'x-ms-or') {
          throw new AdapterError('InternalError', `unexpected response header collection ${header.serializedName}`, header.__raw.node);
        }
        responseHeader = new rust.ResponseHeaderHashMap(snakeCaseName(header.name), lowerCasedHeader);
      } else {
        responseHeader = new rust.ResponseHeaderScalar(snakeCaseName(header.name), fixETagName(lowerCasedHeader), this.typeToWireType(this.getType(header.type)));
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

    const throwOnUnitType = function(type: rust.ResponseTypes): void {
      if (type.kind === 'unit') {
        // this is to filter out unit from ResponseTypes.
        // methods that return unit should have been skipped by our caller
        // so we should never hit this (if we do, we have a bug elsewhere).
        throw new AdapterError('InternalError', `unexpected trait impl kind ${type.kind}`);
      }
    };

    // response header traits are only ever for marker types and payloads
    let implFor: rust.AsyncResponse<rust.MarkerType> | rust.Response<rust.MarkerType | rust.WireType>;
    switch (method.returns.type.kind) {
      case 'pager':
      case 'poller':
        implFor = method.returns.type.type;
        break;
      case 'response':
        throwOnUnitType(method.returns.type.content);
        implFor = <rust.Response<rust.MarkerType | rust.WireType>>method.returns.type;
        break;
      case 'asyncResponse':
        throwOnUnitType(method.returns.type.type);
        implFor = <rust.AsyncResponse<rust.MarkerType>>method.returns.type;
        break;
    }

    const traitName = `${recursiveTypeName(implFor.kind === 'asyncResponse' ? implFor.type : implFor.content)}Headers`;

    // NOTE: the complete doc text will be emitted at codegen time
    const docs = this.asDocLink(`${client.name}::${method.name}()`, `crate::generated::clients::${client.name}::${method.name}()`);
    const responseHeadersTrait = new rust.ResponseHeadersTrait(traitName, implFor, docs, method.visibility);
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
  private adaptPageableMethodStrategy(method: tcgc.SdkPagingServiceMethod<tcgc.SdkHttpOperation>, paramsMap: Map<tcgc.SdkMethodParameter, rust.HeaderScalarParameter | QueryParamType>, respHeadersMap: Map<tcgc.SdkServiceResponseHeader, rust.ResponseHeader>): rust.PageableStrategyKind | undefined {
    const buildNextLinkPath = (segments: Array<tcgc.SdkServiceResponseHeader | tcgc.SdkModelPropertyType>): Array<rust.ModelField> => {
      // build the field path for the next link segments
      const nextLinkPath = new Array<rust.ModelField>();
      for (const segment of segments) {
        if (segment.kind !== 'property') {
          throw new AdapterError('InternalError', `unexpected kind ${segment.kind} for next link segment in operation ${method.name}`, method.__raw?.node);
        }

        const nextLinkField = this.fieldsMap.get(segment);
        if (!nextLinkField) {
          // the most likely explanation for this is lack of reference equality
          throw new AdapterError('InternalError', `missing next link field name ${segment.name} for operation ${method.name}`, method.__raw?.node);
        }
        nextLinkPath.push(nextLinkField);
      }
      return nextLinkPath;
    };

    if (method.pagingMetadata.nextLinkOperation) {
      // TODO: https://github.com/Azure/autorest.rust/issues/103
      throw new AdapterError('UnsupportedTsp', 'next page operation NYI', method.__raw?.node);
    } else if (method.pagingMetadata.nextLinkSegments) {
      return new rust.PageableStrategyNextLink(buildNextLinkPath(method.pagingMetadata.nextLinkSegments));
    } else if (method.pagingMetadata.continuationTokenParameterSegments && method.pagingMetadata.continuationTokenResponseSegments) {
      const tokenReq = method.pagingMetadata.continuationTokenParameterSegments[0];
      const tokenResp = method.pagingMetadata.continuationTokenResponseSegments[0];

      // find the continuation token parameter
      let requestToken: rust.HeaderScalarParameter | rust.QueryScalarParameter;
      switch (tokenReq.kind) {
        case 'method': {
          const tokenParam = paramsMap.get(tokenReq);
          if (!tokenParam) {
            throw new AdapterError('InternalError', `missing continuation token request parameter name ${tokenResp.name} for operation ${method.name}`, method.__raw?.node);
          } else if (tokenParam.kind !== 'headerScalar' && tokenParam.kind !== 'queryScalar') {
            throw new AdapterError('InternalError', `unexpected continuation token request parameter kind ${tokenParam.kind} for operation ${method.name}`, method.__raw?.node);
          }
          requestToken = tokenParam;
          break;
        }
        default:
          throw new AdapterError('InternalError', `unhandled continuationTokenParameterSegment kind ${tokenReq.kind}`, tokenReq.__raw?.node);
      }

      // find the continuation token response
      let responseToken: rust.ResponseHeaderScalar | rust.PageableStrategyNextLink;
      switch (tokenResp.kind) {
        case 'property': {
          responseToken = new rust.PageableStrategyNextLink(buildNextLinkPath(method.pagingMetadata.continuationTokenResponseSegments));
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
      // operation is pageable but doesn't yet support fetching subsequent pages
      return undefined;
    }
  }

  /**
   * returns the array of pageable method parameters for reinjection.
   * if no parameters require reinjection, the array is empty.
   * 
   * @param method the pageable method
   * @param paramsMap maps tcgc method params to Rust params
   * @returns an array containing the method parameters for reinjection
   */
  private adaptPageableMethodReinjectionParams(method: tcgc.SdkPagingServiceMethod<tcgc.SdkHttpOperation>, paramsMap: Map<tcgc.SdkMethodParameter, rust.HeaderScalarParameter | QueryParamType>): Array<QueryParamType> {
    if (!method.pagingMetadata.nextLinkReInjectedParametersSegments) {
      return [];
    }

    const paramsForReinjection = new Array<rust.QueryCollectionParameter | rust.QueryHashMapParameter | rust.QueryScalarParameter>();
    for (const reinjectedParamSegment of method.pagingMetadata.nextLinkReInjectedParametersSegments) {
      for (const reinjectedParam of reinjectedParamSegment) {
        if (reinjectedParam.kind !== 'method') {
          throw new Error('unexpected param kind');
        }
        const rustParam = paramsMap.get(reinjectedParam);
        if (!rustParam) {
          throw new AdapterError('InternalError', `missing reinjection parameter name ${reinjectedParam.name} for operation ${method.name}`, method.__raw?.node);
        } else if (rustParam.kind === 'headerScalar') {
          // we only care about the query params here.
          // any header parameters are handled elsewhere.
          continue;
        }
        paramsForReinjection.push(rustParam);
      }
    }

    return paramsForReinjection;
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
      const correspondingMethodParams = param.methodParameterSegments.map((segment) => segment[segment.length - 1]);
      if (param.onClient && correspondingMethodParams.length === 1) {
        // we get here if the param was aliased via the @paramAlias decorator.
        // this gives us the name of the client param's backing field which has
        // the aliased name.
        return correspondingMethodParams[0].name;
      }
      return param.name;
    };

    const paramName = naming.getEscapedReservedName(snakeCaseName(getCorrespondingClientParamName(param)), 'param', reservedParams);
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
          if (paramType.kind !== 'hashmap' && !isRefHashMap(paramType)) {
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
        } else if (paramType.kind === 'hashmap' || isRefHashMap(paramType)) {
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
        } else if (paramType.kind === 'hashmap' || isRefHashMap(paramType)) {
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
      case 'decimal':
      case 'Etag':
      case 'hashmap':
      case 'jsonValue':
      case 'offsetDateTime':
      case 'safeint':
      case 'Url':
        // these types all require conversion
        // to String so we don't need to own them
        return this.getRefType(type);
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
      case 'discriminatedUnion':
      case 'encodedBytes':
      case 'enum':
      case 'enumValue':
      case 'Etag':
      case 'external':
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
    } else if (contentType.match(/text\/plain/i)) {
      return 'text';
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

/** type guard to determine if type is a Ref<HashMap> */
function isRefHashMap(type: rust.Type): type is rust.Ref<rust.HashMap> {
  return shared.asTypeOf<rust.Ref<rust.HashMap>>(type, 'hashmap', 'ref') !== undefined;
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
    case 'discriminatedUnion':
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

/**
 * returns true if decorators contains `@clientName`
 * 
 * @param decorators the array of decorators to inspect
 * @returns true if `@clientName` is found in decorators
 */
function hasClientNameDecorator(decorators: Array<tcgc.DecoratorInfo>): boolean {
  return decorators.find((decorator) => decorator.name === 'Azure.ClientGenerator.Core.@clientName') !== undefined;
}

/**
 * narrows statusCode to a HttpStatusCodeRange within the conditional block
 * 
 * @param statusCode the type to test
 * @returns statusCode as a HttpStatusCodeRange or false
 */
function isHttpStatusCodeRange(statusCode: http.HttpStatusCodeRange | number): statusCode is http.HttpStatusCodeRange {
  return (<http.HttpStatusCodeRange>statusCode).start !== undefined;
}

/**
 * converts tcgc's access flags (which aren't really flags) to visibility
 * @param access the access flag to convert
 * @returns the flag converted to visibility
 */
function adaptAccessFlags(access: tcgc.AccessFlags): rust.Visibility {
  return access === 'public' ? 'pub' : 'pubCrate';
}

type QueryParamType = rust.QueryCollectionParameter | rust.QueryHashMapParameter | rust.QueryScalarParameter;

/** contains reserved param names */
const reservedParams = new Set<string>(
  [
    // reserved per SDK guidelines
    'options',
  ]
);
