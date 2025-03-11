/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
import { DateTimeKnownEncoding, EmitContext, NoTarget } from '@typespec/compiler';
import * as http from '@typespec/http';
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
      additionalDecorators: ['TypeSpec\\.@encodedName', '@clientName'],
      disableUsageAccessPropagationToBase: true,
    });
    return new Adapter(ctx, context.options);
  }

  private readonly crate: rust.Crate;
  private readonly ctx: tcgc.SdkContext;

  // cache of adapted types
  private readonly types: Map<string, rust.Type>;

  // cache of adapted client method params
  private readonly clientMethodParams: Map<string, rust.MethodParameter>;

  // contains methods that have been renamed
  private readonly renamedMethods: Set<string>;

  private constructor(ctx: tcgc.SdkContext, options: RustEmitterOptions) {
    this.types = new Map<string, rust.Type>();
    this.clientMethodParams = new Map<string, rust.MethodParameter>();
    this.renamedMethods = new Set<string>();
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

    if (this.crate.clients.length > 0 || this.crate.enums.length > 0 || this.crate.models.length > 0) {
      this.crate.addDependency(new rust.CrateDependency('typespec_client_core', ['derive']));
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

  /** converts tcgc docs to formatted rust.Docs */
  private adaptDocs(summary?: string, doc?: string): rust.Docs {
    if (summary) {
      summary = helpers.formatDocs(summary);
    }
    if (doc) {
      doc = helpers.formatDocs(doc);
    }
    return {
      summary: summary,
      description: doc,
    }
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
      if ((<tcgc.UsageFlags>(model.usage & tcgc.UsageFlags.Exception) === tcgc.UsageFlags.Exception && (model.usage & tcgc.UsageFlags.Input) === 0 && (model.usage & tcgc.UsageFlags.Output) === 0) || tcgc.isAzureCoreModel(model)) {
        // skip error and core types as we use their azure_core equivalents
        continue;
      }
      const rustModel = this.getModel(model);
      this.crate.models.push(rustModel);
      // presence of models requires the derive feature
      this.crate.addDependency(new rust.CrateDependency('typespec_client_core', ['derive']));
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

    rustEnum = new rust.Enum(enumName, sdkEnum.access === 'public', !sdkEnum.isFixed);
    rustEnum.docs = this.adaptDocs(sdkEnum.summary, sdkEnum.doc);
    this.types.set(enumName, rustEnum);

    for (const value of sdkEnum.values) {
      const rustEnumValue = new rust.EnumValue(helpers.fixUpEnumValueName(value.name), rustEnum, value.value);
      rustEnumValue.docs = this.adaptDocs(value.summary, value.doc);
      rustEnum.values.push(rustEnumValue);
    }

    return rustEnum;
  }

  /**
   * converts a tcgc enumvalue to a Rust enum value.
   * this is typically used when a literal enum value is specified.
   * 
   * @param sdkEnumValue the tcgc enumvalue to convert
   * @returns a Rust enum value
   */
  private getEnumValue(sdkEnumValue: tcgc.SdkEnumValueType): rust.EnumValue {
    const enumType = this.getEnum(sdkEnumValue.enumType);
    // find the specified enum value
    for (const value of enumType.values) {
      if (value.name === helpers.fixUpEnumValueName(sdkEnumValue.name)) {
        return value;
      }
    }
    throw new Error(`didn't find enum value for name ${sdkEnumValue.name} in enum ${enumType.name}`);
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

    let modelFlags = rust.ModelFlags.Unspecified;
    if (<tcgc.UsageFlags>(model.usage & tcgc.UsageFlags.Input) === tcgc.UsageFlags.Input) {
      modelFlags |= rust.ModelFlags.Input;
    }
    if (<tcgc.UsageFlags>(model.usage & tcgc.UsageFlags.Output) === tcgc.UsageFlags.Output) {
      modelFlags |= rust.ModelFlags.Output;
    }

    rustModel = new rust.Model(modelName, model.access === 'internal', modelFlags);
    rustModel.docs = this.adaptDocs(model.summary, model.doc);
    rustModel.xmlName = getXMLName(model.decorators);
    this.types.set(modelName, rustModel);

    // aggregate the properties from the provided type and its parent types
    const allProps = new Array<tcgc.SdkModelPropertyType>();
    for (const prop of model.properties) {
      allProps.push(prop);
    }

    let parent = model.baseModel;
    while (parent) {
      for (const parentProp of parent.properties) {
        const exists = values(allProps).where(p => { return p.name === parentProp.name; }).first();
        if (exists) {
          // don't add the duplicate. the TS compiler has better enforcement than OpenAPI
          // to ensure that duplicate fields with different types aren't added.
          continue;
        }
        allProps.push(parentProp);
      }

      // TODO: propagate additional properties https://github.com/Azure/typespec-rust/issues/4
      parent = parent.baseModel;
    }

    for (const property of allProps) {
      if (property.kind !== 'property') {
        if (property.type.kind === 'constant') {
          // typical case is content-type header.
          // we don't need to emit this as a field so skip it.
          continue;
        } else if (property.kind === 'path') {
          // a property of kind path is the model key and
          // will be exposed as a discrete method parameter.
          // we just adapt it here as a regular model field.
        } else {
          throw new Error(`model property kind ${property.kind} NYI`);
        }
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
  private getModelField(property: tcgc.SdkBodyModelPropertyType | tcgc.SdkPathParameter, isPubMod: boolean): rust.ModelField {
    let fieldType = this.getType(property.type);

    // for public models each field is always an Option<T>.
    // the only exception is for HashMap and Vec since an
    // empty collection conveys the same semantics.
    if ((isPubMod || property.optional) && fieldType.kind !== 'hashmap' && fieldType.kind !== 'Vec') {
      fieldType = new rust.Option(fieldType);
    }

    const modelField = new rust.ModelField(naming.getEscapedReservedName(snakeCaseName(property.name), 'prop'), property.serializedName, true, fieldType);
    modelField.docs = this.adaptDocs(property.summary, property.doc);

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
    const getDateTimeEncoding = (encoding: DateTimeKnownEncoding): rust.DateTimeEncoding => {
      switch (encoding) {
        case 'rfc3339':
        case 'rfc7231':
          return encoding;
        case 'unixTimestamp':
          return 'unix_time';
      }
    };

    type scalarKind = 'boolean' | 'float' | 'float32' | 'float64' | 'int16' | 'int32' | 'int64' | 'int8' | 'uint16' | 'uint32' | 'uint64' | 'uint8';
    const getScalar = (kind: scalarKind): rust.Scalar => {
      let scalar = this.types.get(kind);
      if (scalar) {
        return <rust.Scalar>scalar;
      }

      let scalarType: rust.ScalarType;
      switch (kind) {
        case 'boolean':
          scalarType = 'bool';
          break;
        case 'float':
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
        case 'uint16':
          scalarType = 'u16';
          break;
        case 'uint32':
          scalarType = 'u32';
          break;
        case 'uint64':
          scalarType = 'u64';
          break;
        case 'uint8':
          scalarType = 'u8';
          break;
      }

      scalar = new rust.Scalar(scalarType);
      this.types.set(kind, scalar);
      return scalar;
    };

    const getStringType = (): rust.Type => {
      let stringType = this.types.get(type.kind);
      if (stringType) {
        return stringType;
      }
      stringType = new rust.StringType();
      this.types.set(type.kind, stringType);
      return stringType;
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
      case 'duration':
        switch (type.wireType.kind) {
          case 'float':
          case 'float32':
          case 'float64':
          case 'int32':
          case 'int64':
            return getScalar(type.wireType.kind);
          case 'string':
            return getStringType();
          default:
            throw new Error(`unhandled duration wireType.kind ${type.wireType.kind}`);
        }
      case 'boolean':
      case 'float32':
      case 'float64':
      case 'int16':
      case 'int32':
      case 'int64':
      case 'int8':
      case 'uint16':
      case 'uint32':
      case 'uint64':
      case 'uint8':
        return getScalar(type.kind);
      case 'enum':
        return this.getEnum(type);
      case 'enumvalue':
        return this.getEnumValue(type);
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
        return getStringType();
      }
      case 'offsetDateTime': {
        const keyName = `${type.kind}-${type.encode}`;
        let timeType = this.types.get(keyName);
        if (timeType) {
          return timeType;
        }
        timeType = new rust.OffsetDateTime(this.crate, getDateTimeEncoding(type.encode), false);
        this.types.set(keyName, timeType);
        return timeType;
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
        timeType = new rust.OffsetDateTime(this.crate, getDateTimeEncoding(type.encode), true);
        this.types.set(keyName, timeType);
        return timeType;
      }
      default:
        throw new Error(`unhandled tcgc type ${type.kind}`);
    }
  }

  /** returns the Rust string slice type */
  private getStringSlice(): rust.StringSlice {
    const typeKey = 'str';
    let stringSlice = this.types.get(typeKey);
    if (!stringSlice) {
      stringSlice = new rust.StringSlice();
      this.types.set(typeKey, stringSlice);
    }
    return <rust.StringSlice>stringSlice;
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
      if (client.clientInitialization.initializedBy & tcgc.InitializedByFlags.Individually) {
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
    // NOTE: if the client has the @clientName decorator applied then use that verbatim
    if (parent && !client.decorators.find((decorator) => decorator.name === 'Azure.ClientGenerator.Core.@clientName')) {
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
    rustClient.docs = this.adaptDocs(client.summary, client.doc);
    rustClient.parent = parent;
    rustClient.fields.push(new rust.StructField('pipeline', false, new rust.ExternalType(this.crate, 'azure_core', 'Pipeline')));

    // anything other than public means non-instantiable client
    if (client.clientInitialization.initializedBy & tcgc.InitializedByFlags.Individually) {
      const clientOptionsStruct = new rust.Struct(`${rustClient.name}Options`, true);
      const clientOptionsField = new rust.StructField('client_options', true, new rust.ExternalType(this.crate, 'azure_core', 'ClientOptions'));
      clientOptionsField.defaultValue = 'ClientOptions::default()';
      clientOptionsStruct.fields.push(clientOptionsField);
      rustClient.constructable = new rust.ClientConstruction(new rust.ClientOptions(clientOptionsStruct));
      // NOTE: must call buildClientDocPath() after setting rustClient.constructable
      clientOptionsStruct.docs.summary = `Options used when creating a [\`${rustClient.name}\`](${buildClientDocPath(rustClient)})`;

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

      /**
       * processes a credendial, potentially adding its supporting client constructor
       * 
       * @param cred the credential type to process
       * @param constructable the constructable for the current Rust client
       * @param throwOnDefault when true, throws an error on unsupported credential types
       * @returns the AuthTypes enum for the credential that was handled, or AuthTypes.Default if none were
       */
      const processCredential = (rustClient: rust.Client, cred: http.HttpAuth, constructable: rust.ClientConstruction, throwOnDefault: boolean): AuthTypes => {
        switch (cred.type) {
          case 'noAuth':
            return AuthTypes.NoAuth;
          case 'oauth2': {
            constructable.constructors.push(this.createTokenCredentialCtor(rustClient, cred));
            return AuthTypes.WithAut;
          }
          default:
            if (throwOnDefault) {
              throw new Error(`credential scheme type ${cred.type} NYI`);
            }
            return AuthTypes.Default;
        }
      };

      const ctorParams = new Array<rust.ClientParameter>();
      for (const param of client.clientInitialization.parameters) {
        switch (param.kind) {
          case 'credential':
            switch (param.type.kind) {
              case 'credential':
                authType |= processCredential(rustClient, param.type.scheme, rustClient.constructable, true);
                break;
              case 'union': {
                const variantKinds = new Array<string>();
                for (const variantType of param.type.variantTypes) {
                  variantKinds.push(variantType.scheme.type);
                  // if OAuth2 is specified then emit that and skip any unsupported ones.
                  // this prevents emitting the with_no_credential constructor in cases
                  // where it might not actually be supported.
                  authType |= processCredential(rustClient, variantType.scheme, rustClient.constructable, false);
                }

                // no supported credential types were specified
                if (authType === AuthTypes.Default) {
                  throw new Error(`credential scheme types ${variantKinds.join()} NYI`);
                }
                continue;
              }
            }
            break;
          case 'endpoint': {
            let endpointType: tcgc.SdkEndpointType;
            switch (param.type.kind) {
              case 'endpoint':
                // single endpoint without any supplemental path
                endpointType = param.type;
                break;
              case 'union':
                // this is a union of endpoints. the first is the endpoint plus
                // the supplemental path. the second is a "raw" endpoint which
                // requires the caller to provide the complete endpoint. we only
                // expose the former at present. languages that support overloads
                // MAY support both but it's not a requirement.
                endpointType = param.type.variantTypes[0];
            }

            for (let i = 0; i < endpointType.templateArguments.length; ++i) {
              const templateArg = endpointType.templateArguments[i];
              if (i === 0) {
                // the first template arg is always the endpoint parameter.
                // note that the types of the param and the field are different.
                // NOTE: we use param.name here instead of templateArg.name as
                // the former has the fixed name "endpoint" which is what we want.
                const adaptedParam = new rust.ClientMethodParameter(param.name, this.getStringSlice(), false, true);
                adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
                ctorParams.push(adaptedParam);
                rustClient.fields.push(new rust.StructField(param.name, false, new rust.Url(this.crate)));

                // if the server's URL is *only* the endpoint parameter then we're done.
                // this is the param.type.kind === 'endpoint' case.
                if (endpointType.serverUrl === `{${templateArg.serializedName}}`) {
                  break;
                }

                // there's either a suffix on the endpoint param, more template arguments, or both.
                // either way we need to create supplemental info on the constructable.
                // NOTE: we remove the {endpoint} segment and trailing forward slash as we use
                // Url::join to concatenate the two and not string replacement.
                let serverUrl = endpointType.serverUrl.replace(`{${templateArg.serializedName}}/`, '');

                // NOTE: the behavior of Url::join requires that the path ends with a forward slash.
                // if there are any query params, splice it in as required else just append it.
                if (serverUrl.includes('?')) {
                  if (serverUrl[serverUrl.indexOf('?')-1] !== '/') {
                    serverUrl = serverUrl.replace('?', '/?');
                  }
                } else if (serverUrl[serverUrl.length - 1] !== '/') {
                  serverUrl += '/';
                }

                rustClient.constructable.endpoint = new rust.SupplementalEndpoint(serverUrl);
                continue;
              }

              const clientParam = this.adaptClientParameter(templateArg, rustClient.constructable);
              if (clientParam.kind !== 'clientEndpoint') {
                throw new Error(`unexpected client parameter kind ${clientParam.kind}`);
              }
              rustClient.constructable.endpoint?.parameters.push(clientParam);
              ctorParams.push(clientParam);
            }
            break;
          }
          case 'method': {
            const clientParam = this.adaptClientParameter(param, rustClient.constructable);
            rustClient.fields.push(new rust.StructField(clientParam.name, false, clientParam.type));
            ctorParams.push(clientParam);
            break;
          }
        }
      }

      if (authType === AuthTypes.Default || <AuthTypes>(authType & AuthTypes.NoAuth) === AuthTypes.NoAuth) {
        const ctorWithNoCredential = new rust.Constructor('with_no_credential');
        ctorWithNoCredential.docs.summary = `Creates a new ${rustClient.name} requiring no authentication.`;
        rustClient.constructable.constructors.push(ctorWithNoCredential);
      }

      // propagate ctor params to all client ctors
      for (const constructor of rustClient.constructable.constructors) {
        constructor.params.push(...ctorParams);
        // ensure param order of endpoint, credential, other
        helpers.sortClientParameters(constructor.params);
      }
    } else if (parent) {
      // this is a sub-client. it will share the fields of the parent.
      // NOTE: we must propagate parant params before a potential recursive call
      // to create a child client that will need to inherit our client params.
      // also note that we need to make a copy of the fields array so that
      // adding client-unique fields don't inadvertently get shared.
      rustClient.fields = new Array<rust.StructField>(...parent.fields);

      // adapt any unique fields on this client
      for (const prop of client.clientInitialization.parameters) {
        if (prop.kind !== 'method' || prop.isApiVersionParam) {
          // we don't need to care about non-method properties (e.g. credential)
          // or the API version property as these are handled in the parent client.
          continue;
        }
        const name = snakeCaseName(prop.name);
        if (rustClient.fields.find((v) => v.name === name)) {
          continue;
        }
        rustClient.fields.push(new rust.StructField(name, false, this.getType(prop.type)));
      }
    } else {
      throw new Error(`uninstantiable client ${client.name} has no parent`);
    }

    for (const method of client.methods) {
      if (method.kind === 'clientaccessor') {
        const subClient = this.recursiveAdaptClient(method.response, rustClient);
        this.adaptClientAccessor(client, method, rustClient, subClient);
      } else {
        this.adaptMethod(method, rustClient);
      }
    }

    this.crate.clients.push(rustClient);
    return rustClient;
  }

  /**
   * creates a client constructor for the TokenCredential type.
   * the constructor is named new.
   * 
   * @param cred the OAuth2 credential to adapt
   * @returns a client constructor for TokenCredential
   */
  private createTokenCredentialCtor(rustClient: rust.Client, cred: http.Oauth2Auth<http.OAuth2Flow[]>): rust.Constructor {
    if (cred.flows.length === 0) {
      throw new Error(`no flows defined for credential type ${cred.type}`);
    }
    const scopes = new Array<string>();
    for (const scope of cred.flows[0].scopes) {
      scopes.push(scope.value);
    }
    const ctorTokenCredential = new rust.Constructor('new');
    const tokenCredParam = new rust.ClientMethodParameter('credential', new rust.Arc(new rust.TokenCredential(this.crate, scopes)), false);
    tokenCredParam.docs.summary = `An implementation of [\`TokenCredential\`](azure_core::credentials::TokenCredential) that can provide an Entra ID token to use when authenticating.`;
    ctorTokenCredential.params.push(tokenCredParam);
    ctorTokenCredential.docs.summary = `Creates a new ${rustClient.name}, using Entra ID authentication.`;
    return ctorTokenCredential;
  }

  /**
   * converts a tcgc client parameter to a Rust client parameter
   * 
   * @param param the tcgc client parameter to convert
   * @param constructable contains client construction info. if the param is optional, it will go in the options type
   * @returns the Rust client parameter
   */
  private adaptClientParameter(param: tcgc.SdkMethodParameter | tcgc.SdkPathParameter, constructable: rust.ClientConstruction): rust.ClientParameter {
    let paramType: rust.Type;
    if (param.isApiVersionParam) {
      // we expose the api-version param as a String
      paramType = new rust.StringType();
    } else {
      paramType = this.getType(param.type);
    }

    const paramName = snakeCaseName(param.name);

    let optional = false;
    // client-side default value makes the param optional
    if (param.optional || param.clientDefaultValue) {
      optional = true;
      const paramField = new rust.StructField(paramName, true, paramType);
      constructable.options.type.fields.push(paramField);
      if (param.clientDefaultValue) {
        paramField.defaultValue = `String::from("${<string>param.clientDefaultValue}")`;
      }
    }

    let adaptedParam: rust.ClientParameter;
    switch (param.kind) {
      case 'method':
        adaptedParam = new rust.ClientMethodParameter(paramName, paramType, optional);
        break;
      case 'path':
        adaptedParam = new rust.ClientEndpointParameter(paramName, paramType, optional, param.serializedName);
        break;
    }

    adaptedParam.docs = this.adaptDocs(param.summary, param.doc);

    return adaptedParam;
  }

  /**
   * converts a tcgc client accessor method to a Rust method
   * 
   * @param client the tcgc client that contains the accessor method
   * @param method the tcgc client accessor method to convert
   * @param rustClient the client to which the method belongs
   * @param subClient the sub-client type that the method returns
   */
  private adaptClientAccessor(client: tcgc.SdkClientType<tcgc.SdkHttpOperation>, method: tcgc.SdkClientAccessor<tcgc.SdkHttpOperation>, rustClient: rust.Client, subClient: rust.Client): void {
    const clientAccessor = new rust.ClientAccessor(`get_${snakeCaseName(subClient.name)}`, rustClient, subClient);
    clientAccessor.docs.summary = `Returns a new instance of ${subClient.name}.`;
    for (const param of method.parameters) {
      // check if the client's initializer already has this parameter.
      // if it does then omit it from the method sig as we'll populate
      // the child client's value from the parent.
      let existsOnParent = false;
      for (const clientParam of client.clientInitialization.parameters) {
        if (clientParam.name === param.name) {
          existsOnParent = true;
          break;
        }
      }
      if (existsOnParent) {
        continue;
      }
      const adaptedParam = new rust.Parameter(snakeCaseName(param.name), this.getType(param.type));
      adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
      clientAccessor.params.push(adaptedParam);
    }
    rustClient.methods.push(clientAccessor);
  }

  /**
   * converts a tcgc method to a Rust method for the specified client
   * 
   * @param method the tcgc method to convert
   * @param rustClient the client to which the method belongs
   */
  private adaptMethod(method: tcgc.SdkServiceMethod<tcgc.SdkHttpOperation>, rustClient: rust.Client): void {
    let srcMethodName = method.name;
    if (method.kind === 'paging' && !srcMethodName.match(/^list/i)) {
      const chunks = codegen.deconstruct(srcMethodName);
      chunks[0] = 'list';
      srcMethodName = codegen.camelCase(chunks);
      this.renamedMethods.add(srcMethodName);
      this.ctx.program.reportDiagnostic({
        code: 'PagingMethodRename',
        severity: 'warning',
        message: `renamed paging method from ${method.name} to ${srcMethodName}`,
        target: method.__raw ? method.__raw.node : NoTarget,
      });
    } else if (this.renamedMethods.has(srcMethodName)) {
      throw new Error(`method name ${srcMethodName} collides with a renamed method`);
    }

    const methodName = naming.getEscapedReservedName(snakeCaseName(srcMethodName), 'fn');
    const optionsLifetime = new rust.Lifetime('a');
    const methodOptionsStruct = new rust.Struct(`${rustClient.name}${codegen.pascalCase(srcMethodName)}Options`, true);
    methodOptionsStruct.lifetime = optionsLifetime;
    methodOptionsStruct.docs.summary = `Options to be passed to [\`${rustClient.name}::${methodName}()\`](${buildClientDocPath(rustClient)}::${methodName}())`;

    const clientMethodOptions = new rust.ExternalType(this.crate, 'azure_core', 'ClientMethodOptions');
    clientMethodOptions.lifetime = optionsLifetime;
    const methodOptionsField = new rust.StructField('method_options', true, clientMethodOptions);
    methodOptionsField.docs.summary = 'Allows customization of the method call.';
    methodOptionsStruct.fields.push(methodOptionsField);

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

    let rustMethod: rust.MethodType;
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

    rustMethod.docs = this.adaptDocs(method.summary, method.doc);
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

      adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
      rustMethod.params.push(adaptedParam);

      if (adaptedParam.optional) {
        let fieldType: rust.Type;
        if (adaptedParam.kind === 'partialBody') {
          // for partial body params, adaptedParam.type is the model type that's
          // sent in the request. we want the field within the model for this param.
          // NOTE: if the param is optional then the field is optional, thus it's
          // already wrapped in an Option<T> type.
          const field = adaptedParam.type.content.type.fields.find(f => { return f.name === adaptedParam.name; });
          if (!field) {
            throw new Error(`didn't find spread param field ${adaptedParam.name} in type ${adaptedParam.type.content.type.name}`);
          }
          fieldType = field.type;
        } else {
          fieldType = new rust.Option(adaptedParam.type);
        }

        const optionsField = new rust.StructField(adaptedParam.name, true, fieldType);
        optionsField.docs = adaptedParam.docs;
        rustMethod.options.type.fields.push(optionsField);
      }
    }

    // client params aren't included in method.parameters so
    // look for them in the remaining operation parameters.
    for (const opParam of allOpParams) {
      if (opParam.onClient) {
        const adaptedParam = this.adaptMethodParameter(opParam);
        adaptedParam.docs = this.adaptDocs(opParam.summary, opParam.doc);
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

    // add any response headers
    const addedHeaders = new Set<string>();
    for (const httpResp of method.operation.responses) {
      for (const header of httpResp.headers) {
        if (addedHeaders.has(header.serializedName)) {
          continue;
        } else if (header.type.kind === 'constant') {
          // omit response headers that have a constant value
          // which is typically the content-type header. modeling
          // it isn't very useful by itself, plus it has the
          // side-effect of adding marker types and/or header
          // traits to all non application/json method repsonses.
          // callers can still retrieve the value from the raw
          // response headers if they need it.
          continue;
        }

        let responseHeader: rust.ResponseHeader;
        if (header.type.kind === 'dict') {
          if (header.serializedName !== 'x-ms-meta' && header.serializedName !== 'x-ms-or') {
            throw new Error(`unexpected response header collection ${header.serializedName}`);
          }
          responseHeader = new rust.ResponseHeaderHashMap(header.name, header.serializedName);
        } else {
          responseHeader = new rust.ResponseHeaderScalar(fixETagName(header.name), fixETagName(header.serializedName), this.getType(header.type));
        }

        responseHeader.docs = this.adaptDocs(header.summary, header.doc);
        rustMethod.responseHeaders.push(responseHeader);
        addedHeaders.add(header.serializedName);
      }
    }

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
    } else if (method.response.type && !(method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes')) {
      returnType = new rust.Response(this.crate, new rust.Payload(this.getType(method.response.type), getBodyFormat()));
    } else if (rustMethod.responseHeaders.length > 0) {
      // for methods that don't return a modeled type but return headers,
      // we need to return a marker type
      const markerType = new rust.MarkerType(`${rustClient.name}${codegen.pascalCase(method.name)}Result`);
      markerType.docs.summary = `Contains results for [\`${rustClient.name}::${methodName}()\`](${buildClientDocPath(rustClient)}::${methodName}())`;
      returnType = new rust.Response(this.crate, markerType);
      this.crate.models.push(markerType);
    } else if (method.response.type && method.response.type.kind === 'bytes' && method.response.type.encode === 'bytes') {
      // bytes encoding indicates a streaming binary response
      returnType = new rust.Response(this.crate, new rust.ResponseBody());
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

    /**
     * used to create keys for this.clientMethodParams
     * @param param the param for which to create a key
     * @returns the map's key
     */
    const getClientParamsKey = function (param: OperationParamType): string {
      // include the param kind in the key name as a client param can be used
      // in different places across methods (path/query)
      return `${param.name}-${param.kind}`;
    };

    // if this is a client method param, check if we've already adapted it
    if (paramLoc === 'client') {
      const clientMethodParam = this.clientMethodParams.get(getClientParamsKey(param));
      if (clientMethodParam) {
        return clientMethodParam;
      }
    }

    const paramName = naming.getEscapedReservedName(snakeCaseName(param.name), 'param');
    let paramType = this.getType(param.type);
    let paramByRef = false;

    // for required header/path/query method string params, we emit them as &str instead of String
    if (!param.optional && !param.onClient && paramType.kind === 'String' && (param.kind === 'header' || param.kind === 'path' || param.kind === 'query')) {
      paramType = this.getStringSlice();
      paramByRef = true;
    }

    let adaptedParam: rust.MethodParameter;
    switch (param.kind) {
      case 'body': {
        let requestType: rust.Bytes | rust.Payload;
        if (param.type.kind === 'bytes' && param.type.encode === 'bytes') {
          // bytes encoding indicates a streaming binary request
          requestType = new rust.Bytes(this.crate);
        } else {
          requestType = new rust.Payload(paramType, this.adaptBodyFormat(param.defaultContentType));
        }
        adaptedParam = new rust.BodyParameter(paramName, paramLoc, param.optional, new rust.RequestContent(this.crate, requestType));
        break;
      }
      case 'cookie':
        // TODO: https://github.com/Azure/typespec-rust/issues/192
        throw new Error('cookie parameters are not supported');
      case 'header':
        if (param.collectionFormat) {
          if (paramType.kind !== 'Vec') {
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
        adaptedParam = new rust.PathParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, param.allowReserved);
        break;
      case 'query':
        if (param.collectionFormat) {
          const format = param.collectionFormat === 'simple' ? 'csv' : (param.collectionFormat === 'form' ? 'multi' : param.collectionFormat);
          if (paramType.kind !== 'Vec') {
            throw new Error(`unexpected kind ${paramType.kind} for QueryCollectionParameter`);
          }
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryCollectionParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true, format);
        } else {
          // TODO: hard-coded encoding setting, https://github.com/Azure/typespec-azure/issues/1314
          adaptedParam = new rust.QueryParameter(paramName, param.serializedName, paramLoc, param.optional, paramType, true);
          adaptedParam.isApiVersion = param.isApiVersionParam;
        }
        break;
    }

    adaptedParam.docs = this.adaptDocs(param.summary, param.doc);
    adaptedParam.ref = paramByRef;

    if (paramLoc === 'client') {
      this.clientMethodParams.set(getClientParamsKey(param), adaptedParam);
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

        // this is the param type as surfaced in the method sig.
        // it's usually the same type as its corresponding field type
        // in the underlying model. the only exception is for String
        // types. we want to surface those as &str in the method sig.
        let paramType = this.getType(param.type);
        let paramByRef = false;
        if (!param.optional && !param.onClient && paramType.kind === 'String') {
          paramType = this.getStringSlice();
          paramByRef = true;
        }

        // this is the internal model type that the spread params coalesce into
        const payloadType = this.getType(opParamType);
        if (payloadType.kind !== 'model') {
          throw new Error(`unexpected kind ${payloadType.kind} for spread body param`);
        }

        const paramName = naming.getEscapedReservedName(snakeCaseName(param.name), 'param');
        const paramLoc: rust.ParameterLocation = 'method';
        const adaptedParam = new rust.PartialBodyParameter(paramName, paramLoc, param.optional, serializedName, paramType, new rust.RequestContent(this.crate, new rust.Payload(payloadType, format)));
        adaptedParam.ref = paramByRef;
        return adaptedParam;
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
    // we only recognize/support JSON, text, and XML content types.
    if (contentType.match(/json/i)) {
      this.crate.addDependency(new rust.CrateDependency('serde_json'));
      return 'json';
    } else if (contentType.match(/xml/i)) {
      // XML support is disabled by default
      this.crate.addDependency(new rust.CrateDependency('azure_core', ['xml']));
      return 'xml';
    } else {
      throw new Error(`unexpected contentType ${contentType}`);
    }
  }
}

/**
 * transforms Etag etc to all lower case.
 * this is to prevent inadvertently snake-casing
 * Etag to e_tag.
 * 
 * if name isn't some variant of Etag the
 * original value is returned.
 * 
 * @param name the name to transform
 * @returns etag or the original value
 */
function fixETagName(name: string): string {
  return name.match(/^etag$/i) ? 'etag' : name;
}

/**
 * snake-cases the provided name
 * 
 * @param name the name to snake-case
 * @returns name in snake-case format
 */
function snakeCaseName(name: string): string {
  return codegen.deconstruct(fixETagName(name)).join('_');
}

type OperationParamType = tcgc.SdkBodyParameter | tcgc.SdkCookieParameter | tcgc.SdkHeaderParameter | tcgc.SdkPathParameter | tcgc.SdkQueryParameter;

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
    case 'bytes':
      return `${root}-bytes-${obj.encode ? obj.encode : 'std'}`;
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
          case 'Vec':
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

/**
 * contructs the fully qualified path to a client to be used in doc comments
 * 
 * @param client the client to build the path to
 * @returns the fully qualified client path (e.g. crate::Client, crate::clients::SubClient)
 */
function buildClientDocPath(client: rust.Client): string {
  return `crate::${client.constructable ? '' : 'clients::'}${client.name}`;
}
