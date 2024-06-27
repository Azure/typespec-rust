/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Crate, CrateDependency } from './crate.js';

// Type defines a type within the Rust type system
export type Type = Enum | Empty | ExternalType | Generic | ImplTrait | JsonValue | Literal | Model | OffsetDateTime | Option | RequestContent | Scalar | StringSlice | StringType | Struct | Vector;

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
export interface ExternalType extends External {
  kind: 'external';
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

// ImplTrait is the Rust syntax for "a concrete type that implements this trait"
export interface ImplTrait {
  kind: 'implTrait';

  // the name of the trait
  name: string;

  // the type on which the trait is implemented
  type: Type;
}

// JsonValue is a raw JSON value
export interface JsonValue extends External {
  kind: 'jsonValue';
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

// DateTimeEncoding is the wire format of the date/time
export type DateTimeEncoding = 'rfc3339' | 'rfc7231' | 'unixTimestamp';

// OffsetDateTime is a Rust time::OffsetDateTime type
export interface OffsetDateTime extends External {
  kind: 'offsetDateTime';

  encoding: DateTimeEncoding;
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
export type RequestContentType = Enum | Model | Scalar | StringType | Vector;

// RequestContent is a Rust RequestContent<T> from azure_core
export interface RequestContent extends External {
  kind: 'requestContent';

  type: RequestContentType;
}

// ScalarType defines the supported Rust scalar type names
export type ScalarType = 'bool' | 'f32' | 'f64' | 'i8' | 'i16' | 'i32' | 'i64';

// Scalar is a Rust scalar type
export interface Scalar {
  kind: 'scalar';

  type: ScalarType;
}

// StringSlice is a Rust string slice
export interface StringSlice {
  kind: 'str';
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

// Vector is a Rust Vec<T>
export interface Vector {
  kind: 'vector';

  // the generic type param
  type: Type;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

// External is a type defined in a different crate
export interface External {
  // the crate that defines the type
  crate: string;

  // the name of the type
  name: string;
}

export class External implements External {
  constructor(crate: Crate, crateName: string, typeName: string) {
    crate.addDependency(new CrateDependency(crateName));
    this.crate = crateName;
    this.name = typeName;
  }
}

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

export class ExternalType extends External implements ExternalType {
  constructor(crate: Crate, crateName: string, typeName: string) {
    super(crate, crateName, typeName);
    this.kind = 'external';
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

export class ImplTrait implements ImplTrait {
  constructor(name: string, type: Type) {
    this.kind = 'implTrait';
    this.name = name;
    this.type = type;
  }
}

export class JsonValue extends External implements JsonValue {
  constructor(crate: Crate) {
    super(crate, 'serde_json', 'Value');
    this.kind = 'jsonValue';
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

export class OffsetDateTime extends External implements OffsetDateTime {
  constructor(crate: Crate, encoding: DateTimeEncoding) {
    super(crate, 'time', 'OffsetDateTime');
    this.kind = 'offsetDateTime';
    this.encoding = encoding;
  }
}

export class Option implements Option {
  constructor(type: OptionType, ref: boolean) {
    this.kind = 'option';
    this.type = type;
    this.ref = ref;
  }
}

export class RequestContent extends External implements RequestContent {
  constructor(crate: Crate, type: RequestContentType) {
    super(crate, 'azure_core', 'RequestContent');
    this.kind = 'requestContent';
    this.type = type;
  }
}

export class Scalar implements Scalar {
  constructor(type: ScalarType) {
    this.kind = 'scalar';
    this.type = type;
  }
}

export class StringSlice implements StringSlice {
  constructor() {
    this.kind = 'str';
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

export class Vector implements Vector {
  constructor(type: Type) {
    this.kind = 'vector';
    this.type = type;
  }
}
