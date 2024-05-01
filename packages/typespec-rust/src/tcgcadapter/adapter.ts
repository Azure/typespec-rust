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
    return this.crate;
  }

  // converts all tcgc types to their Rust type equivalent
  private adaptTypes() {
    for (const model of this.ctx.experimental_sdkPackage.models) {
      const struct = this.getStruct(model);
      this.crate.structs.push(struct);

      for (const property of model.properties) {
        const structField = this.getStructField(property);
        struct.fields.push(structField);
      }
    }
  }

  // converts a tcgc model to a Rust struct
  private getStruct(model: tcgc.SdkModelType): rust.Struct {
    if (model.name.length === 0) {
      throw new Error('unnamed model'); // TODO: this might no longer be an issue
    }
    const structName = codegen.capitalize(model.name);
    let struct = this.types.get(structName);
    if (struct) {
      return <rust.Struct>struct;
    }
    struct = new rust.Struct(structName, model.access !== 'internal');
    struct.docs = model.description;
    this.types.set(structName, struct);
    return struct;
  }

  // converts a tcgc model property to a struct field
  private getStructField(property: tcgc.SdkModelPropertyType): rust.StructField {
    const fieldType = this.getType(property.type);
    // snake-case the field name
    const parts = codegen.deconstruct(property.name);
    const structField = new rust.StructField(parts.join('_'), true, fieldType);
    structField.docs = property.description;
    return structField;
  }

  // converts a tcgc type to a Rust type
  private getType(type: tcgc.SdkType): rust.Type {
    const getScalarType = (kind: 'boolean' | 'float32' | 'float64' | 'int16' | 'int32' | 'int64' | 'int8'): rust.ScalarType => {
      let scalarType = this.types.get(kind);
      if (scalarType) {
        return <rust.ScalarType>scalarType;
      }
      scalarType = new rust.ScalarType('bool');
      this.types.set(kind, scalarType);
      return scalarType;
    };

    switch (type.kind) {
      case 'boolean':
      case 'float32':
      case 'float64':
      case 'int16':
      case 'int32':
      case 'int64':
      case 'int8':
        return getScalarType(type.kind);
      case 'model':
        return this.getStruct(type);
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
