import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;
using Azure.Core;
using Azure.Core.Traits;

@service(#{title: "Undeclared LRO status test"})
namespace UndeclaredLroStatusTest;

@lroStatus
union OperationStatus {
  Succeeded: "Complete",
  Failed: "Rejected",
  running: "Running",
}

@resource("snapshots")
model Snapshot {
  @key("id")
  id: string;

  @lroStatus
  status: OperationStatus;
}

alias operations = ResourceOperations<NoClientRequestId & NoConditionalRequests & NoRepeatableRequests, Foundations.ErrorResponse>;

interface Snapshots {
  get is operations.ResourceRead<Snapshot>;

  @route("/snapshots")
  @post
  @pollingOperation(Snapshots.get)
  op begin is Foundations.LongRunningOperation<
    {},
    Snapshot,
    {},
    Foundations.ErrorResponse
  >;
}
