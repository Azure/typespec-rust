/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/** ModelFieldCustomizations defines the set of customizations for model fields. */
export type ModelFieldCustomizations = DeserializeWith;

/** DeserializeWith indicates a field should use the specified deserializer function. */
export interface DeserializeWith {
  kind: 'deserializeWith';

  /** the fully qualified name of the deserializer function */
  name: string;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

export class DeserializeWith {
  constructor(name: string) {
    this.kind = 'deserializeWith';
    this.name = name;
  }
}
