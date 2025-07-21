import "@azure-tools/typespec-azure-core";
import "@typespec/http";
import "@typespec/rest";

@useAuth(ApiKeyAuth<ApiKeyLocation.header, "api-key">)
@service({
  title: "Pageable Reinjection Test Service",
  version: "2024-01-01",
})
namespace PageableReinjectionService;

using Azure.Core;
using TypeSpec.Http;
using TypeSpec.Rest;

@doc("A test item in a pageable response")
model TestItem {
  @doc("The ID of the item")
  id: string;

  @doc("The name of the item")
  name: string;
}

@doc("Filter to apply to the items")
model Filter {
  @doc("Filter by category")
  category?: string;

  @doc("Filter by status")
  status?: string;
}

@doc("A response containing a page of test items with reinjected parameters")
@pagedResult
model PagedTestItems {
  @doc("The list of items")
  @items
  value: TestItem[];

  @doc("The URL for the next page")
  @nextLink 
  nextLink?: url;

  @doc("Filter parameters to be reinjected in subsequent requests")
  @reinjected
  filter?: Filter;
}

@route("/items")
@get
@doc("List test items with filtering and pagination")
op listItems(
  @doc("Filter criteria") 
  @query filter?: Filter,

  @doc("Maximum number of items to return") 
  @query maxpagesize?: int32,
): PagedTestItems;
