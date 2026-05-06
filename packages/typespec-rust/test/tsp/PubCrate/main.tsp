import "@azure-tools/typespec-client-generator-core";
import "@azure-tools/typespec-azure-core";
import "@typespec/http";

using Azure.ClientGenerator.Core;
using Azure.Core;
using TypeSpec.Http;

@service(#{
  title: "All contents are pub(crate)",
})
namespace MiscTests;

union Colors {
  string,
  Red: "red",
  Green: "green",
  Blue: "blue",
}

model Widget {
  name: string;
  color: Colors;
}

@access(Access.internal)
@list
op listWidgets(@query count?: int32): Page<Widget>;
