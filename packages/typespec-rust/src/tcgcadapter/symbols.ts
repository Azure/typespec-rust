/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

//import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as tsp from '@typespec/compiler';
import * as rust from '../codemodel/index.js';

/**
 * caches Rust names created from tcgc artifacts.
 * any names that result in duplicates will have
 * a COLLIDES_* prefix.
 */
export class SymbolTable<T extends { name: string, __raw?: tsp.Type } = { name: string, __raw?: tsp.Type }> {
  private readonly program: tsp.Program;
  private readonly nameToSdkEntries;
  private readonly sdkTypeToName;

  constructor(program: tsp.Program) {
    this.program = program;
    this.nameToSdkEntries = new Map<string, Array<T>>();
    this.sdkTypeToName = new Map<T, string>();
  }

  /**
   * adds a mapping between a Rust name and the instance of a tcgc SDK type.
   * 
   * @param name 
   * @param sdkType 
   */
  add(name: string, sdkType: T): rust.Symbol {
    let existingMapping = this.nameToSdkEntries.get(name);
    if (!existingMapping) {
      existingMapping = new Array<T>();
      this.nameToSdkEntries.set(name, existingMapping);
    }
    existingMapping.push(sdkType);

    if (this.sdkTypeToName.has(sdkType)) {
      throw new Error('todo dupe');
    }
    this.sdkTypeToName.set(sdkType, name);

    // calls to Symbol() MUST be idempotent, and capturing cached achieves that
    let cached: string | undefined;
    return () => {
      if (cached === undefined) {
        cached = this.get(sdkType);
      }
      return cached;
    }
  }

  /**
   * gets the Rust name for the provided SDK type instance.
   * when name maps to more than one instance of the associated
   * SDK type, the COLLIDES_* prefix is included in the name.
   * 
   * @param sdkType 
   * @returns 
   */
  private get(sdkType: T): string {
    const name = this.sdkTypeToName.get(sdkType);
    if (!name) {
      throw new Error('todo name');
    }

    const entriesForName = this.nameToSdkEntries.get(name);
    if (!entriesForName) {
      throw new Error('todo entries');
    }

    if (entriesForName.length === 1) {
      // no collisions
      this.sdkTypeToName.delete(sdkType);
      this.nameToSdkEntries.delete(name);
      return name;
    }

    entriesForName.sort((a: T, b: T) => sortAscending(a.name, b.name));
    const index = entriesForName.indexOf(sdkType);
    if (index < 0) {
      throw new Error('todo index');
    }

    this.program.reportDiagnostic({
      code: 'NameCollision',
      severity: 'warning',
      message: `duplicate symbol name ${name}`,
      target: sdkType.__raw?.node ?? tsp.NoTarget,
    });

    return `COLLIDES_${name}_ID${index + 1}`;
  }
}

function sortAscending(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
};
