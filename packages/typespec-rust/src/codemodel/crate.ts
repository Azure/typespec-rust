/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as client from './client.js';
import * as types from './types.js';

/**
 * Crate is a Rust crate
 * the Rust edition is centrally managed
 */
export interface Crate {
  /** the name of the Crate */
  name: string;

  /** the version of the Crate */
  version: string;

  /** the target service type */
  type: ServiceType;

  /** the Crates on which this Crate depends */
  dependencies: Array<CrateDependency>;

  /** unions contains all of the discriminated unions for this crate. can be empty */
  unions: Array<types.DiscriminatedUnion>;

  /** enums contains all of the enums for this crate. can be empty */
  enums: Array<types.Enum>;

  /** models contains all of the models for this crate. can be empty */
  models: Array<types.MarkerType | types.Model>;

  /** clients contains all the clients for this crate. can be empty */
  clients: Array<client.Client>;
}

/** ServiceType defines the possible service types */
export type ServiceType = 'azure-arm' | 'data-plane';

/**
 * CrateDependency is an external Crate dependency
 * note that dependency versions are centralized which is
 * why there's no version info specified here.
 */
export interface CrateDependency {
  /** the name of the Crate */
  name: string;

  /** the features to enable for the Crate */
  features: Array<string>;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Crate implements Crate {
  constructor(name: string, version: string, type: ServiceType) {
    this.name = name;
    this.version = version;
    this.type = type;
    this.dependencies = new Array<CrateDependency>();
    this.unions = new Array<types.DiscriminatedUnion>();
    this.enums = new Array<types.Enum>();
    this.models = new Array<types.Model>();
    this.clients = new Array<client.Client>();
  }

  /**
   * add a dependency to the crate if it doesn't already exist
   * @param dependency the dependency to add
   */
  addDependency(dependency: CrateDependency): void {
    for (const dep of this.dependencies) {
      if (dep.name === dependency.name) {
        // merge in any features
        dep.features = dep.features.concat(dependency.features.filter(item => !dep.features.includes(item)));
        return;
      }
    }
    this.dependencies.push(dependency);
  }

  /** lexicographically sorts all content */
  sortContent(): void {
    const sortAscending = function(a: string, b: string): number {
      return a < b ? -1 : a > b ? 1 : 0;
    };

    this.dependencies.sort((a: CrateDependency, b: CrateDependency) => { return sortAscending(a.name, b.name); });
    this.unions.sort((a: types.DiscriminatedUnion, b: types.DiscriminatedUnion) => { return sortAscending(a.name, b.name); });
    for (const rustUnion of this.unions) {
      rustUnion.members.sort((a: types.DiscriminatedUnionMember, b: types.DiscriminatedUnionMember) => { return sortAscending(a.type.name, b.type.name); });
    }
    this.enums.sort((a: types.Enum, b: types.Enum) => { return sortAscending(a.name, b.name); });
    for (const rustEnum of this.enums) {
      rustEnum.values.sort((a: types.EnumValue, b: types.EnumValue) => { return sortAscending(a.name, b.name); });
    }
    this.models.sort((a: types.MarkerType | types.Model, b: types.MarkerType | types.Model) => { return sortAscending(a.name, b.name); });
    for (const model of this.models) {
      if (model.kind === 'marker') {
        continue;
      }
      model.fields.sort((a: types.ModelFieldType, b: types.ModelFieldType) => { return sortAscending(a.name, b.name); });
    }
    this.clients.sort((a: client.Client, b: client.Client) => { return sortAscending(a.name, b.name); });
    for (const client of this.clients) {
      client.fields.sort((a: types.StructField, b: types.StructField) => { return sortAscending(a.name, b.name); });
      client.methods.sort((a: client.MethodType, b: client.MethodType) => { return sortAscending(a.name, b.name); });
      if (client.constructable) {
        client.constructable.options.type.fields.sort((a: types.StructField, b: types.StructField) => { return sortAscending(a.name, b.name); });
      }
      for (const method of client.methods) {
        if (method.kind === 'clientaccessor') {
          continue;
        } else if (method.kind === 'pageable' && method.strategy?.kind === 'nextLink') {
          method.strategy.reinjectedParams.sort((a: client.MethodParameter, b: client.MethodParameter) => sortAscending(a.name, b.name));
        }
        method.options.type.fields.sort((a: types.StructField, b: types.StructField) => { return sortAscending(a.name, b.name); });
        method.responseHeaders?.headers.sort((a: client.ResponseHeader, b: client.ResponseHeader) => sortAscending(a.header, b.header));
      }
    }
  }
}

export class CrateDependency implements CrateDependency {
  constructor(name: string, features = new Array<string>()) {
    this.name = name;
    this.features = features;
  }
}
