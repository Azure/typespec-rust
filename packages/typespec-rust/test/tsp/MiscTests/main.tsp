import "@azure-tools/typespec-client-generator-core";
import "@azure-tools/typespec-azure-core";
import "@typespec/http";

using Azure.ClientGenerator.Core;
using TypeSpec.Http;

@service(#{
  title: "Various emitter tests",
})
@server(
    "{endpoint}/supplemental-path",
    "Contains supplemental path with no params",
    {
        endpoint: url,
    }
)
namespace MiscTests;

model LiteralWithInvalidChar {
  name: string;
  thing?: "Foo.Bar" = "Foo.Bar";
}

@@access(LiteralWithInvalidChar, Access.public);
@@usage(LiteralWithInvalidChar, Usage.output);

@route("/literal-with-invalid-char")
op literalWithInvalidChar(@body body: LiteralWithInvalidChar): void;
