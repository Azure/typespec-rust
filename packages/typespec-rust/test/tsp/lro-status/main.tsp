import "@azure-tools/typespec-azure-core";
import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;
using Azure.Core;
using Azure.Core.Traits;

@service(#{title: "LRO status test"})
namespace LroStatusTest;

union SnapshotStatus {
  provisioning: "provisioning",
  ready: "ready",
  archived: "archived",
  failed: "failed",
  string,
}

@resource("snapshots")
model Snapshot {
  @key("id")
  id: string;
  status: SnapshotStatus;
}

model OperationDetails {
  @key("operationId")
  operationId: string;
  status: Foundations.OperationState;
  requiredDetails: string;
}

alias operations = ResourceOperations<NoClientRequestId & NoConditionalRequests & NoRepeatableRequests, Foundations.ErrorResponse>;

interface Snapshots {
  get is operations.ResourceRead<Snapshot>;

  @route("/operations/{operationId}")
  @get
  op getOperation(@path operationId: string): OperationDetails;

  @route("/snapshots/status-flow")
  @put
  @pollingOperation(Snapshots.getOperation)
  @createsOrReplacesResource(Snapshot)
  op statusFlow is Foundations.LongRunningOperation<
    {},
    Snapshot,
    {},
    Foundations.ErrorResponse
  >;

  @route("/snapshots/monitor")
  @post
  @pollingOperation(Snapshots.getOperation)
  @createsOrReplacesResource(Snapshot)
  op monitor is Foundations.LongRunningOperation<
    {},
    OperationDetails,
    {},
    Foundations.ErrorResponse
  >;

  @route("/snapshots/mixed")
  @put
  @pollingOperation(Snapshots.getOperation)
  @createsOrReplacesResource(Snapshot)
  op mixed(@header("x-is-initial") isInitial: string):
    {
      @statusCode statusCode: 201;
      @body body: Snapshot;
      ...Foundations.LongRunningStatusLocation;
    } | {
      @statusCode statusCode: 202;
      @body body: OperationDetails;
      ...Foundations.LongRunningStatusLocation;
    } | Foundations.ErrorResponse;

}
