/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// Crate is a Rust crate
// the Rust edition is centrally managed
export interface Crate {
  // the name of the Crate
  name: string;

  // the version of the Crate
  version: string;

  // the Crates on which this Crate depends
  dependencies: Array<CrateDependency>;
}

// CrateDependency is an external Crate dependency
// note that dependency versions are centralized which is
// why there's no version info specified here.
export interface CrateDependency {
  // the name of the Crate
  name: string;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Crate implements Crate {
  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
    this.dependencies = new Array<CrateDependency>();
  }

  sortContent(): void {
    const sortAscending = function(a: string, b: string): number {
      return a < b ? -1 : a > b ? 1 : 0;
    };

    this.dependencies.sort((a: CrateDependency, b: CrateDependency) => { return sortAscending(a.name, b.name); });
  }
}

export class CrateDependency implements CrateDependency {
  constructor(name: string) {
    this.name = name;
  }
}
