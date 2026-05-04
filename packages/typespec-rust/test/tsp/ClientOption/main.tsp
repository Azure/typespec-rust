import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using Azure.ClientGenerator.Core;
using TypeSpec.Http;

@service(#{
  title: "Tests the clientOption decorator",
})
@server(
  "{endpoint}",
  "The fake endpoint",
  {
      endpoint: url,
  }
)
namespace ClientOption;

model DeserializeWith {
  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  name: string;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  @encode(string)
  safeInt: safeint;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  base64: bytes;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  time: offsetDateTime;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  times: offsetDateTime[];
}

@@access(DeserializeWith, Access.public);
@@usage(DeserializeWith, Usage.output);

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(DeserializeWith.name, "deserialize_with", "crate::models::deserialize_name", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(DeserializeWith.safeInt, "deserialize_with", "crate::models::deserialize_safeint", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(DeserializeWith.base64, "deserialize_with", "crate::models::deserialize_base64", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(DeserializeWith.time, "deserialize_with", "crate::models::deserialize_time", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(DeserializeWith.times, "deserialize_with", "crate::models::deserialize_times", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(ClientOption, "omitEndpointMethod", true, "rust");

@post
@route("/foo")
op foo(): void;

namespace Test {
  @post
  @route("/bar")
  op bar(): void;
}

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(ClientOption.Test, "omitEndpointMethod", true, "rust");
