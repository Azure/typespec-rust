import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using TypeSpec.Http;
using Azure.ClientGenerator.Core;

@service
@client({ name: "EndpointClient", service: FakesEndpoints })
@server("{endpoint}/prefix/{tenant}/{server}/{version}", "Service endpoint", {
  endpoint: url,
  tenant: string,
  server: string,
  version: string = "v1",
})
namespace FakesEndpoints;

@route("/items")
@get
op get(): void;

@client({ name: "EndpointChildClient", service: FakesEndpoints })
@clientInitialization({ initializedBy: InitializedBy.individually | InitializedBy.parent })
@route("/child")
interface Child {
  @get
  op get(): void;
}
