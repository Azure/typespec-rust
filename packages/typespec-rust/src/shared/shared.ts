/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as rust from '../codemodel/index.js';

/**
 * if type is an Option<T>, returns the T, else returns type
 * 
 * @param type is the type to unwrap
 * @returns the wrapped type or the original type if it wasn't wrapped
 */
export function unwrapOption(type: rust.Type): rust.Type {
  if (type.kind === 'option') {
    return type.type;
  }
  return type;
}

/**
 * returns the object of type targetKind extracted from type or undefined.
 * if targetKind is wrapped within one or more types, their kind(s) must be specified in wrappedIn.
 * if the specified sequence of types (wrappedIn + targetKind) don't match, undefined is returned.
 * 
 * e.g. to obtain the underlying 'str' from a &str, the call would be made as follows.
 * const asStr = asTypeOf<rust.StringSlice>(objInstance, 'str', 'ref');
 * 
 * @param type the object instance from which to extract targetKind
 * @param targetKind the target type's kind when performing the conversion. note that this value MUST match the kind for the specified generic type parameter
 * @param wrappedIn the kinds of any wrapper types that contain targetKind. can be empty if targetKind isn't wrapped.
 * @returns the object matching the targetKind or undefined
 */
export function asTypeOf<T extends rust.Type>(type: rust.Type, targetKind: rust.Kind, ...wrappedIn: Array<rust.Kind>): T | undefined {
  let current: rust.Type | undefined = type;

  for (const wrapper of wrappedIn) {
    if (!current) {
      // the previous iteration that unwrapped current didn't return an inner type.
      // this means that there are more values in wrappedIn than objects wrapping type.
      return undefined;
    } else if (current.kind === wrapper) {
      current = unwrap(current);
    }
  }

  if (current?.kind === targetKind) {
    return current as T;
  }

  return undefined;
}

/**
 * gets the PayloadFormatType for a PayloadFormat
 * @param format the PayloadFormat to convert
 * @returns the PayloadFormatType appropriate for the format
 */
export function getPayloadFormatType(format: rust.PayloadFormat): rust.PayloadFormatType {
  switch (format) {
    case 'json':
      return 'JsonFormat';
    case 'xml':
      return 'XmlFormat';
    default:
      return 'NoFormat';
  }
}

/**
 * returns a wrapper type's inner type.
 * e.g. for a rust.Vector, return's the value of Vector.type.
 * if the type doesn't wrap another type, undefined is returned.
 * 
 * @param type the type to unwrap
 * @returns the inner type or undefined
 */
function unwrap(type: rust.Type): rust.Type | undefined {
  switch (type.kind) {
    case 'Vec':
    case 'arc':
    case 'box':
    case 'hashmap':
    case 'implTrait':
      return type.type;
    case 'literal':
      return type.valueKind;
    case 'option':
    case 'pageIterator':
    case 'pager':
    case 'ref':
      return type.type;
    case 'requestContent':
      switch (type.content.kind) {
        case 'bytes':
          return type.content;
        case 'payload':
          return type.content.type;
        default:
          return type.content;
      }
    case 'response':
      return type.content;
    case 'result':
      return type.type;
    case 'scalar':
      return type;
    case 'slice':
      return type.type;
    default:
      return undefined;
  }
}
