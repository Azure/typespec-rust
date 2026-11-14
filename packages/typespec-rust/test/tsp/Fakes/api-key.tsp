import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using TypeSpec.Http;
using Azure.ClientGenerator.Core;

@service
@client({ name: "FakesApiKeyClient", service: FakesApiKey })
@useAuth(ApiKeyAuth<ApiKeyLocation.header, "x-api-key">)
@server("{endpoint}/prefix/{tenant}/{server}/{version}", "Service endpoint", {
  endpoint: url,
  tenant: string,
  server: string,
  version: string = "v1",
})
namespace FakesApiKey;

model ClientInputs {
  @header resource: string;
}

@@clientInitialization(FakesApiKey, { parameters: ClientInputs });

@get
@route("/items")
op get(...ClientInputs): void;

@clientInitialization({
  initializedBy: InitializedBy.individually | InitializedBy.parent,
  parameters: ClientInputs,
})
@route("/child")
@client({ name: "ChildClient", service: FakesApiKey })
interface Child {
  @get
  op get(...ClientInputs): void;
}
