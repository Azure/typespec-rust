/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import { EmitContext } from '@typespec/compiler';
import * as helpers from './helpers.js';
import * as naming from './naming.js';
import { RustEmitterOptions } from '../lib.js';
import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as rust from '../codemodel/index.js';

/** Adapter converts the tcgc code model to a Rust Crate */
export class Adapter {
  /**
   * Creates an Adapter for the specified EmitContext.
   * 
   * @param context the compiler context from which to create the Adapter
   * @returns 
   */
  static async create(context: EmitContext<RustEmitterOptions>): Promise<Adapter> {
    // @encodedName can be used in XML scenarios, it is effectively the
    // same as TypeSpec.Xml.@name. however, it's filtered out by default
    // so we need to add it to the allow list of decorators
    const ctx = await tcgc.createSdkContext(context, '@azure-tools/typespec-rust', {
      additionalDecorators: ['TypeSpec\\.@encodedName'],
    });
    return new Adapter(ctx, context.options);
  }

  private readonly crate: rust.Crate;
  private readonly ctx: tcgc.SdkContext;

  // cache of adapted types
  private readonly types: Map<string, rust.Type>;

  // cache of adapted client method params
  private readonly clientMethodParams: Map<string, rust.MethodParameter>;

  private constructor(ctx: tcgc.SdkContext, options: RustEmitterOptions) {
    this.types = new Map<string, rust.Type>();
    this.clientMethodParams = new Map<string, rust.MethodParameter>();
    this.ctx = ctx;

    let serviceType: rust.ServiceType = 'data-plane';
    if (this.ctx.arm === true) {
      serviceType = 'azure-arm';
    }

    this.crate = new rust.Crate(options['crate-name'], options['crate-version'], serviceType);
  }

  /** performs all the steps to convert tcgc to a crate */
  tcgcToCrate(): rust.Crate {
    this.adaptTypes();
    this.adaptClients();

    if (this.crate.enums.length > 0 || this.crate.models.length > 0) {
      this.crate.addDependency(new rust.CrateDependency('serde'));
    }

    if (this.crate.enums.length > 0 || this.crate.models.length > 0) {
      this.crate.addDependency(new rust.CrateDependency('typespec_client_core'));
    }

    if (this.crate.clients.length > 0) {
      this.crate.addDependency(new rust.CrateDependency('async-std'));
    }

    // TODO: remove once https://github.com/Azure/typespec-rust/issues/22 is fixed
    for (const client of this.crate.clients) {
      let done = false;
      for (const method of client.methods) {
        if (method.kind === 'pageable') {
          this.crate.addDependency(new rust.CrateDependency('futures'));
          done = true;
          break;
        }
      }
      if (done) {
        break;
      }
    }
    // end TODO

    this.crate.sortContent();
    return this.crate;
  }

  /** converts all tcgc types to their Rust type equivalent */
  private adaptTypes(): void {
    for (const sdkEnum of this.ctx.sdkPackage.enums) {
      if (<tcgc.UsageFlags>(sdkEnum.usage & tcgc.UsageFlags.ApiVersionEnum) === tcgc.UsageFlags.ApiVersionEnum) {
        // we skip generating the enums for API
        // versions as we expose it as a String
        continue;
      }
      const rustEnum = this.getEnum(sdkEnum);
      this.crate.enums.push(rustEnum);
    }

    for (const model of this.ctx.sdkPackage.models) {
      if (<tcgc.UsageFlags>(model.usage & tcgc.UsageFlags.Exception) === tcgc.UsageFlags.Exception && (model.usage & tcgc.UsageFlags.Input) === 0 && (model.usage & tcgc.UsageFlags.Output) === 0 || tcgc.isAzureCoreModel(model)) {
        // skip error and core types as we use their azure_core equivalents
        continue;
      }
      const rustModel = this.getModel(model);
      this.crate.models.push(rustModel);
    }
  }

  /**
   * converts a tcgc enum to a Rust enum
   * 
   * @param sdkEnum the tcgc enum to convert
   * @returns a Rust enum
   */
  private getEnum(sdkEnum: tcgc.SdkEnumType): rust.Enum {
    const enumName = codegen.capitalize(sdkEnum.name);
    let rustEnum = this.types.get(enumName);
    if (rustEnum) {
      return <rust.Enum>rustEnum;
    }

    // first create all of the enum values
    const values = new Array<rust.EnumValue>();
    for (const value of sdkEnum.values) {
      const rustEnumValue = new rust.EnumValue(helpers.fixUpEnumValueName(value.name), value.value);
      values.push(rustEnumValue);
    }

    rustEnum = new rust.Enum(enumName, sdkEnum.access === 'public', values, !sdkEnum.isFixed);
    this.types.set(enumName, rustEnum);

    return rustEnum;
  }

  /**
   * converts a tcgc model to a Rust model
   * 
   * @param model the tcgc model to convert
   * @returns a Rust model
   */
  private getModel(model: tcgc.SdkModelType): rust.Model {
    if (model.name.length === 0) {
      throw new Error('unnamed model'); // TODO: this might no longer be an issue
    }
    const modelName = codegen.capitalize(model.name);
    let rustModel = this.types.get(modelName);
    if (rustModel) {
      return <rust.Model>rustModel;
    }
    rustModel = new rust.Model(modelName, model.access === 'internal');
    rustModel.docs.summary = model.summary;
    rustModel.docs.description = model.doc;
    rustModel.xmlName = getXMLName(model.decorators);
    this.types.set(modelName, rustModel);

    for (const property of model.properties) {
      if (property.kind !== 'property') {
        if (property.type.kind === 'constant') {
          // typical case is content-type header.
          // we don't need to emit this as a field so skip it.
          continue;
        }
        // TODO: https://github.com/Azure/typespec-rust/issues/96
        throw new Error(`model property kind ${property.kind} NYI`);
      }
      const structField = this.getModelField(property, !rustModel.internal);
      rustModel.fields.push(structField);
    }

    return rustModel;
  }

  /**
   * converts a tcgc model property to a model field
   * 
   * @param property the tcgc model property to convert
   * @param isPubMod indicates if the model is public
   * @returns a Rust model field
   */
  private getModelField(property: tcgc.SdkBodyModelPropertyType, isPubMod: boolean): rust.ModelField {
    let fieldType = this.getType(property.type);

    // for public models each field is always an Option<T>
    if (isPubMod || property.optional) {
      fieldType = new rust.Option(fieldType);
    }

    const modelField = new rust.ModelField(naming.getEscapedReservedName(snakeCaseName(property.name), 'prop'), property.serializedName, true, fieldType);
    modelField.docs.summary = property.summary;
    modelField.docs.description = property.doc;

    const xmlName = getXMLName(property.decorators);
    if (xmlName) {
      // use the XML name when specified
      modelField.serde = xmlName;
    }
    modelField.xmlKind = getXMLKind(property.decorators, modelField);

    return modelField;
  }

  /** converts a tcgc type to a Rust type */
  private getType(type: tcgc.SdkType): rust.Type {
    const getScalar = (kind: 'boolean' | 'float32' | 'float64' | 'int16' | 'int32' | 'int64' | 'int8'): rust.Scalar => {
      let scalar = this.types.get(kind);
      if (scalar) {
        return <rust.Scalar>scalar;
      }

      let scalarType: rust.ScalarType;
      switch (kind) {
        case 'boolean':
          scalarType = 'bool';
          break;
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
      }

      scalar = new rust.Scalar(scalarType);
      this.types.set(kind, scalar);
      return scalar;
    };

    switch (type.kind) {
      case 'array': {
        const keyName = recursiveKeyName(type.kind, type.valueType);
        let vectorType = this.types.get(keyName);
        if (vectorType) {
          return vectorType;
        }
        vectorType = new rust.Vector(this.getType(type.valueType));
        this.types.set(keyName, vectorType);
        return vectorType;
      }
      case 'bytes': {
        let encoding: rust.BytesEncoding = 'std';
        if (type.encode === 'base64url') {
          encoding = 'url';
        }
        const keyName = `encodedBytes-${encoding}`;
        let encodedBytesType = this.types.get(keyName);
        if (encodedBytesType) {
          return encodedBytesType;
        }
        encodedBytesType = new rust.EncodedBytes(encoding);
        this.types.set(keyName, encodedBytesType);
        return encodedBytesType;
      }
      case 'constant':
        return this.getLiteral(type);
      case 'dict': {
        const keyName = recursiveKeyName(type.kind, type.valueType);
        let hashmapType = this.types.get(keyName);
        if (hashmapType) {
          return hashmapType;
        }
        hashmapType = new rust.HashMap(this.getType(type.valueType));
        this.types.set(keyName, hashmapType);
        return hashmapType;
      }
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
      case 'endpoint':
      case 'string':
      case 'url': {
        if (type.kind === 'string' && type.crossLanguageDefinitionId === 'Azure.Core.eTag') {
          const etagKey = 'etag';
          let etagType = this.types.get(etagKey);
          if (etagType) {
            return etagType;
          }
          etagType = new rust.Etag(this.crate);
          this.types.set(etagKey, etagType);
          return etagType;
        }
        let stringType = this.types.get(type.kind);
        if (stringType) {
          return stringType;
        }
        stringType = new rust.StringType();
        this.types.set(type.kind, stringType);
        return stringType;
      }
      case 'unknown': {
        let anyType = this.types.get(type.kind);
        if (anyType) {
          return anyType;
        }
        anyType = new rust.JsonValue(this.crate);
        this.types.set(type.kind, anyType);
        return anyType;
      }
      case 'utcDateTime': {
        const keyName = `${type.kind}-${type.encode}`;
        let timeType = this.types.get(keyName);
        if (timeType) {
          return timeType;
        }
        timeType = new rust.OffsetDateTime(this.crate, type.encode);
        this.types.set(keyName, timeType);
        return timeType;
      }
      default:
        throw new Error(`unhandled tcgc type ${type.kind}`);
    }
  }

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

  /**
   * converts a tcgc constant to a Rust literal
   * 
   * @param constType the constant to convert
   * @returns a Rust literal
   */
  private getLiteral(constType: tcgc.SdkConstantType): rust.Literal {
    const literalKey = `literal-${constType.value}`;
    let literalType = this.types.get(literalKey);
    if (literalType) {
      return <rust.Literal>literalType;
    }
    literalType = new rust.Literal(constType.value);
    this.types.set(literalKey, literalType);
    return literalType;
  }

  /** converts all tcgc clients and their methods into Rust clients/methods */
  private adaptClients(): void {
    for (const client of this.ctx.sdkPackage.clients) {
      if (client.methods.length === 0) {
        // skip generating empty clients
        continue;
      }

      // start with instantiable clients and recursively work down
      if (client.initialization.access === 'public') {
        this.recursiveAdaptClient(client);
      }
    }
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
    if (parent) {
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
    rustClient.docs.summary = client.summary;
    rustClient.docs.description = client.doc;
    rustClient.parent = parent;
    rustClient.fields.push(new rust.StructField('pipeline', false, new rust.ExternalType(this.crate, 'azure_core', 'Pipeline')));

    // anything other than public means non-instantiable client
    if (client.initialization.access === 'public') {
      const clientOptionsStruct = new rust.Struct(`${rustClient.name}Options`, true);
      const clientOptionsField = new rust.StructField('client_options', true, new rust.ExternalType(this.crate, 'azure_core', 'ClientOptions'));
      clientOptionsField.defaultValue = 'ClientOptions::default()';
      clientOptionsStruct.fields.push(clientOptionsField);
      rustClient.constructable = new rust.ClientConstruction(new rust.ClientOptions(clientOptionsStruct));

      // NOTE: per tcgc convention, if there is no param of kind credential
      // it means that the client doesn't require any kind of authentication.
      // HOWEVER, if there *is* a credential param, then the client *does not*
      // automatically support unauthenticated requests. a credential with
      // the noAuth scheme indicates support for unauthenticated requests.

      // bit flags for auth types
      enum AuthTypes {
        Default = 0, // unspecified
        NoAuth  = 1, // explicit NoAuth
        WithAut = 2, // explicit credential
      }

      let authType = AuthTypes.Default;

      const ctorParams = new Array<rust.ClientParameter>();
      for (const param of client.initialization.properties) {
        switch (param.kind) {
          case 'credential':
            switch (param.type.kind) {
              case 'credential':
                switch (param.type.scheme.type) {
                  case 'noAuth':
                    authType |= AuthTypes.NoAuth;
                    break;
                  case 'oauth2': {
                    authType |= AuthTypes.WithAut;
                    if (param.type.scheme.flows.length === 0) {
                      throw new Error(`no flows defined for credential type ${param.type.scheme.type}`);
                    }
                    const scopes = new Array<string>();
                    for (const scope of param.type.scheme.flows[0].scopes) {
                      scopes.push(scope.value);
                    }
                    const ctorTokenCredential = new rust.Constructor('new');
                    ctorTokenCredential.parameters.push(new rust.ClientParameter('credential', new rust.Arc(new rust.TokenCredential(this.crate, scopes)), true));
                    rustClient.constructable.constructors.push(ctorTokenCredential);
                    break;
                  }
                  default:
                    // TODO: https://github.com/Azure/typespec-rust/issues/57
                    throw new Error(`credential scheme type ${param.type.scheme.type} NYI`);
                }
                break;
              case 'union':
                // TODO: https://github.com/Azure/typespec-rust/issues/57
                continue;
            }
            break;
          case 'endpoint':
            // for Rust, we always require a complete endpoint param, templated
            // endpoints, e.g. https://{something}.contoso.com isn't supported.
            // note that the types of the param and the field are slightly different
            ctorParams.push(new rust.ClientParameter(param.name, new rust.StringSlice(), true, true));
            rustClient.fields.push(new rust.StructField(param.name, false, new rust.Url(this.crate)));
            break;
          case 'method': {
            let paramType: rust.Type;
            if (param.isApiVersionParam) {
              // we expose the api-version param as a String
              paramType = new rust.StringType();
            } else {
              paramType = this.getType(param.type);
            }

            const paramName = snakeCaseName(param.name);
            rustClient.fields.push(new rust.StructField(paramName, false, paramType));

            let required = true;
            // client-side default value makes the param optional
            if (param.optional || param.clientDefaultValue) {
              required = false;
              const paramField = new rust.StructField(paramName, true, paramType);
              clientOptionsStruct.fields.push(paramField);
              if (param.clientDefaultValue) {
                paramField.defaultValue = `String::from("${<string>param.clientDefaultValue}")`;
              }
            }
            ctorParams.push(new rust.ClientParameter(paramName, paramType, required));
            break;
          }
        }
      }

      if (authType === AuthTypes.Default || <AuthTypes>(authType & AuthTypes.NoAuth) === AuthTypes.NoAuth) {
        const ctorWithNoCredential = new rust.Constructor('with_no_credential');
        rustClient.constructable.constructors.push(ctorWithNoCredential);
      }

      // propagate ctor params to all client ctors
      for (const constructor of rustClient.constructable.constructors) {
        constructor.parameters.push(...ctorParams);
        // ensure param order of endpoint, credential, other
        helpers.sortClientParameters(constructor.parameters);
      }
    } else if (parent) {
      // this is a sub-client. it will share the fields of the parent.
      // NOTE: we must propagate parant params before a potential recursive call
      // to create a child client that will need to inherit our client params.
      rustClient.fields = parent.fields;
    } else {
      throw new Error(`uninstantiable client ${client.name} has no parent`);
    }

    for (const method of client.methods) {
      if (method.kind === 'clientaccessor') {
        const subClient = this.recursiveAdaptClient(method.response, rustClient);
        const clientAccessor = new rust.ClientAccessor(`get_${snakeCaseName(subClient.name)}`, rustClient, subClient);
        clientAccessor.docs.summary = `Returns a new instance of ${subClient.name}.`;
        rustClient.methods.push(clientAccessor);
      } else {
        this.adaptMethod(method, rustClient);
      }
    }

    this.crate.clients.push(rustClient);
    return rustClient;
  }

  /**
   * converts a tcgc method to a Rust method for the specified client
   * 
   * @param method the tcgc method to convert
   * @param rustClient the client to which the method belongs
   */
  private adaptMethod(method: tcgc.SdkServiceMethod<tcgc.SdkHttpOperation>, rustClient: rust.Client): void {
    let rustMethod: rust.MethodType;
    const optionsLifetime = new rust.Lifetime('a');
    const methodOptionsStruct = new rust.Struct(`${rustClient.name}${codegen.pascalCase(method.name)}Options`, true);
    methodOptionsStruct.lifetime = optionsLifetime;

    const clientMethodOptions = new rust.ExternalType(this.crate, 'azure_core', 'ClientMethodOptions');
    clientMethodOptions.lifetime = optionsLifetime;
    methodOptionsStruct.fields.push(new rust.StructField('method_options', true, clientMethodOptions));

    const methodName = naming.getEscapedReservedName(snakeCaseName(method.name), 'fn');
    const pub = method.access === 'public';
    const methodOptions = new rust.MethodOptions(methodOptionsStruct);
    const httpMethod = method.operation.verb;

    // if path is more than just "/" strip off any leading forward slash.
    // this is because Url::join will treat the path as absolute, overwriting
    // any existing path on the endpoint.
    // e.g. if endpoint is https://contoso.com/foo/bar and httpPath is /some/sub/path
    // then calling Url::join will provide result https://contoso.com/some/sub/path
    // which is not what we want.
    let httpPath = method.operation.path;
    if (httpPath.length > 1 && httpPath[0] === '/') {
      httpPath = httpPath.slice(1);
    }

    switch (method.kind) {
      case 'basic':
        rustMethod = new rust.AsyncMethod(methodName, rustClient, pub, methodOptions, httpMethod, httpPath);
        break;
      case 'paging':
        rustMethod = new rust.PageableMethod(methodName, rustClient, pub, methodOptions, httpMethod, httpPath);
        if (method.nextLinkOperation) {
          // TODO: https://github.com/Azure/autorest.rust/issues/103
          throw new Error('next page operation NYI');
        } else if (method.nextLinkPath) {
          // this is the name of the field in the response type that contains the next link URL
          if (method.nextLinkPath.indexOf('.') > 0) {
            // TODO: https://github.com/Azure/autorest.rust/issues/102
            throw new Error('nested next link path NYI');
          }
          rustMethod.strategy = new rust.PageableStrategyNextLink(naming.getEscapedReservedName(snakeCaseName(method.nextLinkPath), 'prop'));
        }
        break;
      default:
        throw new Error(`method kind ${method.kind} NYI`);
    }

    rustMethod.docs.summary = method.summary;
    rustMethod.docs.description = method.doc;
    rustClient.methods.push(rustMethod);

    // stuff all of the operation parameters into one array for easy traversal
    const allOpParams = new Array<OperationParamType>();
    allOpParams.push(...method.operation.parameters);
    if (method.operation.bodyParam) {
      allOpParams.push(method.operation.bodyParam);
    }

    for (const param of method.parameters) {
      // we need to translate from the method param to its underlying operation param.
      // most params have a one-to-one mapping. however, for spread params, there will
      // be a many-to-one mapping. i.e. multiple params will map to the same underlying
      // operation param. each param corresponds to a field within the operation param.
      const opParam = values(allOpParams).where((opParam: OperationParamType) => {
        return values(opParam.correspondingMethodParams).where((methodParam: tcgc.SdkModelPropertyType) => {
          return methodParam.name === param.name;
        }).any();
      }).first();

      if (!opParam) {
        throw new Error(`didn't find operation parameter for method ${method.name} parameter ${param.name}`);
      }

      let adaptedParam: rust.MethodParameter;
      // for spread params there are two cases we need to consider.
      // if the method param's type doesn't match the op param's type then it's a spread param
      // - e.g. method param's type is string/int/etc which is a field in the op param's body type
      // if the method param's type DOES match the op param's type and the op param has multiple corresponding method params, it's a spread param
      // - e.g. op param is an intersection of multiple model types, and each model type is exposed as a discrete param
      if (opParam.kind === 'body' && opParam.type.kind === 'model' && (opParam.type.kind !== param.type.kind || opParam.correspondingMethodParams.length > 1)) {
        adaptedParam = this.adaptMethodSpreadParameter(param, this.adaptBodyFormat(opParam.defaultContentType), opParam.type);
      } else {
        adaptedParam = this.adaptMethodParameter(opParam);
      }

      adaptedParam.docs.summary = param.summary;
      adaptedParam.docs.description = param.doc;
      rustMethod.params.push(adaptedParam);

      if (adaptedParam.optional) {
        let fieldType: rust.Type;
        if (adaptedParam.kind === 'partialBody') {
          // for partial body params, adaptedParam.type is the model type that's
          // sent in the request. we want the field within the model for this param.
          // NOTE: if the param is optional then the field is optional, thus it's
          // already wrapped in an Option<T> type.
          const field = adaptedParam.type.type.fields.find(f => { return f.name === adaptedParam.name; });
          if (!field) {
            throw new Error(`didn't find spread param field ${adaptedParam.name} in type ${adaptedParam.type.type.name}`);
          }
          fieldType = field.type;
        } else {
          fieldType = new rust.Option(adaptedParam.type);
        }
        rustMethod.options.type.fields.push(new rust.StructField(adaptedParam.name, true, fieldType));
      }
    }

    // client params aren't included in method.parameters so
    // look for them in the remaining operation parameters.
    for (const opParam of allOpParams) {
      if (opParam.onClient) {
        const adaptedParam = this.adaptMethodParameter(opParam);
        adaptedParam.docs.summary = opParam.summary;
        adaptedParam.docs.description = opParam.doc;
        rustMethod.params.push(adaptedParam);
      }
    }

    const getBodyFormat = (): rust.BodyFormat => {
      // fetch the body format from the HTTP responses.
      // they should all have the same type so no need to match responses to type.
      let defaultContentType: string | undefined;
      for (const httpResp of method.operation.responses) {
        if (defaultContentType && httpResp.defaultContentType && defaultContentType !== httpResp.defaultContentType) {
          throw new Error(`method ${method.name} has conflicting content types`);
        }
        defaultContentType = httpResp.defaultContentType;
      }

      if (!defaultContentType) {
        throw new Error(`unable to determine content type for method ${method.name}`);
      }

      return this.adaptBodyFormat(defaultContentType);
    };

    let returnType: rust.Type;
    if (method.kind === 'paging') {
      // for paged methods, tcgc models method.response.type as an Array<T>.
      // however, we want the synthesized paged response envelope type instead.
      const synthesizedType = method.operation.responses[0].type;
      if (!synthesizedType) {
        throw new Error(`paged method ${method.name} has no synthesized response type`);
      } else if (synthesizedType.kind !== 'model') {
        throw new Error(`paged method ${method.name} synthesized response type has unexpected kind ${synthesizedType.kind}`);
      }

      const format = getBodyFormat();
      const synthesizedModel = this.getModel(synthesizedType);
      if (!this.crate.models.includes(synthesizedModel)) {
        this.crate.models.push(synthesizedModel);
      }
      returnType = new rust.Pager(this.crate, synthesizedModel, format);
    } else if (method.response.type) {
      const format = getBodyFormat();
      // until https://github.com/Azure/typespec-azure/issues/614 is resolved
      // we have to look at the format to determine if the response is a streaming
      // binary response. at present, it's represented as a base-64 encoded byte
      // array which is clearly wrong.
      let respType: rust.Type;
      if (format === 'binary') {
        respType = this.getUnitType();
      } else {
        respType = this.getType(method.response.type);
      }

      returnType = new rust.Response(this.crate, respType, format);
    } else {
      returnType = new rust.Response(this.crate, this.getUnitType());
    }
    rustMethod.returns = new rust.Result(this.crate, returnType);
  }

  /**
   * converts a tcgc operation parameter into a Rust method parameter
   * 
   * @param param the tcgc operation parameter to convert
   * @returns a Rust method parameter
   */
  private adaptMethodParameter(param: OperationParamType): rust.MethodParameter {
    const paramLoc = param.onClient ? 'client' : 'method';

    // if this is a client method param, check if we've already adapted it
    if (paramLoc === 'client') {
      const clientMethodParam = this.clientMethodParams.get(param.name);
      if (clientMethodParam) {
        return clientMethodParam;
      }
    }

    const paramName = naming.getEscapedReservedName(snakeCaseName(param.name), 'param');
    const paramType = this.getType(param.type);

    let adaptedParam: rust.MethodParameter;
    switch (param.kind) {
      case 'body': {
        adaptedParam = new rust.BodyParameter(paramName, paramLoc, param.optional, new rust.RequestContent(this.crate, paramType, this.adaptBodyFormat(param.defaultContentType)));
        break;
      }
      case 'header':
        if (param.collectionFormat) {
          if (paramType.kind !== 'vector') {
            throw new Error(`unexpected kind ${paramType.kind} for HeaderCollectionParameter`);
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
              throw new Error(`unexpected format ${param.collectionFormat} for HeaderCollectionParameter`);
          }
          adaptedParam = new rust.HeaderCollectionParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, format);
        } else if (param.serializedName === 'x-ms-meta') {
          if (paramType.kind !== 'hashmap') {
            throw new Error(`unexpected kind ${paramType.kind} for header ${param.serializedName}`);
          }
          adaptedParam = new rust.HeaderHashMapParameter(paramName, param.serializedName, paramLoc, param.optional, paramType);
        } else {
          adaptedParam = new rust.HeaderParameter(paramName, param.serializedName, paramLoc, param.optional, paramType);
        }
        break;
      case 'path':
        adaptedParam = new rust.PathParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, param.urlEncode);
        break;
      case 'query':
        if (param.collectionFormat) {
          const format = param.collectionFormat === 'simple' ? 'csv' : (param.collectionFormat === 'form' ? 'multi' : param.collectionFormat);
          if (paramType.kind !== 'vector') {
            throw new Error(`unexpected kind ${paramType.kind} for QueryCollectionParameter`);
          }
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryCollectionParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true, format);
        } else {
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true);
        }
        break;
    }

    adaptedParam.docs.summary = param.summary;
    adaptedParam.docs.description = param.doc;

    if (paramLoc === 'client') {
      this.clientMethodParams.set(param.name, adaptedParam);
    }

    return adaptedParam;
  }

  /**
   * converts a tcgc spread parameter into a Rust partial body parameter.
   * 
   * @param param the tcgc method parameter to convert
   * @param format the wire format for the underlying body type
   * @param opParamType the tcgc model to which the spread parameter belongs
   * @returns a Rust partial body parameter
   */
  private adaptMethodSpreadParameter(param: tcgc.SdkMethodParameter, format: rust.BodyFormat, opParamType: tcgc.SdkModelType): rust.PartialBodyParameter {
    switch (format) {
      case 'binary':
        throw new Error('binary spread NYI');
      case 'json':
      case 'xml': {
        // find the corresponding field within the model so we can get its index
        let serializedName: string | undefined;
        for (const property of opParamType.properties) {
          if (property.name === param.name) {
            serializedName = (<tcgc.SdkBodyModelPropertyType>property).serializedName;
            break;
          }
        }

        if (serializedName === undefined) {
          throw new Error(`didn't find body model property for spread parameter ${param.name}`);
        }

        const paramLoc: rust.ParameterLocation = 'method';
        const paramType = this.getType(opParamType);
        if (paramType.kind !== 'model') {
          throw new Error(`unexpected kind ${paramType.kind} for spread body param`);
        }
        const paramName = naming.getEscapedReservedName(snakeCaseName(param.name), 'param');
        return new rust.PartialBodyParameter(paramName, paramLoc, param.optional, serializedName, new rust.RequestContent(this.crate, paramType, format));
      }
    }
  }

  /**
   * converts a Content-Type header value into a Rust body format
   * 
   * @param contentType the value of the Content-Type header
   * @returns a Rust body format
   */
  private adaptBodyFormat(contentType: string): rust.BodyFormat {
    // we only recognize/support JSON, text, and XML content types, so assume anything else is binary
    // NOTE: we check XML before text in order to support text/xml
    let bodyFormat: rust.BodyFormat = 'binary';
    if (contentType.match(/json/i)) {
      this.crate.addDependency(new rust.CrateDependency('serde_json'));
      bodyFormat = 'json';
    } else if (contentType.match(/xml/i)) {
      bodyFormat = 'xml';
    } else if (contentType.match(/text/i)) {
      throw new Error(`unhandled contentType ${contentType}`);
    }
    return bodyFormat;
  }
}

/**
 * snake-cases the provided name
 * 
 * @param name the name to snake-case
 * @returns name in snake-case format
 */
function snakeCaseName(name: string): string {
  return codegen.deconstruct(name).join('_');
}

type OperationParamType = tcgc.SdkBodyParameter | tcgc.SdkHeaderParameter | tcgc.SdkPathParameter | tcgc.SdkQueryParameter;

/**
 * recursively creates a map key from the specified type.
 * this is idempotent so providing the same type will create
 * the same key.
 * 
 * obj is recursively unwrapped, and each layer is used to construct
 * the key. e.g. if obj is a HashMap<String, Vec<i32>> this would
 * unwrap to dict-array-int32.
 * 
 * @param root the starting value for the key
 * @param obj the type for which to create the key
 * @returns a string containing the complete map key
 */
function recursiveKeyName(root: string, obj: tcgc.SdkType): string {
  switch (obj.kind) {
    case 'array':
      return recursiveKeyName(`${root}-array`, obj.valueType);
    case 'enum':
      return `${root}-${obj.name}`;
    case 'enumvalue':
      return `${root}-${obj.enumType.name}-${obj.value}`;
    case 'dict':
      return recursiveKeyName(`${root}-dict`, obj.valueType);
    case 'plainDate':
      return `${root}-plainDate`;
    case 'utcDateTime':
      return `${root}-${obj.encode}`;
    case 'duration':
      // TODO: this should be: return `${root}-duration-${obj.encode}`;
      // as it is now, it treats the duration as a String
      // https://github.com/Azure/typespec-rust/issues/41
      return `${root}-${obj.wireType.kind}`;
    case 'model':
      return `${root}-${obj.name}`;
    case 'nullable':
      return recursiveKeyName(root, obj.type);
    case 'plainTime':
      return `${root}-plainTime`;
    default:
      return `${root}-${obj.kind}`;
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
        const fieldType = helpers.unwrapOption(field.type);
        switch (fieldType.kind) {
          case 'vector':
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
