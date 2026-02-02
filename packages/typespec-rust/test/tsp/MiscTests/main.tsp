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

model ExplodedQueryParams {
  @query(#{ name: "exploded-ints", explode: true })
  ints: int32[];

  @query(#{ name: "exploded-strings", explode: true })
  strings: string[];

  @query(#{ name: "exploded-string-enums", explode: true })
  colors: Colors[];

  @query(#{ name: "exploded-int-enums", explode: true })
  indices: Indices[];

  @query(#{ name: "optional-exploded-ints", explode: true })
  optInts?: int32[];

  @query(#{ name: "optional-exploded-strings", explode: true })
  optStrings?: string[];

  @query(#{ name: "optional-exploded-string-enums", explode: true })
  optColors?: Colors[];

  @query(#{ name: "optional-exploded-int-enums", explode: true })
  optIndices?: Indices[];
}

model LiteralNumericEnum {
  property: Indices.two;
}

model LiteralWithInvalidChar {
  name: string;
  thing?: "Foo.Bar" = "Foo.Bar";
}

model `Contains.Invalid.Chars` {
  `my.name`: string;
}

union Colors {
  string,
  blue: "blue",
  green: "green",
  yellow: "yellow",
}

union Indices {
  int32,
  one: 1,
  two: 2,
  three: 3,
}

union HasCollidingNames {
  "application/json",
  "application/*+json",
  "application/xml",
  "application/*xml",
  "application/*+xml",
  "text/plain",
};

@@access(LiteralNumericEnum, Access.public);
@@usage(LiteralNumericEnum, Usage.output);

@@access(LiteralWithInvalidChar, Access.public);
@@usage(LiteralWithInvalidChar, Usage.output);

@@access(`Contains.Invalid.Chars`, Access.public);
@@usage(`Contains.Invalid.Chars`, Usage.output);

@@access(HasCollidingNames, Access.public);
@@usage(HasCollidingNames, Usage.output);

@route("/colliding-options-param")
op collidingOptionsParam(@header("options") options: string): void;

@route("/avoid-dupe-headers-one")
op avoidDupeHeadersOne(): {
  @header("location") location: string;
};

@route("/avoid-dupe-headers-two")
op avoidDupeHeadersTwo(): {
  @header("Location") location: string;
};

@route("/literal-with-invalid-char")
op literalWithInvalidChar(@body body: LiteralWithInvalidChar): void;

@route("/with-optional-client-query-param")
op withOptionalClientQueryParam(...ExpandParameter): void;

@route("/various-exploded-query-params")
op variousExplodedQueryParams(...ExplodedQueryParams): void;

@route("/etag-header-parameter")
op etagHeaderParameter(@header etag: Azure.Core.eTag): void;

@@clientInitialization(MiscTests,
  {
    parameters: ExpandParameter,
  }
);
