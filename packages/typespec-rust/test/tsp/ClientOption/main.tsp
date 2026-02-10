import "@azure-tools/typespec-client-generator-core";

using Azure.ClientGenerator.Core;

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

@@clientOption(DeserializeWith.name, "deserialize_with", "crate::models::deserialize_name", "rust");
@@clientOption(DeserializeWith.safeInt, "deserialize_with", "crate::models::deserialize_safeint", "rust");
@@clientOption(DeserializeWith.base64, "deserialize_with", "crate::models::deserialize_base64", "rust");
@@clientOption(DeserializeWith.time, "deserialize_with", "crate::models::deserialize_time", "rust");
@@clientOption(DeserializeWith.times, "deserialize_with", "crate::models::deserialize_times", "rust");
