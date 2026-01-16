/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from './types.js';

/** Method is a Rust method */
export interface Method<T> {
  /** the name of the method */
  name: types.Symbol;

  /** the method's language-independent name */
  languageIndependentName: string;

  /** any docs for the method */
  docs: types.Docs;

  /** indicates the visibility of the method */
  visibility: types.Visibility;

  /** the name of the type on which the method is implemented */
  impl: string;

  /** self contains info about the self param */
  self: Self;

  /** the params passed to the method (excluding self). can be empty */
  params: Array<Parameter>;

  /** the method's return type */
  returns?: T;
}

/** Parameter is a Rust function or method parameter */
export interface Parameter {
  /** the name of the parameter */
  name: string;

  /** any docs for the parameter */
  docs: types.Docs;

  /** the parameter's type */
  type: types.Type;

  /** indicates if the parameter is mutable. defaults to false */
  mut: boolean;
}

/** Self is a method's self parameter */
export interface Self {
  name: 'self';

  /** indicates if self is mutable */
  mut: boolean;

  /** indicates if self is a reference */
  ref: boolean;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class Method<T> implements Method<T> {
  constructor(name: types.Symbol, languageIndependentName: string, visibility: types.Visibility, impl: string, self: Self) {
    this.name = name;
    this.languageIndependentName = languageIndependentName;
    this.visibility = visibility;
    this.impl = impl;
    this.self = self;
    this.params = new Array<Parameter>();
    this.docs = {};
  }
}

export class Parameter implements Parameter {
  constructor(name: string, type: types.Type) {
    this.name = name;
    this.type = type;
    this.mut = false;
    this.docs = {};
  }
}

export class Self implements Self {
  constructor(mut: boolean, ref: boolean) {
    this.name = 'self';
    this.mut = mut;
    this.ref = ref;
  }
}
