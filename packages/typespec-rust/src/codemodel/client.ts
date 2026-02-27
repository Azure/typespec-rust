/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ModuleContainer } from './crate.js';
import * as method from './method.js';
import * as types from './types.js';

/** Client is a SDK client */
export interface Client {
  kind: 'client';

  /** the name of the client */
  name: string;

  /** any docs for the client */
  docs: types.Docs;

  /** the client's language-independent name, currently used for tracing */
  languageIndependentName: string;

  /** contains info for instantiable clients */
  constructable?: ClientConstruction;

  /**
   * contains the endpoint field. this is a convenient way to
   * access the endpoint field instead of searching through
   * the fields array (i.e. heuristics).
   */
  endpoint: types.StructField;

  /**
   * fields contains the ctor parameters that are
   * persisted as fields on the client type and might
   * also contain other fields that don't originate
   * from ctor params (e.g. the pipeline).
   * by convention, all fields that have their values
   * populated from ctor params (required or optional)
   * will have the same name as their originating param.
   */
  fields: Array<types.StructField>;

  /** all the methods for this client */
  methods: Array<MethodType>;

  /** the module to which this client belongs */
  module: ModuleContainer;

  /** the parent client in a hierarchical client */
  parent?: Client;
}

/** ClientConstruction contains data for instantiable clients. */
export interface ClientConstruction {
  /** the client options type used in the constructors */
  options: ClientOptions;

  /** the constructor functions for a client. */
  constructors: Array<Constructor>;

  /**
   * indicates that the endpoint requires additional host configuration. i.e. the
   * endpoint passed by the caller will be augmented with supplemental path info.
   */
  endpoint?: SupplementalEndpoint;

  /**
   * indicates that any constructors and possibly client options type be omitted.
   *    no - don't suppress any content (this is the default)
   *  ctor - suppress all constructors (set via @@clientInitialization decorator)
   *   yes - suppress all constructors and client options (set via the omit-constructors switch)
   */
  suppressed: 'no' | 'ctor' | 'yes';
}

/** ClientOptions is the struct containing optional client params */
export interface ClientOptions extends types.Option {
  /** the client options type */
  type: types.Struct;
}

/** ClientParameter defines the possible client parameter types */
export type ClientParameter = ClientCredentialParameter | ClientEndpointParameter | ClientMethodParameter | ClientSupplementalEndpointParameter;

/** represents a client constructor function */
export interface Constructor {
  kind: 'constructor';

  /** name of the constructor */
  name: string;

  /** the modeled parameters. at minimum, an endpoint param */
  params: Array<ClientParameter>;

  /** any docs for the constructor */
  docs: types.Docs;
}

/** ClientMethodParameter is a Rust client parameter that's used in method bodies */
export interface ClientMethodParameter extends ClientParameterBase {
  kind: 'clientMethod';
}

/** ClientEndpointParameter is the client's host parameter */
export interface ClientEndpointParameter extends ClientParameterBase {
  kind: 'clientEndpoint';

  /** the endpoint param is always a &str */
  type: types.Ref<types.StringSlice>;

  /** never optional */
  optional: false;
}

/** ClientEndpointParameter is used when constructing the endpoint's supplemental path */
export interface ClientSupplementalEndpointParameter extends ClientParameterBase {
  kind: 'clientSupplementalEndpoint';

  /** the segment name to be replaced with the param's value */
  segment: string;
}

/** ClientCredentialParameter is the client's credential parameter */
export interface ClientCredentialParameter extends ClientParameterBase {
  kind: 'clientCredential';

  /** never optional */
  optional: false;
}

/** contains data on how to supplement a client endpoint */
export interface SupplementalEndpoint {
  /** the supplemental path used to construct the complete endpoint */
  path: string;

  /** the parameters used to replace segments in the path */
  parameters: Array<ClientSupplementalEndpointParameter>;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// methods
///////////////////////////////////////////////////////////////////////////////////////////////////

/** HTTPMethod defines the possible HTTP verbs in a request */
export type HTTPMethod = 'delete' | 'get' | 'head' | 'patch' | 'post' | 'put';

/** Method defines the possible method types */
export type MethodType = AsyncMethod | ClientAccessor | PageableMethod | LroMethod;

/** AsyncMethod is an async Rust method */
export interface AsyncMethod extends HTTPMethodBase {
  kind: 'async';

  /** the params passed to the method (excluding self). can be empty */
  params: Array<MethodParameter>;

  /** the type returned by the method */
  returns: types.Result<types.AsyncResponse | types.Response>;
}

/** ClientAccessor is a method that returns a sub-client instance. */
export interface ClientAccessor extends method.Method<Client> {
  kind: 'clientaccessor';

  /** the client returned by the accessor method */
  returns: Client;
}

/** PageableMethod is a method that returns a collection of items over one or more pages. */
export interface PageableMethod extends HTTPMethodBase {
  kind: 'pageable';

  /** the params passed to the method (excluding self). can be empty */
  params: Array<MethodParameter>;

  /** the paged result */
  returns: types.Result<types.Pager>;

  /**
   * the strategy used to fetch the next page.
   * no strategy indicates the method is modeled as pageable
   * but doesn't (yet) support fetching subsequent pages.
   */
  strategy?: PageableStrategyKind;
}

/** LRO final result gets returned via the initial request made to the original URL */
export interface LroFinalResultStrategyOriginalUri {
  kind: 'originalUri';
}

export type LroFinalResultStrategyHeaderName = 'operation-location' | 'azure-asyncoperation' | 'location';

/** LRO final result gets returned via the request sent to a URL that was returned in the first response, inside the  */
export interface LroFinalResultStrategyHeader {
  kind: 'header';

  /** name of the header containing the URL to read the final result from */
  headerName: LroFinalResultStrategyHeaderName;

  /** name of the field in the result response object to read the final result from.
   * If undefined, the entire object is the final result.
   */
  propertyName?: string;
}

/** A type that describes how the final result from an LRO is available. */
export type LroFinalResultStrategyKind = LroFinalResultStrategyOriginalUri | LroFinalResultStrategyHeader;

/** LroMethod is a method that returns a long-running operation. */
export interface LroMethod extends HTTPMethodBase {
  kind: 'lro';

  /** the params passed to the method (excluding self). can be empty */
  params: Array<MethodParameter>;

  /** the lro result */
  returns: types.Result<types.Poller>;

  /** A description of how the final result from the LRO is available. */
  finalResultStrategy: LroFinalResultStrategyKind;
}

/** PageableStrategyContinuationToken indicates a pageable method uses the continuation token strategy */
export interface PageableStrategyContinuationToken {
  kind: 'continuationToken';

  /** the parameter that contains the continuation token */
  requestToken: HeaderScalarParameter | QueryScalarParameter;

  /**
   * the location in the response that contains the continuation token.
   * can be a response header or a field in response model.
   */
  responseToken: ResponseHeaderScalar | PageableStrategyNextLink;
}

/** PageableStrategyNextLink indicates a pageable method uses the nextLink strategy */
export interface PageableStrategyNextLink {
  kind: 'nextLink';

  /**
   * the field path in the response that contains the next link URL.
   * one entry at minimum. when the next link is nested in the response
   * type, the array will contain the "path" to the next link.
   */
  nextLinkPath: Array<types.ModelField>;

  /** the query params to be reinjected when fetching pages. can be empty */
  reinjectedParams: Array<QueryCollectionParameter | QueryHashMapParameter | QueryScalarParameter>;
}

/** PageableStrategyKind contains different strategies for fetching subsequent pages */
export type PageableStrategyKind = PageableStrategyContinuationToken | PageableStrategyNextLink;

///////////////////////////////////////////////////////////////////////////////////////////////////
// parameters
///////////////////////////////////////////////////////////////////////////////////////////////////

/** ParameterStyle indicates how a collection is styled on the wire */
// https://spec.openapis.org/oas/v3.1.0#style-examples
// https://swagger.io/docs/specification/v3_0/serialization/
export type ParameterStyle =
  /** Simple replacement of "{placeholder}" to "value" */
  // For scalar values, it works the same regardless of 'explode'.
  // For arrays, "{placeholder}" becomes "v,a,l,u,e,s", regardless of 'explode'.
  // For hashmaps, it is "k1,v1,k2,v2" when 'explode' is false, "k1=v1,k2=v2" when true.
  'simple' |

  /** Expansion of value into path components via '/': "{placeholder}" becomes "/value" */
  // For scalar values, it works the same regardless of 'explode'.
  // For arrays, "{placeholder}" becomes "/v,a,l,u,e,s" when 'explode' is false, "/v/a/l/u/e/s" when true.
  // For hashmaps, it is "/k1,v1,k2,v2" when 'explode' is false, "/k1=v1/k2=v2" when true.
  'path' |

  /** Expansion of value into a label via '.': "{placeholder}" becomes ".value" */
  // For scalar values, it works the same regardless of 'explode'.
  // For arrays, "{placeholder}" becomes ".v,a,l,u,e,s" when 'explode' is false, ".v.a.l.u.e.s" when true.
  // For hashmaps, it is ".k1,v1,k2,v2" when 'explode' is false, ".k1=v1.k2=v2" when true.
  'label' |

  /** Semicolon separated, 'name=value' form: "{placeholder}" becomes ";param=value" */
  // For scalar values, it works the same regardless of 'explode'.
  // For arrays, "{placeholder}" becomes ";param=v,a,l,u,e,s" when 'explode' is false, ";param=v;param=a;param=l;param=u;param=e;param=s" when true.
  // For hashmaps, it is ";param=k1,v1,k2,v2" when 'explode' is false, ";k1=v1;k2=v2" when true.
  'matrix';

/** CollectionFormat indicates how a collection is formatted on the wire */
export type CollectionFormat = 'csv' | 'ssv' | 'tsv' | 'pipes';

/** ExtendedCollectionFormat includes additional formats */
export type ExtendedCollectionFormat = CollectionFormat | 'multi';

/** ParameterLocation indicates where the value of the param originates */
export type ParameterLocation = 'client' | 'method';

/** MethodParameter defines the possible method parameter types */
export type MethodParameter = BodyParameter | HeaderCollectionParameter | HeaderHashMapParameter | HeaderScalarParameter | PartialBodyParameter | PathCollectionParameter | PathHashMapParameter | PathScalarParameter | QueryCollectionParameter | QueryHashMapParameter | QueryScalarParameter;

/** BodyParameter is a param that's passed via the HTTP request body */
export interface BodyParameter extends HTTPParameterBase {
  kind: 'body';

  /** the type of the body param */
  type: types.RequestContent;
}

/** HeaderCollectionParameterType defines the possible types for a HeaderCollectionParameter */
export type HeaderCollectionParameterType = types.Ref<types.Slice> | types.Vector;

/** HeaderCollectionParameter is a param that goes in a HTTP header */
export interface HeaderCollectionParameter extends HTTPParameterBase {
  kind: 'headerCollection';

  /** the header in the HTTP request */
  header: string;

  /** the collection of header param values */
  type: HeaderCollectionParameterType;

  /** the format of the collection */
  format: CollectionFormat;
}

/**
 * HeaderHashMapParameter is a param that goes in a HTTP header
 * NOTE: this is a specialized parameter type to support storage.
 */
export interface HeaderHashMapParameter extends HTTPParameterBase {
  kind: 'headerHashMap';

  /** the header prefix for each header name in type */
  header: string;

  /** contains key/value pairs of header names/values */
  type: types.HashMap | types.Ref<types.HashMap>;
}

/** HeaderScalarParameterType defines the possible types for a HeaderScalarParameter */
export type HeaderScalarParameterType = Exclude<types.WireType, types.HashMap | types.JsonValue | types.Model | types.Slice | types.StringSlice | types.Vector>;

/** HeaderScalarParameter is a scalar param that goes in a HTTP header */
export interface HeaderScalarParameter extends HTTPParameterBase {
  kind: 'headerScalar';

  /** the header in the HTTP request */
  header: string;

  /** the type of the param */
  type: HeaderScalarParameterType;

  /**
   * indicates this is an API version parameter 
   * the default value is false.
   */
  isApiVersion: boolean;
}

/** MethodOptions is the struct containing optional method params */
export interface MethodOptions extends types.Option {
  type: types.Struct;
}

/** PartialBodyParameter is a param that's a field within a type passed via the HTTP request body */
export interface PartialBodyParameter extends HTTPParameterBase {
  kind: 'partialBody';

  /**
   * the type of the spread param as it appears in a method signature
   * note that not all types are applicable
   */
  paramType: types.Type;

  /** the model in which the partial param is placed */
  type: types.RequestContent<types.Payload<types.Model>>;

  /** the name of the field over the wire in model.fields for this param */
  serde: string;
}

/** PathCollectionParameterType defines the possible types for a PathCollectionParameter */
export type PathCollectionParameterType = types.HashMap | types.Ref<types.HashMap> | types.Ref<types.Slice> | types.Vector;

/** PathCollectionParameter is a param that goes in the HTTP path */
export interface PathCollectionParameter extends HTTPParameterBase {
  kind: 'pathCollection';

  /** the segment name to be replaced with the param's value */
  segment: string;

  /** the type of the param */
  type: PathCollectionParameterType;

  /** indicates if the path parameter should be URL encoded */
  encoded: boolean;

  /** parameter style */
  style: ParameterStyle;

  /** indicates if the parameter should be passed with "explode" styling. defaults to false */
  explode: boolean;
}

/** PathHashMapParameter is a param that goes in the HTTP path */
export interface PathHashMapParameter extends HTTPParameterBase {
  kind: 'pathHashMap';

  /** the segment name to be replaced with the param's value */
  segment: string;

  /** contains key/value pairs */
  type: types.HashMap | types.Ref<types.HashMap>;

  /** indicates if the path parameter should be URL encoded */
  encoded: boolean;

  /** parameter style */
  style: ParameterStyle;

  /** indicates if the parameter should be passed with "explode" styling. defaults to false */
  explode: boolean;
}

/** PathScalarParameterType defines the possible types for a PathScalarParameter */
export type PathScalarParameterType = Exclude<types.WireType, types.HashMap | types.JsonValue | types.Model | types.Slice | types.StringSlice | types.Vector>;

/** PathScalarParameter is a scalar param that goes in the HTTP path */
export interface PathScalarParameter extends HTTPParameterBase {
  kind: 'pathScalar';

  /** the segment name to be replaced with the param's value */
  segment: string;

  /** the type of the param */
  type: PathScalarParameterType;

  /** indicates if the path parameter should be URL encoded */
  encoded: boolean;

  /** parameter style */
  style: ParameterStyle;
}

/** QueryCollectionParameterType defines the possible types for a QueryCollectionParameter */
export type QueryCollectionParameterType = types.Ref<types.Slice> | types.Vector;

/** QueryCollectionParameter is a param that goes in the HTTP query string */
export interface QueryCollectionParameter extends HTTPParameterBase {
  kind: 'queryCollection';

  /** key is the query param's key name */
  key: string;

  /** the collection of query param values */
  type: QueryCollectionParameterType;

  /** indicates if the query parameter should be URL encoded */
  encoded: boolean;

  /** the format of the collection */
  format: ExtendedCollectionFormat;
}

/** QueryHashMapParameter is a param that goes in the HTTP query string */
export interface QueryHashMapParameter extends HTTPParameterBase {
  kind: 'queryHashMap';

  /** key is the query param's key name */
  key: string;

  /** contains key/value pairs */
  type: types.HashMap | types.Ref<types.HashMap>;

  /** indicates if the query parameter should be URL encoded */
  encoded: boolean;

  /** indicates if the parameter should be passed with "explode" styling. defaults to false */
  explode: boolean;
}

/** QueryScalarParameterType defines the possible types for a QueryScalarParameter */
export type QueryScalarParameterType = Exclude<types.WireType, types.HashMap | types.JsonValue | types.Model | types.Slice | types.StringSlice | types.Vector>;

/** QueryScalarParameter is a scalar param that goes in the HTTP query string */
export interface QueryScalarParameter extends HTTPParameterBase {
  kind: 'queryScalar';

  /** key is the query param's key name */
  key: string;

  /** the type of the param */
  type: QueryScalarParameterType;

  /** indicates if the query parameter should be URL encoded */
  encoded: boolean;

  /**
   * indicates this is an API version parameter 
   * the default value is false.
   */
  isApiVersion: boolean;
}

/** ResponseHeader defines the possible typed headers returned in a HTTP response */
export type ResponseHeader = ResponseHeaderHashMap | ResponseHeaderScalar;

/**
 * ResponseHeaderHashMap is a collection of typed header responses.
 * NOTE: this is a specialized response type to support storage.
 */
export interface ResponseHeaderHashMap {
  kind: 'responseHeaderHashMap';

  /** the name to use for the trait method */
  name: string;

  /** the header prefix for each header name in type */
  header: string;

  /** contains key/value pairs of header names/values */
  type: types.HashMap;

  /** any docs for the header */
  docs: types.Docs;
}

/** ResponseHeaderScalar is a typed header returned in a HTTP response */
export interface ResponseHeaderScalar {
  kind: 'responseHeaderScalar';

  /** the name to use for the trait method */
  name: string;

  /** the header in the HTTP response */
  header: string;

  /** the type of the response header */
  type: types.WireType;

  /** any docs for the header */
  docs: types.Docs;
}

/** ResponseHeadersTrait is a trait used to access strongly typed response headers */
export interface ResponseHeadersTrait {
  kind: 'responseHeadersTrait';

  /** name of the trait */
  name: string;

  /** the type for which to implement the trait */
  implFor: types.AsyncResponse<types.MarkerType> | types.Response<types.MarkerType | types.Model>;

  /** the headers in the trait */
  headers: Array<ResponseHeader>;

  /** doc string for the trait */
  docs: string;

  /** indicates the visibility of the trait */
  visibility: types.Visibility;

  /** the module to which this trait belongs */
  module: ModuleContainer;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

interface ClientParameterBase {
  /** the name of the parameter */
  name: string;

  /** the type of the client parameter */
  type: types.Type;

  /**
   * indicates if the parameter is optional.
   * optional params will be surfaced in the client options type.
   */
  optional: boolean;

  /** any docs for the parameter */
  docs: types.Docs;
}

/** base type for HTTP-based methods */
interface HTTPMethodBase extends method.Method<types.Type> {
  /** the params passed to the method (excluding self). can be empty */
  params: Array<HTTPParameterBase>;

  /** the method options type for this method */
  options: MethodOptions;

  /** the type returned by the method */
  returns: types.Result;

  /**
   * List of HTTP status codes that should be treated as successes.
   * If empty, default success determination (any 2xx) is used.
   */
  statusCodes: Array<number>;

  /** contains the trait for accessing response headers */
  responseHeaders?: ResponseHeadersTrait;

  /** the HTTP verb used for the request */
  httpMethod: HTTPMethod;

  /** the HTTP path for the request */
  httpPath: string;
}

/** base type for HTTP-based method parameters */
interface HTTPParameterBase extends method.Parameter {
  /** location of the parameter (e.g. client or method) */
  location: ParameterLocation;

  /** optional params go in the method's MethodOptions type */
  optional: boolean;
}

class ClientParameterBase implements ClientParameterBase {
  constructor(name: string, type: types.Type, optional: boolean) {
    this.name = name;
    this.type = type;
    this.optional = optional;
    this.docs = {};
  }
}

class HTTPMethodBase extends method.Method<types.Type> implements HTTPMethodBase {
  constructor(name: string, languageIndependentName: string, httpMethod: HTTPMethod, httpPath: string, visibility: types.Visibility, impl: string, self: method.Self) {
    super(name, languageIndependentName, visibility, impl, self);
    this.httpMethod = httpMethod;
    this.httpPath = httpPath;
    this.docs = {};
  }
}

class HTTPParameterBase extends method.Parameter {
  constructor(name: string, location: ParameterLocation, optional: boolean, type: types.Type) {
    super(name, type);
    this.location = location;
    this.optional = optional;
    this.docs = {};
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class AsyncMethod extends HTTPMethodBase implements AsyncMethod {
  constructor(name: string, languageIndependentName: string, client: Client, visibility: types.Visibility, options: MethodOptions, httpMethod: HTTPMethod, httpPath: string) {
    super(name, languageIndependentName, httpMethod, httpPath, visibility, client.name, new method.Self(false, true));
    this.kind = 'async';
    this.params = new Array<MethodParameter>();
    this.options = options;
  }
}

export class BodyParameter extends HTTPParameterBase implements BodyParameter {
  constructor(name: string, location: ParameterLocation, optional: boolean, type: types.RequestContent) {
    super(name, location, optional, type);
    this.kind = 'body';
  }
}

export class Client implements Client {
  constructor(name: string, module: ModuleContainer) {
    this.kind = 'client';
    this.name = name;
    this.fields = new Array<types.StructField>();
    this.methods = new Array<MethodType>();
    this.module = module;
    this.docs = {};
  }
}

export class ClientAccessor extends method.Method<Client> implements ClientAccessor {
  constructor(name: string, client: Client, returns: Client) {
    super(name, name, 'pub', client.name, new method.Self(false, true));
    this.kind = 'clientaccessor';
    this.params = new Array<MethodParameter>();
    this.returns = returns;
  }
}

export class ClientConstruction implements ClientConstruction {
  constructor(options: ClientOptions) {
    this.options = options;
    this.constructors = new Array<Constructor>();
    this.suppressed = 'no';
  }
}

export class ClientOptions extends types.Option implements ClientOptions {
  constructor(type: types.Struct) {
    super(type);
  }
}

export class ClientMethodParameter extends ClientParameterBase implements ClientMethodParameter {
  constructor(name: string, type: types.Type, optional: boolean) {
    super(name, type, optional);
    this.kind = 'clientMethod';
  }
}

export class Constructor implements Constructor {
  constructor(name: string) {
    this.kind = 'constructor';
    this.name = name;
    this.params = new Array<ClientParameter>();
    this.docs = {};
  }
}

export class ClientCredentialParameter extends ClientParameterBase implements ClientCredentialParameter {
  constructor(name: string, type: types.Type) {
    super(name, type, false);
    this.kind = 'clientCredential';
  }
}

export class ClientEndpointParameter extends ClientParameterBase implements ClientEndpointParameter {
  constructor(name: string) {
    super(name, new types.Ref(new types.StringSlice()), false);
    this.kind = 'clientEndpoint';
  }
}

export class ClientSupplementalEndpointParameter extends ClientParameterBase implements ClientSupplementalEndpointParameter {
  constructor(name: string, type: types.Type, optional: boolean, segment: string) {
    super(name, type, optional);
    this.kind = 'clientSupplementalEndpoint';
    this.segment = segment;
  }
}

export class HeaderCollectionParameter extends HTTPParameterBase implements HeaderCollectionParameter {
  constructor(name: string, header: string, location: ParameterLocation, optional: boolean, type: HeaderCollectionParameterType, format: CollectionFormat) {
    super(name, location, optional, type);
    this.kind = 'headerCollection';
    this.header = header;
    this.format = format;
  }
}

export class HeaderHashMapParameter extends HTTPParameterBase implements HeaderHashMapParameter {
  constructor(name: string, header: string, location: ParameterLocation, optional: boolean, type: types.HashMap | types.Ref<types.HashMap>) {
    super(name, location, optional, type);
    this.kind = 'headerHashMap';
    this.header = header;
  }
}

export class HeaderScalarParameter extends HTTPParameterBase implements HeaderScalarParameter {
  constructor(name: string, header: string, location: ParameterLocation, optional: boolean, type: HeaderScalarParameterType) {
    super(name, location, optional, type);
    this.kind = 'headerScalar';
    this.header = header;
    this.isApiVersion = false;
  }
}

export class MethodOptions extends types.Option implements MethodOptions {
  constructor(type: types.Struct) {
    super(type);
  }
}

export class PageableMethod extends HTTPMethodBase implements PageableMethod {
  constructor(name: string, languageIndependentName: string, client: Client, visibility: types.Visibility, options: MethodOptions, httpMethod: HTTPMethod, httpPath: string) {
    super(name, languageIndependentName, httpMethod, httpPath, visibility, client.name, new method.Self(false, true));
    this.kind = 'pageable';
    this.params = new Array<MethodParameter>();
    this.options = options;
  }
}

export class LroFinalResultStrategyOriginalUri implements LroFinalResultStrategyOriginalUri {
  constructor() {
    this.kind = 'originalUri';
  }
}

export class LroFinalResultStrategyHeader implements LroFinalResultStrategyHeader {
  constructor(headerName: LroFinalResultStrategyHeaderName) {
    this.kind = 'header';
    this.headerName = headerName;
  }
}

export class LroMethod extends HTTPMethodBase implements LroMethod {
  constructor(name: string, languageIndependentName: string, client: Client, visibility: types.Visibility, options: MethodOptions, httpMethod: HTTPMethod, httpPath: string, finalResultStrategy: LroFinalResultStrategyKind) {
    super(name, languageIndependentName, httpMethod, httpPath, visibility, client.name, new method.Self(false, true));
    this.kind = 'lro';
    this.params = new Array<MethodParameter>();
    this.options = options;
    this.finalResultStrategy = finalResultStrategy;
  }
}

export class PageableStrategyContinuationToken implements PageableStrategyContinuationToken {
  constructor(requestToken: HeaderScalarParameter | QueryScalarParameter, responseToken: ResponseHeaderScalar | PageableStrategyNextLink) {
    this.kind = 'continuationToken';
    this.requestToken = requestToken;
    this.responseToken = responseToken;
  }
}

export class PageableStrategyNextLink implements PageableStrategyNextLink {
  constructor(nextLinkPath: Array<types.ModelField>) {
    this.kind = 'nextLink';
    this.nextLinkPath = nextLinkPath;
    this.reinjectedParams = new Array<QueryCollectionParameter | QueryHashMapParameter | QueryScalarParameter>();
  }
}

export class PartialBodyParameter extends HTTPParameterBase implements PartialBodyParameter {
  constructor(name: string, location: ParameterLocation, optional: boolean, serde: string, paramType: types.Type, type: types.RequestContent<types.Payload<types.Model>>) {
    super(name, location, optional, type);
    this.kind = 'partialBody';
    this.serde = serde;
    this.paramType = paramType;
  }
}

export class PathCollectionParameter extends HTTPParameterBase implements PathCollectionParameter {
  constructor(name: string, segment: string, location: ParameterLocation, optional: boolean, type: PathCollectionParameterType, encoded: boolean, style: ParameterStyle, explode: boolean) {
    super(name, location, optional, type);
    this.kind = 'pathCollection';
    this.segment = segment;
    this.encoded = encoded;
    this.style = style;
    this.explode = explode;
  }
}

export class PathHashMapParameter extends HTTPParameterBase implements PathHashMapParameter {
  constructor(name: string, segment: string, location: ParameterLocation, optional: boolean, type: types.HashMap | types.Ref<types.HashMap>, encoded: boolean, style: ParameterStyle, explode: boolean) {
    super(name, location, optional, type);
    this.kind = 'pathHashMap';
    this.segment = segment;
    this.encoded = encoded;
    this.style = style;
    this.explode = explode;
  }
}

export class PathScalarParameter extends HTTPParameterBase implements PathScalarParameter {
  constructor(name: string, segment: string, location: ParameterLocation, optional: boolean, type: PathScalarParameterType, encoded: boolean, style: ParameterStyle) {
    super(name, location, optional, type);
    this.kind = 'pathScalar';
    this.segment = segment;
    this.encoded = encoded;
    this.style = style;
  }
}

export class QueryCollectionParameter extends HTTPParameterBase implements QueryCollectionParameter {
  constructor(name: string, key: string, location: ParameterLocation, optional: boolean, type: QueryCollectionParameterType, encoded: boolean, format: ExtendedCollectionFormat) {
    super(name, location, optional, type);
    this.kind = 'queryCollection';
    this.key = key;
    this.encoded = encoded;
    this.format = format;
  }
}

export class QueryHashMapParameter extends HTTPParameterBase implements QueryHashMapParameter {
  constructor(name: string, key: string, location: ParameterLocation, optional: boolean, type: types.HashMap | types.Ref<types.HashMap>, encoded: boolean, explode: boolean) {
    super(name, location, optional, type);
    this.kind = 'queryHashMap';
    this.key = key;
    this.encoded = encoded;
    this.explode = explode;
  }
}

export class QueryScalarParameter extends HTTPParameterBase implements QueryScalarParameter {
  constructor(name: string, key: string, location: ParameterLocation, optional: boolean, type: QueryScalarParameterType, encoded: boolean) {
    super(name, location, optional, type);
    this.kind = 'queryScalar';
    this.key = key;
    this.encoded = encoded;
    this.isApiVersion = false;
  }
}

export class ResponseHeaderHashMap implements ResponseHeaderHashMap {
  constructor(name: string, header: string) {
    this.kind = 'responseHeaderHashMap';
    this.name = name;
    this.header = header;
    this.type = new types.HashMap(new types.StringType());
    this.docs = {};
  }
}

export class ResponseHeaderScalar implements ResponseHeaderScalar {
  constructor(name: string, header: string, type: types.WireType) {
    this.kind = 'responseHeaderScalar';
    this.name = name;
    this.header = header;
    this.type = type;
    this.docs = {};
  }
}

export class ResponseHeadersTrait implements ResponseHeadersTrait {
  constructor(name: string, implFor: types.AsyncResponse<types.MarkerType> | types.Response<types.MarkerType | types.Model>, docs: string, visibility: types.Visibility, module: ModuleContainer) {
    this.kind = 'responseHeadersTrait';
    this.name = name;
    this.implFor = implFor;
    this.docs = docs;
    this.headers = new Array<ResponseHeader>();
    this.visibility = visibility;
    this.module = module;
  }
}

export class SupplementalEndpoint implements SupplementalEndpoint {
  constructor(path: string) {
    this.path = path;
    this.parameters = new Array<ClientSupplementalEndpointParameter>();
  }
}
