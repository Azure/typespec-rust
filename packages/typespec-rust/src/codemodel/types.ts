/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// Type defines a type within the Rust type system
export type Type = Enum | Empty | ExternalType | Generic | Literal | Model | Option | RequestContent | Scalar | StringType | Struct;

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

// EnumValue is an enum value for a specific Enum
export interface EnumValue {
  // the name of the enum value
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // the value used in SerDe operations
  value: number | string;
}

// Empty is the empty type (i.e. "()")
export interface Empty {
  kind: 'empty';
}

// ExternalType is a type defined in a different crate
export interface ExternalType {
  kind: 'external';

  // the crate that defines the type
  crate: string;

  // the name of the type
  name: string;
}

// Generic is a generic type instantiation, e.g. Foo<i32>
export interface Generic {
  kind: 'generic';

  // the name of the generic type
  name: string;

  // the generic type params in the requisite order
  types: Array<Type>;

  // the use statement required to bring the type into scope
  use?: string;
}

// Literal is a literal value (e.g. a string "foo")
export interface Literal {
  kind: 'literal';

  value: boolean | null | number | string;
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

// OptionType defines the possible generic type params for Option<T>
export type OptionType = Enum | ExternalType | Generic | Model | Scalar | StringType | Struct;

// Option is a Rust Option<T>
export interface Option {
  kind: 'option';

  // the generic type param
  type: OptionType;

  // indicates if the type is by reference
  ref: boolean;
}

// RequestContentType defines the possible generic type params for RequestContent<T>
export type RequestContentType = Enum | Model | Scalar | StringType;

// RequestContent is a Rust RequestContent<T> from azure_core
export interface RequestContent {
  kind: 'requestContet';

  type: RequestContentType;
}

// ScalarKind defines the supported Rust scalar type names
export type ScalarKind = 'bool' | 'f32' | 'f64' | 'i8' | 'i16' | 'i32' | 'i64';

// Scalar is a Rust scalar type
export interface Scalar {
  kind: ScalarKind;
}

// StringType is a Rust string
export interface StringType {
  kind: 'String';
}

// Struct is a Rust struct type definition
export interface Struct extends StructBase {
  kind: 'struct';

  // the provided doc string emitted as code comments
  docs?: string;

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
// base types
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
    if (values.length < 1) {
      throw new Error('must provide at least one enum value');
    }
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

export class Empty implements Empty {
  constructor() {
    this.kind = 'empty';
  }
}

export class ExternalType implements ExternalType {
  constructor(crate: string, name: string) {
    this.kind = 'external';
    this.crate = crate;
    this.name = name;
  }
}

export class Generic implements Generic {
  constructor(name: string, types: Array<Type>, use?: string) {
    this.kind = 'generic';
    this.name = name;
    if (types.length < 1) {
      throw new Error('must provide at least one generic type parameter type');
    }
    this.types = types;
    this.use = use;
  }
}

export class Literal implements Literal {
  constructor(value: boolean | null | number | string) {
    this.kind = 'literal';
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

export class Option implements Option {
  constructor(type: OptionType, ref: boolean) {
    this.kind = 'option';
    this.type = type;
    this.ref = ref;
  }
}

export class RequestContent implements RequestContent {
  constructor(type: RequestContentType) {
    this.kind = 'requestContet';
    this.type = type;
  }
}

export class Scalar implements Scalar {
  constructor(kind: ScalarKind) {
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
