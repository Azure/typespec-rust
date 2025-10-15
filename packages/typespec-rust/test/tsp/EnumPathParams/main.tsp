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
  title: "Optional enum path parameters",
})
namespace EnumPathParams;

enum FixedShape {
    Round: "round",
    Square: "square",
}

enum FixedValues {
    One: "one",
    Two: "two",
}

union ExtensibleShape {
    string,
    Round: "round",
    Square: "square",
}

union ExtensibleValues {
    string,
    One: "one",
    Two: "two",
}

@route("/optional/{request}/{value}")
op optionalExtensible(@path request: ExtensibleShape, @path value?: ExtensibleValues): NoContentResponse;

@route("/fixed/{request}/{coreReq}")
op optionalFixed(@path request: FixedShape, @path coreReq?: FixedValues): NoContentResponse;
