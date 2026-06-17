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

@encode(BytesKnownEncoding.base64url)
scalar base64urlBytes extends bytes;

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

model SerializeWith {
  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  name: string;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  base64: bytes;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  time: offsetDateTime;

  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  serializedTimes: offsetDateTime[];
}

@@access(SerializeWith, Access.public);
@@usage(SerializeWith, Usage.output);

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(SerializeWith.name, "serialize_with", "crate::models::serialize_name", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(SerializeWith.base64, "serialize_with", "crate::models::serialize_base64", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(SerializeWith.time, "serialize_with", "crate::models::serialize_time", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(SerializeWith.serializedTimes, "serialize_with", "crate::models::serialize_serialized_times", "rust");

// Validates that when a custom serialize_with/deserialize_with is specified for a
// collection type, the matching generated helper function is elided. Each field's
// collection type is intentionally unique (not shared with a field that needs the
// opposite direction), so the generated helper module exposes exactly one function.
// A regression that emits the elided helper would be visible in models_serde.rs.
model ListSerde {
  // custom serialize_with on Vec<bytes>; the generated
  // option_vec_encoded_bytes_std module must contain deserialize only.
  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  serializeOnly: bytes[];

  // custom deserialize_with on Vec<base64url bytes>; the generated
  // option_vec_encoded_bytes_url module must contain serialize only.
  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  deserializeOnly: base64urlBytes[];
}

@@access(ListSerde, Access.public);
@@usage(ListSerde, Usage.output);

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(ListSerde.serializeOnly, "serialize_with", "crate::models::serialize_bytes_list", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(ListSerde.deserializeOnly, "deserialize_with", "crate::models::deserialize_bytes_list", "rust");

// Validates the both-custom case: a single field carrying BOTH a custom
// serialize_with and deserialize_with. The emitter must add both custom params
// and emit no generated helper at all for this type. The collection type is
// intentionally unique (not referenced by any other scenario above), so the
// option_hashmap_encoded_bytes_std module must not appear in models_serde.rs.
model BothSerde {
  #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
  mapBytes: Record<bytes>;
}

@@access(BothSerde, Access.public);
@@usage(BothSerde, Usage.output);

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(BothSerde.mapBytes, "serialize_with", "crate::models::serialize_map_bytes", "rust");

#suppress "@azure-tools/typespec-client-generator-core/client-option"
@@clientOption(BothSerde.mapBytes, "deserialize_with", "crate::models::deserialize_map_bytes", "rust");

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
