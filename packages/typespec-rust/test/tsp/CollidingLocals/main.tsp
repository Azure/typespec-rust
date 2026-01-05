import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";

using Azure.ClientGenerator.Core;
using Http;

@useAuth(
  [
    OAuth2Auth<[
      {
        type: OAuth2FlowType.implicit,
        description: "We can use OAuth2 Implicit flow to get the auth token for calling the APIs.",
        authorizationUrl: "https://login.microsoftonline.com/common/oauth2/authorize",
        scopes: ["https://contoso.com/.default"],
      }
    ]>,
    OAuth2Auth<[
      {
        type: OAuth2FlowType.authorizationCode,
        description: "We can use OAuth2 Authorization Code flow to get the auth token for calling the APIs.",
        authorizationUrl: "https://login.microsoftonline.com/common/oauth2/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/v2.0/oauth2/token",
        scopes: ["https://contoso.com/.default"],
      }
    ]>
  ]
)
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

@route("/colliding/optional/request")
op collidesWithOptionalRequest(@body request?: Widget): NoContentResponse;

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
