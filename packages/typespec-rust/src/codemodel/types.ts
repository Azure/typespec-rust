/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Crate, CrateDependency } from './crate.js';

/** Docs contains the values used in doc comment generation. */
export interface Docs {
  /** the high level summary */
  summary?: string;

  /** detailed description */
  description?: string;
}

/** Type defines a type within the Rust type system */
export type Type = Arc | Bytes | EncodedBytes | Enum | EnumValue | Etag | ExternalType | HashMap | ImplTrait | JsonValue | Literal | Model | OffsetDateTime | Option | Pager | RequestContent | Response | Result | Scalar | StringSlice | StringType | Struct | TokenCredential | Unit | Url | Vector;

/** Arc is a std::sync::Arc<T> */
export interface Arc extends StdType {
  kind: 'arc';

  /**
   * the generic type param
   * note that not all types are applicable
   */
  type: Type;
}

/** Bytes is a azure_core::Bytes type */
export interface Bytes extends External {
  kind: 'bytes';
}

/** BytesEncoding defines the possible types of base64-encoding. */
export type BytesEncoding = 'std' | 'url';

/** EncodedBytes is a Rust Vec<u8> that's base64-encoded. */
export interface EncodedBytes {
  kind: 'encodedBytes';

  /** indicates what kind of base64-encoding to use */
  encoding: BytesEncoding;
}

/** Enum is a Rust enum type. */
export interface Enum {
  kind: 'enum';

  /** the name of the enum type */
  name: string;

  /** any docs for the type */
  docs: Docs;

  /** indicates if the enum and its values should be public */
  pub: boolean;

  /** one or more values for the enum */
  values: Array<EnumValue>;

  /** indicates if the enum is extensible or not */
  extensible: boolean;
}

/** EnumValue is an enum value for a specific Enum */
export interface EnumValue {
  kind: 'enumValue';

  /** the name of the enum value */
  name: string;

  /** any docs for the value */
  docs: Docs;

  /** the enum to which this value belongs */
  type: Enum;

  /** the value used in SerDe operations */
  value: number | string;
}

/** Etag is an azure_core::Etag */
export interface Etag extends External {
  kind: 'Etag';
}

/** ExternalType is a type defined in a different crate */
export interface ExternalType extends External {
  kind: 'external';

  /** indicates if the type includes a lifetime annotation */
  lifetime?: Lifetime;
}

/**
 * HashMap is a Rust HashMap<K, V>
 * K is always a String
 */
export interface HashMap extends StdType {
  kind: 'hashmap';

  /** the V generic type param */
  type: Type;
}

/** ImplTrait is the Rust syntax for "a concrete type that implements this trait" */
export interface ImplTrait {
  kind: 'implTrait';

  /** the name of the trait */
  name: string;

  /** the type on which the trait is implemented */
  type: Type;
}

/** JsonValue is a raw JSON value */
export interface JsonValue extends External {
  kind: 'jsonValue';
}

/** Lifetime is a Rust lifetime name. */
export interface Lifetime {
  name: string;
}

/** Literal is a literal value (e.g. a string "foo") */
export interface Literal {
  kind: 'literal';

  /** the literal's value */
  value: boolean | null | number | string;
}

/**
 * MarkerType is a special response type for methods
 * that don't return a model but return typed headers
 */
export interface MarkerType {
  kind: 'marker';

  /** the name of the marker type */
  name: string;

  /** any docs for the marker type */
  docs: Docs;
}

/** Model is a Rust struct that participates in serde */
export interface Model extends StructBase {
  kind: 'model';

  /** fields contains the fields within the struct */
  fields: Array<ModelField>;

  /** the flags set for this model */
  flags: ModelFlags;

  /**
   * the name of the type over the wire if it's
   * different from the type's name.
   */
  xmlName?: string;
}

/** ModelField is a field definition within a model */
export interface ModelField extends StructFieldBase {
  /** the name of the field over the wire */
  serde: string;

  /** contains XML-specific serde info */
  xmlKind?: XMLKind;
}

/** ModelFlags contains bit flags describing model usage */
export enum ModelFlags {
  Unspecified = 0,

  /** model is used as input to a method */
  Input = 1,

  /** model is used as output from a method */
  Output = 2,
}

/** DateTimeEncoding is the wire format of the date/time */
export type DateTimeEncoding = 'rfc3339' | 'rfc7231' | 'unix_time';

/** OffsetDateTime is a Rust time::OffsetDateTime type */
export interface OffsetDateTime extends External {
  kind: 'offsetDateTime';

  /** the encoding format */
  encoding: DateTimeEncoding;

  /** indicates that the value is in UTC format */
  utc: boolean;
}

/** Option is a Rust Option<T> */
export interface Option {
  kind: 'option';

  /**
   * the generic type param
   * note that not all types are applicable
   */
  type: Type;
}

/** Pager is a Pager<T> from azure_core */
export interface Pager extends External {
  kind: 'pager';

  /** the model containing the page of items */
  type: Model;

  /** the wire format of the response body. */
  format: BodyFormat;
}

/**
 * Payload<T> is used for operations that send/receive a typed payload.
 * it's a grouping of the payload type and its wire format.
 */
export interface Payload<T extends Type = Type> {
  kind: 'payload';

  /**
   * the generic type param
   * note that not all types are applicable
   */
  type: T;

  /** the wire format of the request body */
  format: BodyFormat;
}

/** RequestContent is a Rust RequestContent<T> from azure_core */
export interface RequestContent<T = Bytes | Payload> extends External {
  kind: 'requestContent';

  /** the type of content sent in the request */
  content: T;
}

/** Response is a Rust Response<T> from azure_core */
export interface Response<T = MarkerType | Payload | ResponseBody | Unit> extends External {
  kind: 'response';

  /** the type of content sent in the response */
  content: T;
}

/**
 * ResponseBody is used for operations that receive a streaming response.
 * it's the default type parameter for Response<T> in azure_core.
 */
export interface ResponseBody {
  kind: 'responseBody';
}

/** Result is a Rust Result<T> from azure_core */
export interface Result<T = Pager | Response | Unit> extends External {
  kind: 'result';

  /** the generic type param */
  type: T;
}

/** ScalarType defines the supported Rust scalar type names */
export type ScalarType = 'bool' | 'f32' | 'f64' | 'i8' | 'i16' | 'i32' | 'i64';

/** Scalar is a Rust scalar type */
export interface Scalar {
  kind: 'scalar';

  /** the type of scalar */
  type: ScalarType;
}

/** BodyFormat indicates the wire format for request and response bodies */
export type BodyFormat = 'json' | 'xml';

/** StringSlice is a Rust string slice */
export interface StringSlice {
  kind: 'str';
}

/** StringType is a Rust string */
export interface StringType {
  kind: 'String';
}

/** Struct is a Rust struct type definition */
export interface Struct extends StructBase {
  kind: 'struct';

  /** fields contains the fields within the struct */
  fields: Array<StructField>;
}

/** StructField is a field definition within a struct */
export interface StructField extends StructFieldBase {
  // no additional fields at present
}

/** TokenCredential is an azure_core::TokenCredential parameter */
export interface TokenCredential extends External {
  kind: 'tokenCredential';

  /** the scopes to include for the credential */
  scopes: Array<string>;
}

/** Unit is the unit type (i.e. "()") */
export interface Unit {
  kind: 'unit';
}

/** Url is an azure_core::Url type */
export interface Url extends External {
  kind: 'Url';
}

/**
 * Vector is a Rust Vec<T>
 * since Vec<T> is in the prelude set, it doesn't need to extend StdType
 */
export interface Vector {
  kind: 'vector';

  /** the generic type param */
  type: Type;
}

/** XMLKind contains info used for generating XML-specific serde */
export type XMLKind = 'attribute' | 'text' | 'unwrappedList';

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

/** External is a type defined in a different crate */
export interface External {
  /** the crate that defines the type */
  crate: string;

  /** the name of the type */
  name: string;

  /** namespace within the crate where the type is defined (e.g. foo, foo::bar) */
  namespace?: string;
}

export class External implements External {
  constructor(crate: Crate, crateName: string, typeName: string, namespace?: string) {
    crate.addDependency(new CrateDependency(crateName));
    this.crate = crateName;
    this.name = typeName;
    this.namespace = namespace;
  }
}

/** StdType is a type in the standard library that's not in the prelude set. */
export interface StdType {
  /** the name of the type */
  name: string;

  /** the using statement to bring it into scope */
  use: string;
}

export class StdType implements StdType {
  constructor(name: string, use: string) {
    this.name = name;
    this.use = use;
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

/** base type for models and structs */
interface StructBase {
  kind: 'model' | 'struct';

  /** the name of the struct */
  name: string;

  /** any docs for the type */
  docs: Docs;

  /** indicates if the struct is only for internal consumption */
  internal: boolean;

  /** fields contains the fields within the struct */
  fields: Array<StructFieldBase>;

  /** indicates if the type includes a lifetime annotation */
  lifetime?: Lifetime;
}

/** base type for model and struct fields */
interface StructFieldBase {
  /** the name of the field */
  name: string;

  /** any docs for the field */
  docs: Docs;

  /** indicates if the field should be public */
  pub: boolean;

  /** the field's underlying type */
  type: Type;

  /** the value to use when emitting a Default impl for the containing struct */
  defaultValue?: string;
}

class StructBase implements StructBase {
  constructor(kind: 'model' | 'struct', name: string, internal: boolean) {
    this.kind = kind;
    this.name = name;
    this.internal = internal;
    this.docs = {};
  }
}

class StructFieldBase implements StructFieldBase {
  constructor(name: string, pub: boolean, type: Type) {
    this.name = name;
    this.pub = pub;
    this.type = type;
    this.docs = {};
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Arc extends StdType implements Arc {
  constructor(type: Type) {
    super('Arc', 'std::sync');
    this.kind = 'arc';
    this.type = type;
  }
}

export class Bytes extends External implements Bytes {
  constructor(crate: Crate) {
    super(crate, 'azure_core', 'Bytes');
    this.kind = 'bytes';
  }
}

export class EncodedBytes implements EncodedBytes {
  constructor(encoding: BytesEncoding) {
    this.kind = 'encodedBytes';
    this.encoding = encoding;
  }
}

export class Enum implements Enum {
  constructor(name: string, pub: boolean, extensible: boolean) {
    this.kind = 'enum';
    this.name = name;
    this.pub = pub;
    this.values = new Array<EnumValue>();
    this.extensible = extensible;
    this.docs = {};
  }
}

export class EnumValue implements EnumValue {
  constructor(name: string, type: Enum, value: number | string) {
    this.kind = 'enumValue';
    this.name = name;
    this.type = type;
    this.value = value;
    this.docs = {};
  }
}

export class Etag extends External implements Etag {
  constructor(crate: Crate) {
    super(crate, 'azure_core', 'Etag');
    this.kind = 'Etag';
  }
}

export class ExternalType extends External implements ExternalType {
  constructor(crate: Crate, crateName: string, typeName: string) {
    super(crate, crateName, typeName);
    this.kind = 'external';
  }
}

export class HashMap extends StdType implements HashMap {
  constructor(type: Type) {
    super('HashMap', 'std::collections');
    this.kind = 'hashmap';
    this.type = type;
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

export class Lifetime implements Lifetime {
  constructor(name: string) {
    this.name = `'${name}`;
  }
}

export class Literal implements Literal {
  constructor(value: boolean | null | number | string) {
    this.kind = 'literal';
    this.value = value;
  }
}

export class MarkerType implements MarkerType {
  constructor(name: string) {
    this.kind = 'marker';
    this.name = name;
    this.docs = {};
  }
}

export class Model extends StructBase implements Model {
  constructor(name: string, internal: boolean, flags: ModelFlags) {
    super('model', name, internal);
    this.fields = new Array<ModelField>();
    this.flags = flags;
  }
}

export class ModelField extends StructFieldBase implements ModelField {
  constructor(name: string, serde: string, pub: boolean, type: Type) {
    super(name, pub, type);
    this.serde = serde;
  }
}

export class OffsetDateTime extends External implements OffsetDateTime {
  constructor(crate: Crate, encoding: DateTimeEncoding, utc: boolean) {
    super(crate, 'time', 'OffsetDateTime');
    this.kind = 'offsetDateTime';
    this.encoding = encoding;
    this.utc = utc;
  }
}

export class Option implements Option {
  constructor(type: Type) {
    switch (type.kind) {
      case 'String':
      case 'encodedBytes':
      case 'enum':
      case 'enumValue':
      case 'Etag':
      case 'external':
      case 'hashmap':
      case 'model':
      case 'offsetDateTime':
      case 'requestContent':
      case 'scalar':
      case 'struct':
      case 'Url':
      case 'vector':
        this.kind = 'option';
        this.type = type;
        break;
      default:
        throw new Error(`unsupported Option generic type param kind ${type.kind}`);
    }
  }
}

export class Pager extends External implements Pager {
  constructor(crate: Crate, type: Model, format: BodyFormat) {
    super(crate, 'azure_core', 'Pager');
    this.kind = 'pager';
    this.type = type;
    this.format = format;
  }
}

export class Payload<T> implements Payload<T> {
  constructor(type: T, format: BodyFormat) {
    switch (type.kind) {
      case 'String':
      case 'encodedBytes':
      case 'enum':
      case 'external':
      case 'hashmap':
      case 'jsonValue':
      case 'model':
      case 'offsetDateTime':
      case 'scalar':
      case 'vector':
        this.kind = 'payload';
        this.type = type;
        this.format = format;
        break;
      default:
        throw new Error(`unsupported Payload generic type param kind ${type.kind}`);
    }
  }
}

export class RequestContent<T> extends External implements RequestContent<T> {
  constructor(crate: Crate, content: T) {
    super(crate, 'azure_core', 'RequestContent');
    this.kind = 'requestContent';
    this.content = content;
  }
}

export class Response<T> extends External implements Response<T> {
  constructor(crate: Crate, content: T) {
    super(crate, 'azure_core', 'Response');
    this.kind = 'response';
    this.content = content;
  }
}

export class ResponseBody implements ResponseBody {
  constructor() {
    this.kind = 'responseBody';
  }
}

export class Result<T> extends External implements Result<T> {
  constructor(crate: Crate, type: T) {
    super(crate, 'azure_core', 'Result');
    this.kind = 'result';
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

export class Struct extends StructBase implements Struct {
  constructor(name: string, internal: boolean) {
    super('struct', name, internal);
    this.fields = new Array<StructField>();
  }
}

export class StructField extends StructFieldBase implements StructField {
  constructor(name: string, pub: boolean, type: Type) {
    super(name, pub, type);
  }
}

export class TokenCredential extends External implements TokenCredential {
  constructor(crate: Crate, scopes: Array<string>) {
    if (scopes.length === 0) {
      throw new Error('scopes must contain at least one entry');
    }
    super(crate, 'azure_core', 'TokenCredential', 'credentials');
    this.kind = 'tokenCredential';
    this.scopes = scopes;
  }
}

export class Unit implements Unit {
  constructor() {
    this.kind = 'unit';
  }
}

export class Url extends External implements Url {
  constructor(crate: Crate) {
    super(crate, 'azure_core', 'Url');
    this.kind = 'Url';
  }
}

export class Vector implements Vector {
  constructor(type: Type) {
    this.kind = 'vector';
    this.type = type;
  }
}
