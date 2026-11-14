// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as rust from '../codemodel/index.js';
import * as helpers from './helpers.js';
import { CodegenError } from './errors.js';

export interface MethodParameter {
  name: string;
  type: rust.Type;
  mut?: boolean;
}

/** Parameters exposed by ordinary operations, excluding self and options. */
export function methodParameters(method: Exclude<rust.MethodType, rust.ClientAccessor>): Array<MethodParameter> {
  const params: Array<MethodParameter> = [];
  const groups = new Set<string>();
  for (const param of method.params) {
    if (param.group) {
      if (!groups.has(param.group.name)) {
        groups.add(param.group.name);
        params.push({ name: param.group.name, type: param.group.type });
      }
      continue;
    }
    if (['literal', 'enumValue'].includes(helpers.unwrapType(param.type).kind)) continue;
    if (param.location === 'method' && !param.optional) {
      params.push({ name: param.name, type: param.kind === 'partialBody' ? param.paramType : param.type, mut: param.mut });
    }
  }
  return params;
}

export function requiredConstructorParameters(params: Array<rust.ClientParameter>): Array<rust.ClientParameter> {
  return params.filter(param => !param.optional);
}

/** Joins the modeled server suffix identically for real and fake clients. */
export function supplementalEndpoint(
  indent: helpers.indentation,
  endpoint: string,
  supplemental: rust.SupplementalEndpoint | undefined,
): string {
  if (!supplemental) return '';
  let body = '';
  if (supplemental.parameters.length) {
    body += `${indent.get()}let mut host = String::from("${supplemental.path}");\n`;
    for (const param of supplemental.parameters) {
      const name = param.optional ? `options.${param.name}` : param.name;
      const type = helpers.unwrapType(param.type);
      let value: string;
      switch (type.kind) {
        case 'String': value = `&${name}`; break;
        case 'enum': value = `${name}.as_ref()`; break;
        case 'offsetDateTime':
        case 'scalar': value = `&${name}.to_string()`; break;
        case 'str': value = name; break;
        default: throw new CodegenError('InternalError', `unhandled ${param.kind} param type kind ${param.type.kind}`);
      }
      body += `${indent.get()}host = host.replace("{${param.segment}}", ${value});\n`;
    }
    body += `${indent.push().get()}${endpoint} = ${endpoint}.join(&host)?;\n`;
  } else {
    body += `${indent.push().get()}${endpoint} = ${endpoint}.join("${supplemental.path}")?;\n`;
  }
  return body;
}
