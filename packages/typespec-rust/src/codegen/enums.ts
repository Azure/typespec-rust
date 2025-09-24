/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Context } from './context.js';
import * as helpers from './helpers.js';
import { Use } from './use.js';
import * as rust from '../codemodel/index.js';

/**
 * returns the emitted enum types, or undefined if the
 * crate contains no enum types.
 * 
 * @param crate the crate for which to emit enums
 * @param context the context for the provided crate
 * @returns the enum content or undefined
 */
export function emitEnums(crate: rust.Crate, context: Context): helpers.Module | undefined {
  if (crate.enums.length === 0) {
    return undefined;
  }

  const use = new Use('models');
  const indent = new helpers.indentation();

  let body = '';
  for (const rustEnum of crate.enums) {
    body += create_enum(use, rustEnum, indent);
  }

  // emit impls as required
  for (const rustEnum of crate.enums) {
    body += context.getTryFromForRequestContent(rustEnum, use) ?? '';
  }

  let content = helpers.contentPreamble();
  content += use.text();
  content += body;

  return {
    name: 'enums',
    content: content,
  };
}

function create_enum(use: Use, rustEnum: rust.Enum, indent: helpers.indentation): string {

  let body = '';
  // THe formatDocComment function adds a trailing \n we don't want.
  const docs = helpers.formatDocComment(rustEnum.docs, false);
  if (docs.length > 0) {
    body += indent.get() + `${docs.substring(0, docs.length - 1)}\n`;
  }
  body += indent.get() + `#[derive(Debug, PartialEq, Eq, Clone`
  if (!rustEnum.extensible) {
    body += ', Copy';
  }
  body += `)]\n`;
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
      body += indent.get() + `UnknownValue(String)`;
    }
  }
  body += indent.pop().get() + '}\n\n';

  // Now add conversions to and from &str, Display, Serialize, Deserialize


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
  }
  else {
    use.add('azure_core', 'error::Error', 'error::ErrorKind');
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
    body += indent.get() + `_ => return Err(Error::with_message_fn(ErrorKind::DataConversion, || format!("unknown variant of ${rustEnum.name} found: \\"{s}\\"")))\n`;
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

  use.add("std", "fmt::Display", "fmt::Formatter");
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

  body += emit_serde_impls(use, rustEnum, indent);

  return body;
}

function emit_serde_impls(use: Use, rustEnum: rust.Enum, indent: helpers.indentation): string {
  use.add('serde', 'Deserialize', 'Serialize', 'Serializer', 'Deserializer');
  let body = '';
  body += indent.get() + `impl<'de> Deserialize<'de> for ${rustEnum.name} {\n`;
  indent.push();
  body += indent.get() + `fn deserialize<D>(deserializer: D) -> ::core::result::Result<Self, D::Error>\n`;
  body += indent.get() + `where\n`;
  body += indent.get() + `D: Deserializer<'de>,\n`;
  body += indent.get() + `{\n`;
  indent.push();
  body += indent.get() + `let s = String::deserialize(deserializer)?;\n`;
  body += indent.get() + `s.parse().map_err(serde::de::Error::custom)\n`;
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl

  body += indent.get() + `impl Serialize for ${rustEnum.name} {\n`;
  indent.push();
  body += indent.get() + `fn serialize<S>(&self, s: S) -> ::core::result::Result<S::Ok, S::Error>\n`;
  body += indent.get() + `where\n`;
  body += indent.get() + `S: Serializer,\n`;
  body += indent.get() + `{\n`;
  indent.push();
  body += indent.get() + `s.serialize_str(self.as_ref())\n`;
  body += indent.pop().get() + `}\n`; // end fn
  body += indent.pop().get() + `}\n\n`; // end impl
  return body;
}