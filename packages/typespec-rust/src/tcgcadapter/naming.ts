/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as codegen from '@azure-tools/codegen';
import * as tcgc from '@azure-tools/typespec-client-generator-core';
import * as tsp from '@typespec/compiler';

/**
 * if name is a reserved word, append the suffix and return the result, else return name.
 * the suffix indicates the context in which name appears
 * 
 * @param name the name to potentially fix up
 * @param suffix the context in which name appears
 * @param extraWords optional set of additional reserved words
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function getEscapedReservedName(name: string, suffix: 'fn' | 'param' | 'prop', extraWords?: Set<string>): string {
  if (reservedWords.has(name) || extraWords?.has(name)) {
    name = `${name}_${suffix}`;
  }
  return name;
}

// https://doc.rust-lang.org/reference/keywords.html
const reservedWords = new Set<string>(
  [
    // strict keywords
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn',
    'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self',
    'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',

    // reserved keywords
    'abstract', 'become', 'box', 'do', 'final', 'macro', 'override', 'priv', 'try', 'typeof', 'unsized', 'virtual', 'yield',

    // weak keywords
    'macro_rules', 'union', '\'static',
  ]
);

/**
 * fixes up enum value names to follow Rust conventions
 * 
 * @param enumValue the enum value type to fix up
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueName(enumValue: tcgc.SdkEnumValueType): string {
  return fixUpEnumValueNameWorker(enumValue.name);
}

/**
 * split out from fixUpEnumValueName for testing purposes.
 * don't call this directly, call fixUpEnumValueName instead.
 * 
 * @param name the enum value name
 * @returns the fixed up name. can be the original value if no fix-up was required
 */
export function fixUpEnumValueNameWorker(name: string): string {
  const chunks = codegen.deconstruct(name).map((each) => codegen.capitalize(each));
  let fixedName = chunks[0];
  for (let i = 1; i < chunks.length; ++i) {
    const chunk = chunks[i];
    const prevChunk = chunks[i - 1];

    if (chunk.match(/^\d+/) && prevChunk.match(/\d+$/)) {
      // concatenating something like 3.14 or v2022-01
      fixedName += `_${chunk}`;
    } else {
      fixedName += chunk;
    }
  }

  if (fixedName.match(/^\d/)) {
    fixedName = `INVLD_IDENTIFIER_${fixedName}`;
  }

  return fixedName;
}

/**
 * caches Rust names created from tcgc artifacts.
 * any names that result in duplicates will have
 * a COLLIDES_* prefix.
 */
export class NameCache<T extends tcgc.SdkType> {
  private readonly program: tsp.Program;
  private readonly nameToSdkEntries;
  private readonly sdkTypeToName;
  private readonly groupAndCount;
  private groupCounter: number;

  constructor(program: tsp.Program) {
    this.program = program;
    this.nameToSdkEntries = new Map<string, Array<T>>();
    this.sdkTypeToName = new Map<T, string>();
    this.groupAndCount = new Map<string, {group: number, count: number}>();
    this.groupCounter = 1;
  }

  /**
   * adds a mapping between a Rust name and the instance of a tcgc SDK type.
   * 
   * @param name 
   * @param sdkType 
   */
  add(name: string, sdkType: T): void {
    let existingMapping = this.nameToSdkEntries.get(name);
    if (!existingMapping) {
      existingMapping = new Array<T>();
      this.nameToSdkEntries.set(name, existingMapping);
    } else {
      // have collisions, add tracking group and count info as needed
      if (!this.groupAndCount.has(name)) {
        this.groupAndCount.set(name, {group: this.groupCounter, count: 0});
        ++this.groupCounter;
      }
    }
    existingMapping.push(sdkType);

    if (this.sdkTypeToName.has(sdkType)) {
      throw new Error('todo dupe');
    }
    this.sdkTypeToName.set(sdkType, name);
  }

  /**
   * gets the Rust name for the provided SDK type instance.
   * when name maps to more than one instance of the associated
   * SDK type, the COLLIDES_* prefix is included in the name.
   * 
   * @param sdkType 
   * @returns 
   */
  get(sdkType: T): string {
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

    const groupCountInfo = this.groupAndCount.get(name);
    if (!groupCountInfo) {
      throw new Error('todo info');
    }

    this.program.reportDiagnostic({
      code: 'NameCollision',
      severity: 'warning',
      message: `duplicate symbol name ${name}`,
      target: sdkType.__raw?.node ?? tsp.NoTarget,
    });

    ++groupCountInfo.count;
    return `COLLIDES_GRP${groupCountInfo.group}_ID${groupCountInfo.count}_${name}`;
  }
}
