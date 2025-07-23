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

/** SdkType defines types used in generated code but do not directly participate in serde */
export type SdkType =
  | Arc
  | Box
  | ExternalType
  | ImplTrait
  | MarkerType
  | Option
  | PageIterator
  | Pager
  | RawResponse
  | RequestContent
  | Response
  | Result
  | Struct
  | TokenCredential
  | Unit;

/** WireType defines types that go across the wire */
export type WireType =
  | Bytes
  | Decimal
  | EncodedBytes
  | Enum
  | EnumValue
  | Etag
  | HashMap
  | JsonValue
  | Literal
  | Model
  | OffsetDateTime
  | RefBase
  | SafeInt
  | Scalar
  | Slice
  | StringSlice
  | StringType
  | Url
  | Vector;

/** Type defines a type within the Rust type system */
export type Type = SdkType | WireType;

/** Kind contains the set of discriminator values for all types */
export type Kind = Type['kind'];

/** Arc is a std::sync::Arc<T> */
export interface Arc extends QualifiedType {
  kind: 'arc';

  /**
   * the generic type param
   * at present, only TokenCredential is supported
   */
  type: TokenCredential;
}

/** Box is a Rust Box<T> */
export interface Box {
  kind: 'box';

  /** the type that's being boxed */
  type: WireType;
}

/** Bytes is a azure_core::Bytes type */
export interface Bytes extends External {
  kind: 'bytes';
}

/** Decimal is a rust_decimal::Decimal type */
export interface Decimal extends External {
  kind: 'decimal';

  /** indicates that the value is encoded/decoded as a string */
  stringEncoding: boolean;
}

/** BytesEncoding defines the possible types of base64-encoding. */
export type BytesEncoding = 'std' | 'url';

/** EncodedBytes is a Rust Vec<u8> that's base64-encoded. */
export interface EncodedBytes {
  kind: 'encodedBytes';

  /** indicates what kind of base64-encoding to use */
  encoding: BytesEncoding;

  /** indicates if this should be a slice instead of Vec */
  slice: boolean;
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
export interface HashMap extends QualifiedType {
  kind: 'hashmap';

  /** the V generic type param */
  type: WireType;
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

  /** the value's kind */
  valueKind: Scalar | StringType;

  /** the literal's value */
  value: boolean | number | string;
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
  kind: 'modelField';

  /** the name of the field over the wire */
  serde: string;

  /** the flags set for this field */
  flags: ModelFieldFlags;

  /** indicates if the field is optional */
  optional: boolean;

  /** contains XML-specific serde info */
  xmlKind?: XMLKind;
}

/** ModelFieldFlags contains bit flags describing field usage */
export enum ModelFieldFlags {
  Unspecified = 0,

  /** field contains the page of items in a paged response */
  PageItems = 1,
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
   */
  type: Box | RequestContent | Struct | WireType;
}

/** PageIterator is a PageIterator<T> from azure_core */
export interface PageIterator extends External {
  kind: 'pageIterator';

  /** the model containing the page of items */
  type: Response<Model, Exclude<ResponseFormat, 'NoFormat'>>;
}

/** Pager is a Pager<T> from azure_core */
export interface Pager extends External {
  kind: 'pager';

  /** the model containing the page of items */
  type: Response<Model, Exclude<ResponseFormat, 'NoFormat'>>;
}

/** PayloadFormat indicates the wire format for request bodies */
export type PayloadFormat = 'json' | 'xml';

/**
 * Payload<T> is used for operations that send a typed payload.
 * it's a grouping of the payload type and its wire format but does not
 * actually exist as a type (i.e. there's no Payload type in emitted code).
 */
export interface Payload<T extends WireType = WireType> {
  kind: 'payload';

  /**
   * the generic type param
   */
  type: T;

  /** the wire format of the request body */
  format: PayloadFormat;
}

/**
 * RawResponse is used for operations that receive a streaming response.
 */
export interface RawResponse extends External {
  kind: 'rawResponse';
}

/**
 * RefBase is the base type for Ref and is used to avoid
 * a circular dependency in RefType. callers will instantiate
 * instances of Ref.
 */
export interface RefBase {
  kind: 'ref';

  /** the underlying type */
  type: WireType;
}

/** RefType describes the possible types for Ref */
export type RefType = Exclude<WireType, Literal | RefBase>;

/** Ref is a reference to a type */
export interface Ref<T extends RefType = RefType> extends RefBase {
  /** the underlying type */
  type: T;
}

/** RequestContentTypes defines the type constraint when creating a RequestContent<T> */
type RequestContentTypes = Bytes | Payload;

/** RequestContent is a Rust RequestContent<T> from azure_core */
export interface RequestContent<T extends RequestContentTypes = RequestContentTypes> extends External {
  kind: 'requestContent';

  /** the type of content sent in the request */
  content: T;
}

/** ResponseFormat is the format of the response body */
export type ResponseFormat = 'JsonFormat' | 'NoFormat' | 'XmlFormat';

/** ResponseTypes defines the type constraint when creating a Response<T> */
export type ResponseTypes = MarkerType | Unit | WireType;

/** Response is a Rust Response<T, Format> from azure_core */
export interface Response<T extends ResponseTypes = ResponseTypes, Format extends ResponseFormat = ResponseFormat> extends External {
  kind: 'response';

  /** the type of content sent in the response */
  content: T;

  /** the wire format of the response body */
  format: Format;
}

/** ResultTypes defines the type constraint when creating a Result<T> */
type ResultTypes = PageIterator | Pager | RawResponse | Response;

/** Result is a Rust Result<T> from azure_core */
export interface Result<T extends ResultTypes = ResultTypes> extends External {
  kind: 'result';

  /** the generic type param */
  type: T;
}

/** SafeInt is a serde_json::Number type */
export interface SafeInt extends External {
  kind: 'safeint';

  /** indicates that the value is encoded/decoded as a string */
  stringEncoding: boolean;
}

/** ScalarType defines the supported Rust scalar type names */
export type ScalarType = 'bool' | 'f32' | 'f64' | 'i8' | 'i16' | 'i32' | 'i64' | 'u8' | 'u16' | 'u32' | 'u64';

/** Scalar is a Rust scalar type */
export interface Scalar {
  kind: 'scalar';

  /** the type of scalar */
  type: ScalarType;

  /** indicates that the value is encoded/decoded as a string */
  stringEncoding: boolean;
}

/** Slice is a Rust slice i.e. [T] */
export interface Slice {
  kind: 'slice';

  /** the type of the slice */
  type: WireType;
}

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
  kind: 'Vec';

  /** the generic type param */
  type: WireType;
}

/** XMLKind contains info used for generating XML-specific serde */
export type XMLKind = 'attribute' | 'text' | 'unwrappedList';

///////////////////////////////////////////////////////////////////////////////////////////////////
// exported base types
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * QualifiedType is a fully qualified type.
 *
 * this is typically a type in the standard library that's not in the prelude set.
 */
export interface QualifiedType {
  /** the name of the type */
  name: string;

  /** the path to use to bring it into scope */
  path: string;
}

export class QualifiedType implements QualifiedType {
  constructor(name: string, path: string) {
    this.name = name;
    this.path = path;
  }
}

/** Visibility defines where something can be accessed. */
export type Visibility = 'pub' | 'pubCrate';

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * External is a qualified type defined in a different crate
 *
 * the value in path will be used to determine the crate name
 */
interface External extends QualifiedType {}

class External extends QualifiedType implements External {
  constructor(crate: Crate, name: string, path: string, features = new Array<string>()) {
    super(name, path);
    let crateName = this.path;
    const pathSep = crateName.indexOf('::');
    if (pathSep > 0) {
      crateName = crateName.substring(0, pathSep);
    }
    crate.addDependency(new CrateDependency(crateName, features));
  }
}

/** base type for models and structs */
interface StructBase {
  kind: 'model' | 'struct';

  /** the name of the struct */
  name: string;

  /** any docs for the type */
  docs: Docs;

  /** indicates the visibility of the struct */
  visibility: Visibility;

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

  /** indicates the visibility of the struct field */
  visibility: Visibility;

  /** the field's underlying type */
  type: Type;

  /** the value to use when emitting a Default impl for the containing struct */
  defaultValue?: string;
}

class StructBase implements StructBase {
  constructor(kind: 'model' | 'struct', name: string, visibility: Visibility) {
    this.kind = kind;
    this.name = name;
    this.visibility = visibility;
    this.docs = {};
  }
}

class StructFieldBase implements StructFieldBase {
  constructor(name: string, visibility: Visibility, type: Type) {
    this.name = name;
    this.visibility = visibility;
    this.type = type;
    this.docs = {};
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Arc extends QualifiedType implements Arc {
  constructor(type: TokenCredential) {
    super('Arc', 'std::sync');
    this.kind = 'arc';
    this.type = type;
  }
}

export class Box implements Box {
  constructor(type: WireType) {
    this.kind = 'box';
    this.type = type;
  }
}

export class Bytes extends External implements Bytes {
  constructor(crate: Crate) {
    super(crate, 'Bytes', 'azure_core');
    this.kind = 'bytes';
  }
}

export class Decimal extends External implements Decimal {
  constructor(crate: Crate, stringEncoding: boolean) {
    super(crate, 'Decimal', 'rust_decimal', !stringEncoding ? ['serde-with-float'] : undefined);
    this.kind = 'decimal';
    this.stringEncoding = stringEncoding;
  }
}

export class EncodedBytes implements EncodedBytes {
  constructor(encoding: BytesEncoding, slice: boolean) {
    this.kind = 'encodedBytes';
    this.encoding = encoding;
    this.slice = slice;
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
    super(crate, 'Etag', 'azure_core::http');
    this.kind = 'Etag';
  }
}

export class ExternalType extends External implements ExternalType {
  constructor(crate: Crate, name: string, path: string) {
    super(crate, name, path);
    this.kind = 'external';
  }
}

export class HashMap extends QualifiedType implements HashMap {
  constructor(type: WireType) {
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
    super(crate, 'Value', 'serde_json');
    this.kind = 'jsonValue';
  }
}

export class Lifetime implements Lifetime {
  constructor(name: string) {
    this.name = `'${name}`;
  }
}

export class Literal implements Literal {
  constructor(valueKind: Scalar | StringType, value: boolean | number | string) {
    this.kind = 'literal';
    this.valueKind = valueKind;
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
  constructor(name: string, visibility: Visibility, flags: ModelFlags) {
    super('model', name, visibility);
    this.fields = new Array<ModelField>();
    this.flags = flags;
  }
}

export class ModelField extends StructFieldBase implements ModelField {
  constructor(name: string, serde: string, visibility: Visibility, type: Type, optional: boolean) {
    super(name, visibility, type);
    this.kind = 'modelField';
    this.flags = ModelFieldFlags.Unspecified;
    this.optional = optional;
    this.serde = serde;
  }
}

export class OffsetDateTime extends External implements OffsetDateTime {
  constructor(crate: Crate, encoding: DateTimeEncoding, utc: boolean) {
    super(crate, 'OffsetDateTime', 'azure_core::time');
    this.kind = 'offsetDateTime';
    this.encoding = encoding;
    this.utc = utc;
  }
}

export class Option implements Option {
  constructor(type: Box | WireType | RequestContent | Struct) {
    this.kind = 'option';
    this.type = type;
  }
}

export class PageIterator extends External implements PageIterator {
  constructor(crate: Crate, type: Response<Model, Exclude<ResponseFormat, 'NoFormat'>>) {
    super(crate, 'PageIterator', 'azure_core::http');
    this.kind = 'pageIterator';
    this.type = type;
  }
}

export class Pager extends External implements Pager {
  constructor(crate: Crate, type: Response<Model, Exclude<ResponseFormat, 'NoFormat'>>) {
    super(crate, 'Pager', 'azure_core::http');
    this.kind = 'pager';
    this.type = type;
  }
}

export class Payload<T> implements Payload<T> {
  constructor(type: T, format: PayloadFormat) {
    this.kind = 'payload';
    this.type = type;
    this.format = format;
  }
}

export class RawResponse extends External implements RawResponse {
  constructor(crate: Crate) {
    super(crate, 'RawResponse', 'azure_core::http');
    this.kind = 'rawResponse';
  }
}

export class Ref<T> implements Ref<T> {
  constructor(type: T) {
    this.kind = 'ref';
    this.type = type;
  }
}

export class RequestContent<T> extends External implements RequestContent<T> {
  constructor(crate: Crate, content: T) {
    super(crate, 'RequestContent', 'azure_core::http');
    this.kind = 'requestContent';
    this.content = content;
  }
}

export class Response<T, Format> extends External implements Response<T, Format> {
  constructor(crate: Crate, content: T, format: Format) {
    super(crate, 'Response', 'azure_core::http');
    this.kind = 'response';
    this.content = content;
    this.format = format;
  }
}

export class Result<T> extends External implements Result<T> {
  constructor(crate: Crate, type: T) {
    super(crate, 'Result', 'azure_core');
    this.kind = 'result';
    this.type = type;
  }
}

export class SafeInt extends External implements SafeInt {
  constructor(crate: Crate, stringEncoding: boolean) {
    super(crate, 'Number', 'serde_json');
    this.kind = 'safeint';
    this.stringEncoding = stringEncoding;
  }
}

export class Scalar implements Scalar {
  constructor(type: ScalarType, stringEncoding: boolean) {
    this.kind = 'scalar';
    this.type = type;
    this.stringEncoding = stringEncoding;
  }
}

export class Slice implements Slice {
  constructor(type: WireType) {
    this.kind = 'slice';
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
  constructor(name: string, visibility: Visibility) {
    super('struct', name, visibility);
    this.fields = new Array<StructField>();
  }
}

export class StructField extends StructFieldBase implements StructField {
  constructor(name: string, visibility: Visibility, type: Type) {
    super(name, visibility, type);
  }
}

export class TokenCredential extends External implements TokenCredential {
  constructor(crate: Crate, scopes: Array<string>) {
    super(crate, 'TokenCredential', 'azure_core::credentials');
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
    super(crate, 'Url', 'azure_core::http');
    this.kind = 'Url';
  }
}

export class Vector implements Vector {
  constructor(type: WireType) {
    this.kind = 'Vec';
    this.type = type;
  }
}
