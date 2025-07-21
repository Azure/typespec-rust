import "@azure-tools/typespec-azure-core";
import "@typespec/http";
import "@typespec/rest";

using Azure.Core;
using TypeSpec.Http;
using TypeSpec.Rest;

@useAuth(ApiKeyAuth<ApiKeyLocation.header, "api-key">)
@service({
  title: "Test Reinjection",
  version: "2024-01-01",
})
namespace TestReinjection;

model Item {
  id: string;
  name: string;
}

model QueryFilter {
  category?: string;
  status?: string;
}

@pagedResult
model PagedItems {
  @items
  items: Item[];

  @nextLink
  nextLink?: url;
}

@route("/items")
interface ItemsClient {
  @get
  list(@query filter?: QueryFilter): PagedItems;
}
