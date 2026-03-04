/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// cspell: ignore cargotoml
import { emitCargoToml } from './cargotoml.js';
import { emitClients } from './clients.js';
import { Context } from './context.js';
import { emitEnums } from './enums.js';
import { emitUnions } from './unions.js';
import { Module } from './helpers.js';
import { emitLibRs } from './lib.js';
import { emitHeaderTraits } from './headerTraits.js';
import { emitClientsModRs, emitGeneratedModRs, emitModelsModRs, emitSubModRs } from './mod.js';
import { emitModels } from './models.js';

import * as rust from '../codemodel/index.js';

/** a file to emit */
export interface File {
  /** the name of the file. can contain sub-directories */
  readonly name: string;

  /** the contents of the file */
  readonly content: string;
}

/** CodeGenerator exposes the APIs for obtaining generated code content */
export class CodeGenerator {
  private readonly context: Context;
  private readonly crate: rust.Crate;

  /**
   * instantiates a new CodeGenerator instance for the provided crate
   * @param crate the Rust crate for which to generate code
   */
  constructor(crate: rust.Crate) {
    this.context = new Context(crate);
    this.crate = crate;
    sortContent(this.crate);
  }

  /**
   * generates a Cargo.toml file
   * 
   * @returns the contents for the Cargo.toml file
   */
  emitCargoToml(): string {
    return emitCargoToml(this.crate);
  }

  /**
   * generates the lib.rs file for crate
   * 
   * @returns the content for lib.rs
   */
  emitLibRs(): string {
    return emitLibRs(this.crate);
  }

  /**
   * generates all clients, models, and any helper content
   * 
   * @returns an array of files to emit
   */
  emitContent(): Array<File> {
    const generatedSubDir = 'generated';
    const clientsSubDir = `${generatedSubDir}/clients`;
    const modelsSubDir = `${generatedSubDir}/models`;

    const addModelsFile = function (dir: string, files: Array<File>, modelsModRS: Array<string>, module: Module | undefined): void {
      if (!module) {
        return;
      }
      files.push({ name: `${dir}${modelsSubDir}/${module.name}.rs`, content: module.content });
      modelsModRS.push(`${module.visibility === 'pubCrate' ? 'pub(crate) ' : ''}mod ${module.name}`);
      if (module.visibility !== 'internal') {
        modelsModRS.push(`pub${module.visibility === 'pubCrate' ? '(crate)' : ''} use ${module.name}::*`);
      }
    };

    return this.recursiveEmit((module: rust.ModuleContainer, dir: string): Array<File> => {
      const modelsModRS = new Array<string>();
      const files = new Array<File>();

      const clientModules = emitClients(module);
      if (clientModules) {
        files.push(...clientModules.modules.map((module) => { return { name: `${dir}${clientsSubDir}/${module.name}.rs`, content: module.content }; }));
        files.push({ name: `${dir}${clientsSubDir}/mod.rs`, content: emitClientsModRs(clientModules.modules.map((module) => module.name)) });
        addModelsFile(dir, files, modelsModRS, clientModules.options);
      }

      const enums = emitEnums(module, this.context);
      addModelsFile(dir, files, modelsModRS, enums.definitions);
      addModelsFile(dir, files, modelsModRS, enums.serde);
      addModelsFile(dir, files, modelsModRS, enums.impls);

      const unions = emitUnions(module, this.context);
      addModelsFile(dir, files, modelsModRS, unions.definitions);
      addModelsFile(dir, files, modelsModRS, unions.impls);
      addModelsFile(dir, files, modelsModRS, unions.serde);

      const models = emitModels(module, this.context);
      addModelsFile(dir, files, modelsModRS, models.definitions);
      addModelsFile(dir, files, modelsModRS, models.serde);
      addModelsFile(dir, files, modelsModRS, models.impls);
      addModelsFile(dir, files, modelsModRS, models.xmlHelpers);

      addModelsFile(dir, files, modelsModRS, emitHeaderTraits(module));

      if (modelsModRS.length > 0) {
        files.push({ name: `${dir}${modelsSubDir}/mod.rs`, content: emitModelsModRs(modelsModRS) })
      }

      if (module.clients.length > 0 || module.enums.length > 0 || module.models.length > 0 || module.unions.length > 0) {
        files.push({ name: `${dir}${generatedSubDir}/mod.rs`, content: emitGeneratedModRs(module) });
      }

      return files;
    });
  }

  /**
   * recursively emits module contents.
   * 
   * @param emitForModule the module contents to emit
   */
  private recursiveEmit(emitForModule: (module: rust.ModuleContainer, dir: string) => Array<File>): Array<File> {
    const content = new Array<File>();
    const recursiveEmit = (module: rust.ModuleContainer, dir: string): void => {
      content.push(...emitForModule(module, dir));

      // recursively emit any sub-modules
      for (const subModule of module.subModules) {
        const subModuleDir = `${dir}${subModule.name}/`;
        content.push({
          name: `${subModuleDir}mod.rs`,
          content: emitSubModRs(subModule),
        });
        recursiveEmit(subModule, subModuleDir);
      }
    };

    recursiveEmit(this.crate, '');
    return content
  }
}

/**
 * recursively sorts code model contents by name in alphabetical order.
 * 
 * @param content the contents to sort
 */
function sortContent(content: rust.ModuleContainer): void {
  const sortAscending = function(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  };

  if (content.kind === 'crate') {
    content.dependencies.sort((a: rust.CrateDependency, b: rust.CrateDependency) => { return sortAscending(a.name, b.name); });
  }

  content.unions.sort((a: rust.DiscriminatedUnion, b: rust.DiscriminatedUnion) => { return sortAscending(a.name, b.name); });
  for (const rustUnion of content.unions) {
    rustUnion.members.sort((a: rust.DiscriminatedUnionMember, b: rust.DiscriminatedUnionMember) => { return sortAscending(a.type.name, b.type.name); });
  }

  content.enums.sort((a: rust.Enum, b: rust.Enum) => { return sortAscending(a.name, b.name); });
  for (const rustEnum of content.enums) {
    rustEnum.values.sort((a: rust.EnumValue, b: rust.EnumValue) => { return sortAscending(a.name, b.name); });
  }

  content.models.sort((a: rust.MarkerType | rust.Model, b: rust.MarkerType | rust.Model) => { return sortAscending(a.name, b.name); });
  for (const model of content.models) {
    if (model.kind === 'marker') {
      continue;
    }
    model.fields.sort((a: rust.ModelFieldType, b: rust.ModelFieldType) => { return sortAscending(a.name, b.name); });
  }

  content.clients.sort((a: rust.Client, b: rust.Client) => { return sortAscending(a.name, b.name); });
  for (const client of content.clients) {
    client.fields.sort((a: rust.StructField, b: rust.StructField) => { return sortAscending(a.name, b.name); });
    client.methods.sort((a: rust.MethodType, b: rust.MethodType) => { return sortAscending(a.name, b.name); });
    if (client.constructable) {
      client.constructable.options.type.fields.sort((a: rust.StructField, b: rust.StructField) => { return sortAscending(a.name, b.name); });
    }
    for (const method of client.methods) {
      if (method.kind === 'clientaccessor') {
        continue;
      } else if (method.kind === 'pageable' && method.strategy?.kind === 'nextLink') {
        method.strategy.reinjectedParams.sort((a: rust.MethodParameter, b: rust.MethodParameter) => sortAscending(a.name, b.name));
      }
      method.options.type.fields.sort((a: rust.StructField, b: rust.StructField) => { return sortAscending(a.name, b.name); });
      method.responseHeaders?.headers.sort((a: rust.ResponseHeader, b: rust.ResponseHeader) => sortAscending(a.header, b.header));
    }
  }

  content.subModules.sort((a: rust.SubModule, b: rust.SubModule) => sortAscending(a.name, b.name));

  for (const subModule of content.subModules) {
    sortContent(subModule);
  }
}
