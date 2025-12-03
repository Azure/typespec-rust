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

model ExpandParameter {
  @query("$expand")
  $expand?: string;
}

model LiteralWithInvalidChar {
  name: string;
  thing?: "Foo.Bar" = "Foo.Bar";
}

model `Contains.Invalid.Chars` {
  `my.name`: string;
}

@@access(LiteralWithInvalidChar, Access.public);
@@usage(LiteralWithInvalidChar, Usage.output);

@@access(`Contains.Invalid.Chars`, Access.public);
@@usage(`Contains.Invalid.Chars`, Usage.output);

@route("/literal-with-invalid-char")
op literalWithInvalidChar(@body body: LiteralWithInvalidChar): void;

@route("/with-optional-client-query-param")
op withOptionalClientQueryParam(...ExpandParameter): void;

@@clientInitialization(MiscTests,
  {
    parameters: ExpandParameter,
  }
);
