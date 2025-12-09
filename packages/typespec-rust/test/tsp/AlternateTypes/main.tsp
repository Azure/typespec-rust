import "@azure-tools/typespec-client-generator-core";
import "@azure-tools/typespec-azure-core";
import "@typespec/http";

using Azure.ClientGenerator.Core;
using TypeSpec.Http;

@service(#{
  title: "Alternate types tests",
})
namespace AlternateTypes;

model CrateAlternateType {
    thing: CrateTypeToReplace;
}

model CrateTypeToReplace {}

model ExternalType {
    thing: ExternalTypeToReplace;
}

model ExternalTypeToReplace{};

@route("/handwritten-type")
op bodyWithHandwrittenType(@body body: CrateTypeToReplace): void;

@route("/external-type")
op bodyWithExternalType(@body body: ExternalTypeToReplace): void;

@@access(AlternateTypes.CrateAlternateType, Access.public);
@@usage(AlternateTypes.CrateAlternateType, Usage.output);

@@access(AlternateTypes.ExternalType, Access.public);
@@usage(AlternateTypes.ExternalType, Usage.output);

@@alternateType(CrateTypeToReplace,
  {
    identity: "crate::models::HandWrittenType",
  },
  "rust"
);

@@alternateType(ExternalTypeToReplace,
  {
    identity: "time::Duration",
  },
  "rust"
);
