/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as method from './method.js';
import * as types from './types.js';

// Client is a SDK client
export interface Client {
  kind: 'client';

  // the name of the client
  name: string;

  // the provided doc string emitted as code comments
  docs?: string;

  // contains info for instantiable clients
  constructable?: ClientConstruction;

  // fields contains the ctor parameters that are
  // persisted as fields on the client type. note that
  // not all ctor params might be persisted.
  fields: Array<ClientParameter>;

  // all the methods for this client
  methods: Array<MethodType>;

  // indicates if the client includes a lifetime annotation
  lifetime?: types.Lifetime;

  // the parent client in a hierarchical client
  parent?: Client;
}

// ClientConstruction contains data for instantiable clients.
export interface ClientConstruction {
  // the client options type used in the constructors
  options: ClientOptions;

  // the constructor functions for a client.
  constructors: Array<Constructor>;
}

// ClientOptions is the struct containing optional client params
export interface ClientOptions extends types.Option {
  type: types.Struct;
}

// represents a client constructor function
export interface Constructor {
  name: string;

  // the modeled parameters. at minimum, an endpoint param
  parameters: Array<ClientParameter>;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// methods
///////////////////////////////////////////////////////////////////////////////////////////////////

// Method defines the possible method types
export type MethodType = AsyncMethod | ClientAccessor;

// AsyncMethod is an async Rust method
export interface AsyncMethod extends HTTPMethodBase {
  kind: 'async';

  // the params passed to the method (excluding self). can be empty
  params: Array<MethodParameter>;
}

// ClientAccessor is a method that returns a sub-client instance.
export interface ClientAccessor extends method.Method<Client> {
  kind: 'clientaccessor';

  // the client returned by the accessor method
  returns: Client;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// parameters
///////////////////////////////////////////////////////////////////////////////////////////////////

// ParameterLocation indicates where the value of the param originates
export type ParameterLocation = 'client' | 'method';

// ClientParameter defines the possible client parameter types
export type ClientParameter = URIParameter;

// MethodParameter defines the possible method parameter types
export type MethodParameter = BodyParameter | HeaderParameter | URIParameter;

// BodyParameter is a param that's passed via the HTTP request body
export interface BodyParameter extends HTTPParameterBase {
  kind: 'body';

  // the type of the body param
  type: types.RequestContent;
}

// HeaderParameter is a param that goes in a HTTP header
export interface HeaderParameter extends HTTPParameterBase {
  kind: 'header';

  // the header in the HTTP request
  header: string;

  // the type of the header param
  // note that not all types are applicable
  type: types.Type;
}

// MethodOptions is the struct containing optional method params
export interface MethodOptions extends types.Option {
  type: types.Struct;
}

// URIParameter is a full (i.e. non-templated) URI param
export interface URIParameter extends HTTPParameterBase {
  kind: 'uri';

  // URI params are passed as strings
  type: types.StringType;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

interface HTTPMethodBase extends method.Method<types.Type> {
  // the params passed to the method (excluding self). can be empty
  params: Array<HTTPParameterBase>;

  // the method options type for this method
  options: MethodOptions;

  // the type returned by the method
  returns: types.Result;
}

interface HTTPParameterBase extends method.Parameter {
  location: ParameterLocation;
}

class HTTPMethodBase extends method.Method<types.Type> implements HTTPMethodBase {
  constructor(name: string, pub: boolean, impl: string, self: method.Self) {
    super(name, pub, impl, self);
  }
}

class HTTPParameterBase extends method.Parameter {
  constructor(name: string, location: ParameterLocation, type: types.Type) {
    super(name, type);
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class AsyncMethod extends HTTPMethodBase implements AsyncMethod {
  constructor(name: string, client: Client, pub: boolean, options: MethodOptions) {
    super(name, pub, client.name, new method.Self(false, true));
    this.kind = 'async';
    this.params = new Array<MethodParameter>();
    this.options = options;
  }
}

export class BodyParameter extends HTTPParameterBase implements BodyParameter {
  constructor(name: string, location: ParameterLocation, type: types.RequestContent) {
    super(name, location, type);
    this.kind = 'body';
  }
}

export class Client implements Client {
  constructor(name: string) {
    this.kind = 'client';
    this.name = name;
    this.fields = new Array<ClientParameter>();
    this.methods = new Array<MethodType>();
  }
}

export class ClientAccessor extends method.Method<Client> implements ClientAccessor {
  constructor(name: string, client: Client, returns: Client) {
    super(name, true, client.name, new method.Self(false, true));
    this.kind = 'clientaccessor';
    this.params = new Array<MethodParameter>();
    this.returns = returns;
  }
}

export class ClientConstruction implements ClientConstruction {
  constructor(options: ClientOptions) {
    this.options = options;
    this.constructors = new Array<Constructor>();
  }
}

export class ClientOptions extends types.Option implements ClientOptions {
  constructor(type: types.Struct) {
    super(type, false);
  }
}

export class Constructor implements Constructor {
  constructor(name: string) {
    this.name = name;
    this.parameters = new Array<ClientParameter>();
  }
}

export class HeaderParameter extends HTTPParameterBase implements HeaderParameter {
  constructor(name: string, header: string, location: ParameterLocation, type: types.Type) {
    switch (type.kind) {
      case 'String':
      case 'enum':
      case 'literal':
      case 'scalar':
        super(name, location, type);
        this.kind = 'header';
        this.header = header;
        break;
      default:
        throw new Error(`unsupported header paramter type kind ${type.kind}`);
    }
  }
}

export class MethodOptions extends types.Option implements MethodOptions {
  constructor(type: types.Struct, ref: boolean) {
    super(type, ref);
  }
}

export class URIParameter extends HTTPParameterBase implements URIParameter {
  constructor(name: string, location: ParameterLocation, type: types.Type) {
    super(name, location, type);
    this.kind = 'uri';
  }
}
