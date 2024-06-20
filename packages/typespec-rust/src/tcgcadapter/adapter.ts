/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import { values } from '@azure-tools/linq';
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
    this.adaptClients();
    this.crate.sortContent();

    if (this.crate.enums.length > 0 || this.crate.models.length > 0) {
      this.crate.dependencies.push(new rust.CrateDependency('serde'));
    }
    return this.crate;
  }

  // converts all tcgc types to their Rust type equivalent
  private adaptTypes(): void {
    for (const sdkEnum of this.ctx.experimental_sdkPackage.enums) {
      const rustEnum = this.getEnum(sdkEnum);
      this.crate.enums.push(rustEnum);
    }

    for (const model of this.ctx.experimental_sdkPackage.models) {
      const rustModel = this.getModel(model);
      this.crate.models.push(rustModel);
    }
  }

  // converts a tcgc enum to a Rust enum
  private getEnum(sdkEnum: tcgc.SdkEnumType): rust.Enum {
    const enumName = codegen.capitalize(sdkEnum.name);
    let rustEnum = this.types.get(enumName);
    if (rustEnum) {
      return <rust.Enum>rustEnum;
    }

    // first create all of the enum values
    const values = new Array<rust.EnumValue>();
    for (const value of sdkEnum.values) {
      const rustEnumValue = new rust.EnumValue(codegen.capitalize(value.name), value.value);
      values.push(rustEnumValue);
    }

    rustEnum = new rust.Enum(enumName, isPub(sdkEnum.access), values, !sdkEnum.isFixed);
    this.types.set(enumName, rustEnum);

    return rustEnum;
  }

  // converts a tcgc model to a Rust model
  private getModel(model: tcgc.SdkModelType): rust.Model {
    if (model.name.length === 0) {
      throw new Error('unnamed model'); // TODO: this might no longer be an issue
    }
    const modelName = codegen.capitalize(model.name);
    let rustModel = this.types.get(modelName);
    if (rustModel) {
      return <rust.Model>rustModel;
    }
    rustModel = new rust.Model(modelName, isPub(model.access));
    rustModel.docs = model.description;
    this.types.set(modelName, rustModel);

    for (const property of model.properties) {
      const structField = this.getModelField(property);
      rustModel.fields.push(structField);
    }

    return rustModel;
  }

  // converts a tcgc model property to a model field
  private getModelField(property: tcgc.SdkModelPropertyType): rust.ModelField {
    const fieldType = new rust.Generic('Option', new Array<rust.Type>(this.getType(property.type)));
    const modelField = new rust.ModelField(snakeCaseName(property.name), property.name, true, fieldType);
    modelField.docs = property.description;
    return modelField;
  }

  // converts a tcgc type to a Rust type
  private getType(type: tcgc.SdkType): rust.Type {
    const getScalar = (kind: 'boolean' | 'float32' | 'float64' | 'int16' | 'int32' | 'int64' | 'int8'): rust.Scalar => {
      let scalar = this.types.get(kind);
      if (scalar) {
        return <rust.Scalar>scalar;
      }

      let scalarKind: rust.ScalarKind;
      switch (kind) {
        case 'boolean':
          scalarKind = 'bool';
          break;
        case 'float32':
          scalarKind = 'f32';
          break;
        case 'float64':
          scalarKind = 'f64';
          break;
        case 'int16':
          scalarKind = 'i16';
          break;
        case 'int32':
          scalarKind = 'i32';
          break;
        case 'int64':
          scalarKind = 'i64';
          break;
        case 'int8':
          scalarKind = 'i8';
          break;
      }

      scalar = new rust.Scalar(scalarKind);
      this.types.set(kind, scalar);
      return scalar;
    };

    switch (type.kind) {
      case 'constant':
        return this.getLiteral(type);
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

  private getTypeForBodyParam(type: tcgc.SdkType): rust.RequestContent {
    const bodyParamType = this.getType(type);
    switch (bodyParamType.kind) {
      case 'String':
      case 'bool':
      case 'enum':
      case 'f32':
      case 'f64':
      case 'i16':
      case 'i32':
      case 'i64':
      case 'i8':
      case 'model':
        return new rust.RequestContent(bodyParamType);
      default:
        throw new Error(`unsupported body param type ${bodyParamType.kind}`);
    }
  }

  private getTypeForHeaderParam(type: tcgc.SdkType): rust.HeaderType {
    const headerParamType = this.getType(type);
    switch (headerParamType.kind) {
      case 'String':
      case 'enum':
      case 'f32':
      case 'f64':
      case 'i16':
      case 'i32':
      case 'i64':
      case 'i8':
      case 'literal':
        return headerParamType;
      default:
        throw new Error(`unsupported header param type ${headerParamType.kind}`);
    }
  }

  // converts all tcgc clients and their methods into Rust clients/methods
  private adaptClients(): void {
    for (const client of this.ctx.experimental_sdkPackage.clients) {
      if (client.methods.length === 0) {
        // skip generating empty clients
        continue;
      }

      // start with instantiable clients and recursively work down
      if (client.initialization.access === 'public') {
        this.recursiveAdaptClient(client);
      }
    }

    if (this.crate.clients.length > 0) {
      this.crate.dependencies.push(new rust.CrateDependency('azure_core'));
    }
  }

  // recursively adapts a client and its methods.
  // this simplifies the case for hierarchical clients.
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

    // only add the Client suffix to instantiable clients
    if (!clientName.match(/Client$/) && !parent) {
      clientName += 'Client';
    }

    const rustClient = new rust.Client(clientName);
    rustClient.docs = client.description;
    rustClient.parent = parent;

    // anything other than public means non-instantiable client
    if (client.initialization.access === 'public') {
      for (const param of client.initialization.properties) {
        switch (param.kind) {
          case 'credential':
            // skip this for now as we don't generate client constructors
            // TODO: https://github.com/Azure/autorest.rust/issues/32
            continue;
          case 'endpoint':
            // this will either be a single endpoint param or templated host
            if (param.type.templateArguments.length === 0) {
              // single endpoint param
              rustClient.fields.push(new rust.URIParameter(param.name, 'client'));
            } else {
              throw new Error('templated host NYI');
              // templated host params
              //for (const templateArg of param.type.templateArguments) {
              //}
            }
            break;
          case 'method':
            throw new Error('client method params NYI');
        }
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
        rustClient.methods.push(new rust.ClientAccessor(`get_${snakeCaseName(subClient.name)}_client`, rustClient, subClient));
      } else {
        this.adaptMethod(method, rustClient);
      }
    }

    this.crate.clients.push(rustClient);
    return rustClient;
  }

  // converts method into a rust.Method for the specified rust.Client
  private adaptMethod(method: tcgc.SdkServiceMethod<tcgc.SdkHttpOperation>, rustClient: rust.Client): void {
    let rustMethod: rust.AsyncMethod;
    const methodOptionsStruct = new rust.Struct(`${rustClient.name}${codegen.pascalCase(method.name)}Options`, true);
    methodOptionsStruct.fields.push(new rust.StructField('method_options', false, new rust.ExternalType('azure_core', 'ClientMethodOptions')));
    switch (method.kind) {
      case 'basic':
        rustMethod = new rust.AsyncMethod(snakeCaseName(method.name), rustClient, isPub(method.access), new rust.MethodOptions(methodOptionsStruct, false));
        break;
      default:
        throw new Error(`method kind ${method.kind} NYI`);
    }

    rustMethod.docs = method.description;
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
      if (opParam.kind === 'body' && opParam.type.kind === 'model' && opParam.type.kind !== param.type.kind) {
        throw new Error('spread params NYI');
      } else {
        adaptedParam = this.adaptMethodParameter(opParam);
      }

      adaptedParam.docs = param.description;
      rustMethod.params.push(adaptedParam);
    }

    let returnType: rust.Type;
    if (method.response.type) {
      returnType = new rust.Generic('Response', [this.getType(method.response.type)], 'azure_core');
    } else {
      returnType = new rust.Empty();
    }
    rustMethod.returns = new rust.Generic('Result', [returnType], 'azure_core');
  }

  private adaptMethodParameter(param: OperationParamType): rust.MethodParameter {
    const paramLoc = param.onClient ? 'client' : 'method';
    let adaptedParam: rust.MethodParameter;
    switch (param.kind) {
      case 'body':
        adaptedParam = new rust.BodyParameter(param.name, paramLoc, this.getTypeForBodyParam(param.type));
        break;
      case 'header':
        adaptedParam = new rust.HeaderParameter(param.name, param.serializedName, paramLoc, this.getTypeForHeaderParam(param.type));
        break;
      default:
        throw new Error(`param kind ${param.kind} NYI`);
    }

    adaptedParam.docs = param.description;
    return adaptedParam;
  }
}

function isPub(access?: tcgc.AccessFlags): boolean {
  return access !== 'internal';
}

function snakeCaseName(name: string): string {
  return codegen.deconstruct(name).join('_');
}

type OperationParamType = tcgc.SdkBodyParameter | tcgc.SdkHeaderParameter | tcgc.SdkPathParameter | tcgc.SdkQueryParameter;
