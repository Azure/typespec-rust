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

union NumericValues {
  OneTwo: 12,
  ThreeFour: 34,
}

@route("/optional/{shape}/{value}")
op optionalExtensible(@path shape: ExtensibleShape, @path value?: ExtensibleValues): NoContentResponse;

@route("/fixed/{shape}/{value}")
op optionalFixed(@path shape: FixedShape, @path value?: FixedValues): NoContentResponse;

@route("/numeric/{value}")
op numeric(@path value: NumericValues): NoContentResponse;

@@clientInitialization(EnumPathParams,
  {
    initializedBy: InitializedBy.customizeCode,
  }
);
