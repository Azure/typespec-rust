/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// cspell: ignore uncapitalize

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
    } else {
      // sequence of types don't match so we're done
      current = undefined;
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

/**
 * builds the complete import path based on src and dst.
 * 
 * @param dst the module where the import statement will be used
 * @param src the module that contains the type being referenced
 * @returns the fully qualified import path
 */
export function buildImportPath(dst: rust.ModuleContainer, src: rust.ModuleContainer): string {
  const chunks = new Array<string>();
  let cur = src;
  while (cur.kind === 'module') {
    chunks.unshift(cur.name);
    cur = cur.parent;
  }
  chunks.unshift('crate');
  const path = chunks.join('::');

  if (dst === src) {
    return `${path}::generated`;
  } else {
    return path;
  }
}

// the following was copied from @azure-tools/codegen as it's deprecated

/**
 * returns the camel-cased version of identifier.
 * e.g. "myVariableName" -> "myVariableName"
 * 
 * @param identifier the identifier to convert
 * @returns the camel-cased identifier
 */
export function camelCase(identifier: string | Array<string>): string {
  if (typeof identifier === "string") {
    return camelCase(deconstruct(identifier));
  }
  switch (identifier.length) {
    case 0:
      return "";
    case 1:
      return uncapitalize(identifier[0]);
  }
  return `${uncapitalize(identifier[0])}${pascalCase(identifier.slice(1))}`;
}

/**
 * returns the capitalized version of a string.
 * e.g. "myVariableName" -> "MyVariableName"
 * 
 * @param str the string to capitalize
 * @returns the capitalized string
 */
export function capitalize(str: string): string {
  if (acronyms.has(str)) {
    return str.toUpperCase();
  }
  return str ? `${str.charAt(0).toUpperCase()}${str.slice(1)}` : str;
}

/**
 * returns a formatted comment string.
 * 
 * @param content the content of the comment
 * @param prefix the prefix for each line of the comment
 * @param factor the indentation factor
 * @param maxLength the maximum length of each line
 * @returns the formatted comment string
 */
export function comment(content: string, prefix = lineCommentPrefix, factor = 0, maxLength = 120) {
  const result = new Array<string>();
  let line = "";
  prefix = indent(prefix, factor);

  content = content.trim();
  if (content) {
    for (const word of content.replace(/\n+/g, ' » ').split(/\s+/g)) {
      if (word === '»') {
        result.push(line);
        line = prefix;
        continue;
      }

      if (maxLength < line.length) {
        result.push(line);
        line = '';
      }

      if (!line) {
        line = prefix;
      }

      line += ` ${word}`;
    }
    if (line) {
      result.push(line);
    }

    return result.join('\n');
  }
  return '';
}

/**
 * returns the deconstructed version of an identifier.
 * e.g. "myVariableName" -> ["my", "variable", "name"]
 * 
 * @param identifier the identifier to deconstruct
 * @returns an array of strings representing the deconstructed identifier
 */
export function deconstruct(identifier: string | Array<string>): Array<string> {
  if (Array.isArray(identifier)) {
    return identifier.flatMap(deconstruct);
  }
  return `${identifier}`
    .replace(/([a-z]+)([A-Z])/g, "$1 $2")
    .replace(/(\d+)([a-z|A-Z]+)/g, "$1 $2")
    .replace(/\b([A-Z]+)([A-Z])([a-z])/, "$1 $2$3")
    .split(/[\W|_]+/)
    .map((each) => each.toLowerCase());
}

/**
 * returns the Pascal-cased version of an identifier.
 * e.g. "myVariableName" -> "MyVariableName"
 * 
 * @param identifier the identifier to convert
 * @param removeDuplicates whether to remove sequential duplicate words
 * @returns the Pascal-cased identifier
 */
export function pascalCase(identifier: string | Array<string>, removeDuplicates = true): string {
  return identifier === undefined
    ? ""
    : typeof identifier === "string"
      ? pascalCase(deconstruct(identifier), removeDuplicates)
      : (removeDuplicates ? [...removeSequentialDuplicates(identifier)] : identifier)
        .map((each) => capitalize(each))
        .join("");
}

/**
 * returns the uncapitalized version of a string.
 * e.g. "MyVariableName" -> "myVariableName"
 * 
 * @param str the string to uncapitalize
 * @returns the uncapitalized string
 */
export function uncapitalize(str: string): string {
  return str ? `${str.charAt(0).toLowerCase()}${str.slice(1)}` : str;
}

const acronyms = new Set([
  'ip',
  'os',
  'ms',
  'vm',
]);

const lineCommentPrefix = "//";

function indent(content: string, factor = 1): string {
  const i = '    '.repeat(factor);
  content = i + content.trim().replace(/\r\n/g, '\n');
  return content.split(/\n/g).join(`\n${i}`);
}

function isEqual(s1: string, s2: string): boolean {
  // when s2 is undefined and s1 is the string 'undefined', it returns 0, making this true.
  // To prevent that, first we need to check if s2 is undefined.
  return s2 !== undefined && !!s1 && !s1.localeCompare(s2, undefined, { sensitivity: "base" });
}

function removeSequentialDuplicates(identifier: Iterable<string>) {
  const ids = [...identifier].filter((each) => !!each);
  for (let i = 0; i < ids.length; i++) {
    while (isEqual(ids[i], ids[i - 1])) {
      ids.splice(i, 1);
    }
    while (isEqual(ids[i], ids[i - 2]) && isEqual(ids[i + 1], ids[i - 1])) {
      ids.splice(i, 2);
    }
  }

  return ids;
}
// end ports from @azure-tools/codegen

/**
 * transforms Etag etc to all lower case.
 * this is to prevent inadvertently snake-casing
 * Etag to e_tag.
 * 
 * if name isn't some variant of Etag the
 * original value is returned.
 * 
 * @param name the name to transform
 * @returns etag or the original value
 */
export function fixETagName(name: string): string {
  return name.match(/^etag$/i) ? 'etag' : name;
}

/**
 * removes any illegal characters from the provided name.
 * note that characters _ and - are preserved so that the
 * proper snake-casing can be performed.
 * 
 * @param name the name to transform
 * @returns the transformed name or the original value
 */
function removeIllegalChars(name: string): string {
  return name.replace(/[!@#$%^&*()+=]/g, '');
}

/**
 * snake-cases the provided name
 * 
 * @param name the name to snake-case
 * @returns name in snake-case format
 */
export function snakeCaseName(name: string): string {
  return deconstruct(fixETagName(removeIllegalChars(name))).join('_');
}
