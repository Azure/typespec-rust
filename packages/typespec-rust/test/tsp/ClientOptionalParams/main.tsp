import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using TypeSpec.Http;
using Azure.ClientGenerator.Core;

@service(#{
  title: "Test optional client param is propagated",
})
namespace ClientOptionalParams {
  model ExpandParameter {
    @query("$expand")
    $expand?: string;
  }

  namespace WithExpand {
    @route("/with")
    op test(@query("$expand")$expand?: string): void;
  }

  namespace WithoutExpand {
    @route("/without")
    op test(): void;
  }
}

@@clientInitialization(ClientOptionalParams,
  {
    parameters: ClientOptionalParams.ExpandParameter,
  },
);
