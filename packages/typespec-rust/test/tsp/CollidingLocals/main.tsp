import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using Azure.ClientGenerator.Core;
using Http;

@server(
  "{bogusUrl}",
  "Customized host name for a service that doesn't exist.",
  {
    @clientName("bogusUrl")
    bogusUrl: url,
  }
)
@service(#{
  title: "Test colliding local var names",
})
namespace CollidingLocals;

model WidgetPage {
  @pageItems
  values: Widget[];
}

model WidgetPages {
  @pageItems
  values: Widget[];

  @nextLink
  nextLink?: string;
}

model Widget {
  weight: int32;
}

@route("/colliding/{request}")
op collidesWithRequest(@path request: string): NoContentResponse;

@route("/colliding/{request}/{coreReq}")
op collidesWithCoreReq(@path request: string, @path coreReq: string): NoContentResponse;

@route("/colliding/{path}/{url}")
op collidesWithPathAndUrl(@path path: string, @path url: string): NoContentResponse;

@route("/colliding/{request}/{coreReq}/{path}/{url}")
op collidesWithEverything(@path request: string, @path coreReq: string, @path path: string, @path url: string): NoContentResponse;

@route("/list/page/colliding/{request}/{coreReq}/{path}/{url}")
@list
op listWithCollisionsPage(@path request: string, @path coreReq: string, @path path: string, @path url: string): WidgetPage;

@route("/list/pages/colliding/{request}/{coreReq}/{path}/{url}")
@list
op listWithCollisionsPages(@path request: string, @path coreReq: string, @path path: string, @path url: string): WidgetPages;
