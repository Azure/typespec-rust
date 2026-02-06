import "@azure-tools/typespec-client-generator-core";

using Azure.ClientGenerator.Core;

namespace ClientOption;

model DeserializeWith {
    #suppress "@azure-tools/typespec-client-generator-core/client-option" "Testing functionality"
    name: string;
}

@@access(DeserializeWith, Access.public);
@@usage(DeserializeWith, Usage.output);

@@clientOption(DeserializeWith.name, "deserialize_with", "crate::models::deserialize_name", "rust");
