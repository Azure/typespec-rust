/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// Type defines a type within the Rust type system
export type Type = Enum | Model | ScalarType | StringType | Struct;

// Enum is a Rust enum type.
export interface Enum {
  kind: 'enum';

  // the name of the enum type
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // indicates if the enum and its values should be public
  pub: boolean;

  // one or more values for the enum
  values: Array<EnumValue>;

  // indicates if the enum is extensible or not
  extensible: boolean;
}

// EnumValue is an enum value for a specific Enum<T>
export interface EnumValue {
  // the name of the enum value
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // the value used in SerDe operations
  value: number | string;
}

// Model is a Rust struct that participates in serde
export interface Model extends StructBase {
  kind: 'model';

  // fields contains the fields within the struct
  fields: Array<ModelField>;
}

// ModelField is a field definition within a model
export interface ModelField extends StructFieldBase {
  // the name of the field over the wire
  serde: string;
}

// ScalarTypeKind defines the supported Rust scalar type names
export type ScalarTypeKind = 'bool' | 'f32' | 'f64' | 'i8' | 'i16' | 'i32' | 'i64';

// ScalarType is a Rust scalar type
export interface ScalarType {
  kind: ScalarTypeKind;
}

// StringType is a Rust string
export interface StringType {
  kind: 'String';
}

// Struct is a Rust struct type definition
export interface Struct extends StructBase {
  kind: 'struct';

  // fields contains the fields within the struct
  fields: Array<StructField>;
}

// StructField is a field definition within a struct
export interface StructField {
  // the name of the field
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // indicates if the field should be public
  pub: boolean;

  // the field's underlying type
  type: Type;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// base type for models and structs
interface StructBase {
  kind: 'model' | 'struct';

  // the name of the struct
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // indicates if the struct should be public
  pub: boolean;

  // fields contains the fields within the struct
  fields: Array<StructFieldBase>;
}

// base type for model and struct fields
interface StructFieldBase {
  // the name of the field
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // indicates if the field should be public
  pub: boolean;

  // the field's underlying type
  type: Type;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Enum implements Enum {
  constructor(name: string, pub: boolean, values: Array<EnumValue>, extensible: boolean) {
    this.kind = 'enum';
    this.name = name;
    this.pub = pub;
    this.values = values;
    this.extensible = extensible;
  }
}

export class EnumValue implements EnumValue {
  constructor(name: string, value: number | string) {
    this.name = name;
    this.value = value;
  }
}

export class Model implements Model {
  constructor(name: string, pub: boolean) {
    this.kind = 'model';
    this.name = name;
    this.pub = pub;
    this.fields = new Array<ModelField>();
  }
}

export class ModelField implements ModelField {
  constructor(name: string, serde: string, pub: boolean, type: Type) {
    this.name = name;
    this.serde = serde;
    this.pub = pub;
    this.type = type;
  }
}

export class ScalarType implements ScalarType {
  constructor(kind: ScalarTypeKind) {
    this.kind = kind;
  }
}

export class StringType implements StringType {
  constructor() {
    this.kind = 'String';
  }
}

export class Struct implements Struct {
  constructor(name: string, pub: boolean) {
    this.kind = 'struct';
    this.name = name;
    this.pub = pub;
    this.fields = new Array<StructField>();
  }
}

export class StructField implements StructField {
  constructor(name: string, pub: boolean, type: Type) {
    this.name = name;
    this.pub = pub;
    this.type = type;
  }
}
