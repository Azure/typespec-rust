import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using TypeSpec.Http;
using TypeSpec.Rest;
using Azure.Core;
using Azure.ClientGenerator.Core;

@service
@server("{endpoint}", "Service endpoint", { endpoint: url })
namespace Fakes;

enum Mode {
  first,
  second,
}

model Item {
  value: string;
}

model ItemPage {
  @pageItems
  value: Item[];
  @nextLink
  nextLink?: string;
}

@route("/items/{name}")
@get
op get(
  @path name: string,
  @query version?: string,
  @query(#{ explode: true }) tags?: string[],
  @header("name") headerName?: string,
  @query mode?: Mode,
): Item;

@route("/items/{name}/list")
@list
op list(@path name: string, @query count?: int32): ItemPage;

@route("/content")
@post
op put(@body content: bytes): Item;

@route("/model")
@post
op putModel(@body content: Item): Item;

@route("/spread")
@post
op spread(value: string, optional?: string): Item;

@route("/collisions")
@get
op collisions(@query context: string, @query frequency: int32, @query state: string): Item;

@route("/lro")
op start is LongRunningRpcOperation<
  { name: string },
  Azure.Core.Foundations.OperationStatus<Item>,
  Item
>;

@route("/child")
interface Child {
  @get
  op get(): Item;
}
