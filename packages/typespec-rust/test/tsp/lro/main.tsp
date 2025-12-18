import "@azure-tools/typespec-azure-core";
import "@typespec/rest";
import "@typespec/http";

using TypeSpec.Rest;
using TypeSpec.Http;
using Azure.Core;
using Azure.Core.Traits;

@service(#{title: "T"})
namespace N;

@lroStatus
union S {
  @lroSucceeded
  succeeded: "succeeded",

  @lroFailed
  failed: "failed",
}

@resource("x")
model X {
  @key("a")
  a: string;

  status: S;
}

model Y {
  b?: string;
}

alias r = ResourceOperations<NoClientRequestId & NoConditionalRequests & NoRepeatableRequests, Foundations.ErrorResponse>;

interface I {
  getStatus is r.ResourceRead<X>;

  @route("/lro/incorrect-custom-op-ref")
  @post
  @pollingOperation(I.getStatus)
  incorrectCustomOpRef is Foundations.LongRunningOperation<
    {
      @path
      a: string;
    },
    AcceptedResponse,
    {},
    Foundations.ErrorResponse
  >;

  @route("/lro/partial-body")
  @pollingOperation(I.getStatus)
  op partialBody is Foundations.LongRunningOperation<
    Y,
    AcceptedResponse,
    {},
    Foundations.ErrorResponse
  >;
}
