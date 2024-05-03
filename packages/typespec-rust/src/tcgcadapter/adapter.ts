/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { EmitContext } from '@typespec/compiler';
import { RustEmitterOptions } from '../lib.js';
import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as rust from '../codemodel/index.js';

// Adapter converts the tcgc code model to a Rust Crate
export class Adapter {
  private readonly crate: rust.Crate;
  private readonly ctx: tcgc.SdkContext;

  // cache of adapted types
  private readonly types: Map<string, rust.Type>;

  constructor(context: EmitContext<RustEmitterOptions>) {
    this.types = new Map<string, rust.Type>();
    this.ctx = tcgc.createSdkContext(context);

    let serviceType: rust.ServiceType = 'data-plane';
    if (this.ctx.arm === true) {
      serviceType = 'azure-arm';
    }

    this.crate = new rust.Crate(context.options['crate-name'], context.options['crate-version'], serviceType);
  }

  // performs all the steps to convert tcgc to a crate
  tcgcToCrate(): rust.Crate {
    this.adaptTypes();
    this.crate.sortContent();

    if (this.crate.enums.length > 0 || this.crate.models.length > 0) {
      this.crate.dependencies.push(new rust.CrateDependency('serde'));
    }
    return this.crate;
  }

  // converts all tcgc types to their Rust type equivalent
  private adaptTypes() {
    for (const sdkEnum of this.ctx.experimental_sdkPackage.enums) {
      const rustEnum = this.getEnum(sdkEnum);
      this.crate.enums.push(rustEnum);
    }

    for (const model of this.ctx.experimental_sdkPackage.models) {
      const rustModel = this.getModel(model);
      this.crate.models.push(rustModel);
    }
  }

  // converts a tcgc enum to a Rust enum
  private getEnum(sdkEnum: tcgc.SdkEnumType): rust.Enum {
    const enumName = codegen.capitalize(sdkEnum.name);
    let rustEnum = this.types.get(enumName);
    if (rustEnum) {
      return <rust.Enum>rustEnum;
    }

    // first create all of the enum values
    const values = new Array<rust.EnumValue>();
    for (const value of sdkEnum.values) {
      const rustEnumValue = new rust.EnumValue(codegen.capitalize(value.name), value.value);
      values.push(rustEnumValue);
    }

    rustEnum = new rust.Enum(enumName, isPub(sdkEnum.access), values, !sdkEnum.isFixed);
    this.types.set(enumName, rustEnum);

    return rustEnum;
  }

  // converts a tcgc model to a Rust model
  private getModel(model: tcgc.SdkModelType): rust.Model {
    if (model.name.length === 0) {
      throw new Error('unnamed model'); // TODO: this might no longer be an issue
    }
    const modelName = codegen.capitalize(model.name);
    let rustModel = this.types.get(modelName);
    if (rustModel) {
      return <rust.Model>rustModel;
    }
    rustModel = new rust.Model(modelName, isPub(model.access));
    rustModel.docs = model.description;
    this.types.set(modelName, rustModel);

    for (const property of model.properties) {
      const structField = this.getModelField(property);
      rustModel.fields.push(structField);
    }

    return rustModel;
  }

  // converts a tcgc model property to a model field
  private getModelField(property: tcgc.SdkModelPropertyType): rust.ModelField {
    const fieldType = this.getType(property.type);
    // snake-case the field name
    const parts = codegen.deconstruct(property.name);
    const modelField = new rust.ModelField(parts.join('_'), property.name, true, fieldType);
    modelField.docs = property.description;
    return modelField;
  }

  // converts a tcgc type to a Rust type
  private getType(type: tcgc.SdkType): rust.Type {
    const getScalar = (kind: 'boolean' | 'float32' | 'float64' | 'int16' | 'int32' | 'int64' | 'int8'): rust.Scalar => {
      let scalar = this.types.get(kind);
      if (scalar) {
        return <rust.Scalar>scalar;
      }
      let scalarKind: rust.ScalarKind;
      switch (kind) {
        case 'boolean':
          scalarKind = 'bool';
          break;
        case 'float32':
          scalarKind = 'f32';
          break;
        case 'float64':
          scalarKind = 'f64';
          break;
        case 'int16':
          scalarKind = 'i16';
          break;
        case 'int32':
          scalarKind = 'i32';
          break;
        case 'int64':
          scalarKind = 'i64';
          break;
        case 'int8':
          scalarKind = 'i8';
          break;
      }
      scalar = new rust.Scalar(scalarKind);
      this.types.set(kind, scalar);
      return scalar;
    };

    switch (type.kind) {
      case 'boolean':
      case 'float32':
      case 'float64':
      case 'int16':
      case 'int32':
      case 'int64':
      case 'int8':
        return getScalar(type.kind);
      case 'enum':
        return this.getEnum(type);
      case 'model':
        return this.getModel(type);
      case 'string': {
        let stringType = this.types.get(type.kind);
        if (stringType) {
          return stringType;
        }
        stringType = new rust.StringType();
        this.types.set(type.kind, stringType);
        return stringType;
      }
      default:
        throw new Error(`unhandled tcgc type ${type.kind}`);
    }
  }
}

function isPub(access?: tcgc.AccessFlags): boolean {
  return access !== 'internal';
}
