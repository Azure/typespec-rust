/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Context } from './context.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/** contains different types of enumerations to emit */
export interface Enums {
  /** enumerations that are part of public surface area */
  public?: helpers.Module;

  /** serde helpers for public enumerations */
  serde?: helpers.Module;

  /** trait impls for public enumerations */
  impls?: helpers.Module;
}

/**
 * returns the emitted enum types, or empty if the
 * crate contains no enum types.
 * 
 * @param crate the crate for which to emit enums
 * @param context the context for the provided crate
 * @returns the enum models or empty
 */
export function emitEnums(crate: rust.Crate, context: Context): Enums {
  if (crate.enums.length === 0) {
    return {};
  }

  return {
    public: emitEnumsPublic(crate),
    serde: emitEnumsSerde(crate),
    impls: emitEnumsImpls(crate, context),
  };
}

/**
 * emits the public definitions for enums
 * 
 * @param crate the crate for which to emit enums
 * @returns the public enum definitions
 */
function emitEnumsPublic(crate: rust.Crate): helpers.Module {
  const indent = new helpers.indentation();

  let body = '';
  for (const rustEnum of crate.enums) {
    body += emitEnumPublicDefinitions(indent, rustEnum);
  }

  let content = helpers.contentPreamble();
  content += body;

  return {
    name: 'enums',
    content: content,
  };
}

/**
 * emits the serde helpers for enums
 * 
 * @param crate the crate for which to emit serde helpers
 * @returns the enum serde helpers
 */
function emitEnumsSerde(crate: rust.Crate): helpers.Module {
  const use = new Use('modelsOther');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustEnum of crate.enums) {
    body += emitEnumSerdeDefinitions(indent, use, rustEnum);
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'enums_serde',
    content: content,
  };
}

/**
 * emits the trait impls for enums
 * 
 * @param crate the crate for which to emit trait impls
 * @param context the context for the provided crate
 * @returns the enum trait impls
 */
function emitEnumsImpls(crate: rust.Crate, context: Context): helpers.Module {
  const use = new Use('modelsOther');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustEnum of crate.enums) {
    body += emitEnumImplDefinitions(indent, use, rustEnum);
  }

  // emit impls as required
  for (const rustEnum of crate.enums) {
    body += context.getTryFromForRequestContent(rustEnum, use) ?? '';
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'enums_impl',
    content: content,
  };
}

/**
 * emits the public enum definitions
 * 
 * @param indent the indentation helper currently in scope
 * @param rustEnum the enum for which to emit the public definition
 * @returns the public definition text
 */
function emitEnumPublicDefinitions(indent: helpers.indentation, rustEnum: rust.Enum): string {
  let body = '';
  // The formatDocComment function adds a trailing \n we don't want.
  const docs = helpers.formatDocComment(rustEnum.docs, false);
  if (docs.length > 0) {
    body += indent.get() + `${docs.substring(0, docs.length - 1)}\n`;
  }
  // extensible enums that are numeric can derive Copy
  body += indent.get() + `#[derive(Clone, ${rustEnum.extensible && rustEnum.type === 'String' ? '' : 'Copy, '}Debug, Eq, PartialEq)]\n`;
  body += indent.get() + `#[non_exhaustive]\n`;
  body += indent.get() + `pub enum ${rustEnum.name} {\n`;
  indent.push();
  for (let i = 0; i < rustEnum.values.length; ++i) {
    const value = rustEnum.values[i];
    const docs = helpers.formatDocComment(value.docs, false);
    if (docs.length > 0) {
      body += indent.get() + `${docs.substring(0, docs.length - 1)}\n`;
    }
    body += indent.get() + `${value.name},\n`;
    body += '\n';
    if (rustEnum.extensible && i + 1 === rustEnum.values.length) {
      body += indent.get() + `/// Any other value not defined in \`${rustEnum.name}\`.\n`;
      body += indent.get() + `UnknownValue(${rustEnum.type}),\n`;
    }
  }
  body += indent.pop().get() + '}\n\n';

  return body;
}

/**
 * emits various trait impls for an enum
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param rustEnum the enum for which to emit trait impls
 * @returns the trait impls text
 */
function emitEnumImplDefinitions(indent: helpers.indentation, use: Use, rustEnum: rust.Enum): string {
  use.addForType(rustEnum);
  if (rustEnum.type === 'String') {
    return emitStringEnumImplDefinitions(indent, use, rustEnum);
  }
  return emitNumericEnumImplDefinitions(indent, use, rustEnum);
}

/**
 * emits various trait impls for a string based enum
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param rustEnum the enum for which to emit trait impls
 * @returns the trait impls text
 */
function emitStringEnumImplDefinitions(indent: helpers.indentation, use: Use, rustEnum: rust.Enum): string {
  let body = '';
  if (rustEnum.extensible) {
    use.add("std", "convert::From");
    body += indent.get() + `impl<'a> From<&'a ${rustEnum.name}> for &'a str {\n`;
    indent.push();
    body += indent.get() + `fn from(e: &'a ${rustEnum.name}) -> Self {\n`;
    indent.push();
    body += indent.get() + `match e {\n`;
    indent.push();
    for (let i = 0; i < rustEnum.values.length; ++i) {
      const value = rustEnum.values[i];
      body += indent.get() + `${rustEnum.name}::${value.name} => "${value.value}",\n`;
    }
    body += indent.get() + `${rustEnum.name}::UnknownValue(s) => s.as_ref(),\n`;
    body += indent.pop().get() + `}\n`; // end match
    body += indent.pop().get() + `}\n`; // end fn
    body += indent.pop().get() + `}\n\n`; // end impl
  }

  use.add("std", "str::FromStr");
  body += indent.get() + `impl FromStr for ${rustEnum.name} {\n`;
  indent.push();

  if (rustEnum.extensible) {
    use.add('std', 'convert::Infallible');
    body += indent.get() + `type Err = Infallible;\n`;
  } else {
    use.add('azure_core::error', 'Error', 'ErrorKind');
    body += indent.get() + `type Err = Error;\n`;
  }
  body += indent.get() + `fn from_str(s: &str) -> ::core::result::Result<Self, <Self as FromStr>::Err> {\n`;
  indent.push();
  body += indent.get() + `Ok(match s {\n`;
  indent.push();
  for (let i = 0; i < rustEnum.values.length; ++i) {
    const value = rustEnum.values[i];
    body += indent.get() + `"${value.value}" => ${rustEnum.name}::${value.name},\n`;
  }
  if (rustEnum.extensible) {
    body += indent.get() + `_ => ${rustEnum.name}::UnknownValue(s.to_string()),\n`;
  }
  else {
    body += indent.get() + `_ => { \n`;
    indent.push(); body += `return Err(Error::with_message_fn(ErrorKind::DataConversion, || {\n`;
    indent.push(); body += `format!("unknown variant of ${rustEnum.name} found: \\"{s}\\"")\n`;
    body += indent.pop().get() + `}))\n`;
    indent.pop().get(); body += `}\n`;
  }
  body += indent.pop().get() + `})\n`; // end match
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl

  use.add("std", "convert::AsRef");
  body += indent.get() + `impl AsRef<str> for ${rustEnum.name} {\n`;
  indent.push();
  body += indent.get() + `fn as_ref(&self) -> &str {\n`;
  indent.push();
  body += indent.get() + `match self {\n`;
  indent.push();
  for (let i = 0; i < rustEnum.values.length; ++i) {
    const value = rustEnum.values[i];
    body += indent.get() + `${rustEnum.name}::${value.name} => "${value.value}",\n`;
  }
  if (rustEnum.extensible) {
    body += indent.get() + `${rustEnum.name}::UnknownValue(s) => s.as_str(),\n`;
  }
  body += indent.pop().get() + `}\n`; // end match
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl

  use.add("std::fmt", "Display", "Formatter");
  body += indent.get() + `impl Display for ${rustEnum.name} {\n`;
  indent.push();
  body += indent.get() + `fn fmt(&self, f: &mut Formatter<'_>) -> ::std::fmt::Result {\n`;
  indent.push();
  body += indent.get() + `match self {\n`;
  indent.push();
  for (let i = 0; i < rustEnum.values.length; ++i) {
    const value = rustEnum.values[i];
    if (rustEnum.extensible) {
      body += indent.get() + `${rustEnum.name}::${value.name} => f.write_str("${value.value}"),\n`;
    }
    else {
      body += indent.get() + `${rustEnum.name}::${value.name} => Display::fmt("${value.value}", f),\n`;
    }
  }
  if (rustEnum.extensible) {
    body += indent.get() + `${rustEnum.name}::UnknownValue(s) => f.write_str(s.as_str()),\n`;
  }
  body += indent.pop().get() + `}\n`; // end match
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl

  return body;
}

/**
 * emits various trait impls for a numeric based enum
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param rustEnum the enum for which to emit trait impls
 * @returns the trait impls text
 */
function emitNumericEnumImplDefinitions(indent: helpers.indentation, use: Use, rustEnum: rust.Enum): string {
  let body = rustEnum.extensible ? '#[allow(unknown_lints)]\n#[allow(clippy::infallible_try_from)]\n' : '';
  body += `impl TryFrom<${rustEnum.type}> for ${rustEnum.name} {\n`;
  if (rustEnum.extensible) {
    use.add('std', 'convert::Infallible');
    body += `${indent.get()}type Error = Infallible;\n`;
  } else {
    use.add('azure_core::error', 'Error', 'ErrorKind');
    body += `${indent.get()}type Error = Error;\n`;
  }
  body += `${indent.get()}fn try_from(value: ${rustEnum.type}) -> Result<Self, Self::Error> {\n`;
  body += `${indent.push().get()}${helpers.buildMatch(indent, 'value', (() => {
    const matchArms = new Array<helpers.matchArm>();
    for (const value of rustEnum.values) {
      matchArms.push({
        pattern: value.value.toString(),
        body: (indent) => `${indent.get()}Ok(${rustEnum.name}::${value.name})\n`,
      });
    }
    matchArms.push({
      pattern: '_',
      body: (indent) => {
        if (rustEnum.extensible) {
          return `${indent.get()}Ok(${rustEnum.name}::UnknownValue(value))\n`;
        } else {
          use.add('azure_core', 'error::ErrorKind');
          return `${indent.get()}Err(Error::with_message_fn(ErrorKind::DataConversion, || {format!("unknown variant of ${rustEnum.name} found: {value}")}))\n`;
        }
      },
    });
    return matchArms;
  })())}\n`;
  body += `${indent.pop().get()}}\n`; // end try_from
  body += '}\n\n'; // end impl TryFrom

  body += `impl From<${rustEnum.name}> for ${rustEnum.type} {\n`;
  body += `${indent.get()}fn from(value: ${rustEnum.name}) -> Self {\n`;
  body += `${indent.push().get()}${helpers.buildMatch(indent, 'value', (() => {
    const matchArms = new Array<helpers.matchArm>();
    for (const value of rustEnum.values) {
      matchArms.push({
        pattern: `${rustEnum.name}::${value.name}`,
        body: (indent) => `${indent.get()}${value.value}\n`,
      });
    }
    if (rustEnum.extensible) {
      matchArms.push({
        pattern: `${rustEnum.name}::UnknownValue(value)`,
        body: (indent) => `${indent.get()}value\n`,
      });
    }
    return matchArms;
  })())}\n`;
  body += `${indent.pop().get()}}\n`; // end from
  body += '}\n\n'; // end impl From

  use.add("std::fmt", "Display", "Formatter");
  body += `impl Display for ${rustEnum.name} {\n`;
  body += `${indent.get()}fn fmt(&self, f: &mut Formatter<'_>) -> ::std::fmt::Result {\n`;
  body += `${indent.push().get()}${helpers.buildMatch(indent, 'self', (() => {
    const matchArms = new Array<helpers.matchArm>();
    for (const value of rustEnum.values) {
      matchArms.push({
        pattern: `${rustEnum.name}::${value.name}`,
        body: (indent) => `${indent.get()}Display::fmt(&${value.value}, f)\n`,
      });
    }
    if (rustEnum.extensible) {
      matchArms.push({
        pattern: `${rustEnum.name}::UnknownValue(value)`,
        body: (indent) => `${indent.get()}Display::fmt(&value, f)\n`,
      });
    }
    return matchArms;
  })())}\n`;
  body += `${indent.pop().get()}}\n`; // end fmt
  body += '}\n\n'; // end impl display

  return body;
}

/**
 * emits the serde helper definitions for an enum
 * 
 * @param indent the indentation helper currently in scope
 * @param use the use statement builder currently in scope
 * @param rustEnum the enum for which to emit the serde helpers
 * @returns the serde helpers text
 */
function emitEnumSerdeDefinitions(indent: helpers.indentation, use: Use, rustEnum: rust.Enum): string {
  use.addForType(rustEnum);
  use.add('serde', 'Deserialize', 'Serialize', 'Serializer', 'Deserializer');

  let body = '';
  body += indent.get() + `impl<'de> Deserialize<'de> for ${rustEnum.name} {\n`;
  indent.push();
  body += indent.get() + `fn deserialize<D>(deserializer: D) -> ::core::result::Result<Self, D::Error>\n`;
  body += indent.get() + `where\n`;
  body += indent.get() + `D: Deserializer<'de>,\n`;
  body += indent.get() + `{\n`;
  indent.push();
  if (rustEnum.type === 'String') {
    body += indent.get() + `let s = String::deserialize(deserializer)?;\n`;
    body += indent.get() + `s.parse().map_err(serde::de::Error::custom)\n`;
  } else {
    body += indent.get() + `${rustEnum.type}::deserialize(deserializer)?.try_into().map_err(serde::de::Error::custom)\n`;
  }
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl

  body += indent.get() + `impl Serialize for ${rustEnum.name} {\n`;
  indent.push();
  body += indent.get() + `fn serialize<S>(&self, s: S) -> ::core::result::Result<S::Ok, S::Error>\n`;
  body += indent.get() + `where\n`;
  body += indent.get() + `S: Serializer,\n`;
  body += indent.get() + `{\n`;
  indent.push();
  if (rustEnum.type === 'String') {
    body += indent.get() + `s.serialize_str(self.as_ref())\n`;
  } else {
    body += indent.get() + `s.serialize_${rustEnum.type}(${rustEnum.type}::from(*self))\n`;
  }
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl
  return body;
}
