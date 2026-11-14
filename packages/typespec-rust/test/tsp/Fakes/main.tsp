import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";
import "./endpoints.tsp";
import "./api-key.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Azure.Core;
using Azure.ClientGenerator.Core;

@service
@client({ name: "FakesClient", service: Fakes })
@server("{endpoint}", "Service endpoint", { endpoint: url })
namespace Fakes;

enum Mode {
  first,
  second,
}

model Item {
  value: string;
}

model Body {
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

@route("/named-body")
@post
op putNamedBody(@body content: Body): Item;

@route("/fixed-options")
@get
op fixedOptions(
  @query mode?: Mode.first,
  @header("x-mode") header?: Mode.second,
): Item;

@route("/optional")
@post
op putOptional(@body payload?: bytes): Item;

@route("/optional/list")
@post
@list
op listOptional(@body payload?: bytes, @query state?: string): ItemPage;

model GroupedInputs {
  @path name: string;
  @header label: string;
  @query count?: int32;
  @query fixed: "fixed";
  @header("x-fixed") fixedHeader: Mode.first;
}

@route("/grouped/{name}")
@get
op grouped(...GroupedInputs): Item;

op groupedOverride(inputs: GroupedInputs): Item;
@@override(grouped, groupedOverride);

model FixedInputs {
  @query fixed: "fixed";
  @header("x-fixed") fixedHeader: Mode.first;
}

@route("/fixed-group")
@get
op fixedGroup(...FixedInputs): Item;

op fixedGroupOverride(inputs: FixedInputs): Item;
@@override(fixedGroup, fixedGroupOverride);

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
@client({ name: "ChildClient", service: Fakes })
interface Child {
  @get
  op get(): Item;
}
