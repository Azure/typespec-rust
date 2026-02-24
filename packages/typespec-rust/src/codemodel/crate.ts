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
export interface Crate extends ModuleBase {
  kind: 'crate';

  /** the name of the Crate */
  name: string;

  /** the version of the Crate */
  version: string;

  /** the target service type */
  type: ServiceType;

  /** the Crates on which this Crate depends */
  dependencies: Array<CrateDependency>;

  /** any sub-modules. can be empty */
  subModules: Array<SubModule>;
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

/** defines the container for emitted content */
export type ModuleContainer = Crate | SubModule;

/**
 * SubModule is a Rust module within a crate. it contains
 * a mod.rs file and generated directory with its contents.
 * 
 *   sub1 /src/sub1/mod.rs
 *        /src/sub1/generated/*
 * nested /src/sub1/nested/mod.rs
 *        /src/sub1/nested/generated/*
 */
export interface SubModule extends ModuleBase {
  kind: 'module';

  /** the name of this module */
  name: string;

  /** any sub-modules. can be empty */
  subModules: Array<SubModule>;

  /** this module's parent */
  parent: ModuleContainer;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// base types
///////////////////////////////////////////////////////////////////////////////////////////////////

interface ModuleBase {
  /** clients contains all the clients for this module. can be empty */
  clients: Array<client.Client>;

  /** enums contains all of the enums for this module. can be empty */
  enums: Array<types.Enum>;

  /** models contains all of the models for this module. can be empty */
  models: Array<types.MarkerType | types.Model>;

  /** unions contains all of the discriminated unions for this module. can be empty */
  unions: Array<types.DiscriminatedUnion>;
}

class ModuleBase implements ModuleBase {
  constructor() {
    this.clients = new Array<client.Client>();
    this.enums = new Array<types.Enum>();
    this.models = new Array<types.Model>();
    this.unions = new Array<types.DiscriminatedUnion>();
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Crate extends ModuleBase implements Crate {
  constructor(name: string, version: string, type: ServiceType) {
    super();
    this.kind = 'crate';
    this.name = name;
    this.version = version;
    this.type = type;
    this.dependencies = new Array<CrateDependency>();
    this.subModules = new Array<SubModule>();
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
}

export class CrateDependency implements CrateDependency {
  constructor(name: string, features = new Array<string>()) {
    this.name = name;
    this.features = features;
  }
}

export class SubModule extends ModuleBase implements SubModule {
  constructor(name: string, parent: ModuleContainer) {
    super();
    this.kind = 'module';
    this.name = name;
    this.subModules = new Array<SubModule>();
    this.parent = parent;
  }
}
