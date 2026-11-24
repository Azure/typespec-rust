import "@azure-tools/typespec-azure-core";
import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;
using Azure.Core;
using Azure.Core.Traits;

@service(#{title: "LRO status test"})
namespace LroStatusTest;

@lroStatus
union SnapshotStatus {
  provisioning: "provisioning",
  running: "Running",
  @lroSucceeded
  complete: "completed",
  @lroFailed
  needsReview: "NeedsReview",
  @lroFailed
  rejected: "Rejected",
  @lroCanceled
  cancelled: "CANCELLED",
}

@resource("snapshots")
model Snapshot {
  @key("id")
  id: string;

  @lroStatus
  status: SnapshotStatus;
}

@lroStatus
union InitialSnapshotStatus {
  running: "Running",
  @lroSucceeded
  succeeded: "Succeeded",
  @lroFailed
  completed: "completed",
}

model InitialSnapshot {
  id: string;

  @lroStatus
  initialStatus: InitialSnapshotStatus;
}

model OptionalStatusProperties {
  status?: SnapshotStatus | null;
}

model OptionalInitialSnapshot {
  properties?: OptionalStatusProperties | null;
}

model NullableStatusProperties {
  status: SnapshotStatus | null;
}

model NullableInitialSnapshot {
  properties: NullableStatusProperties | null;
}

alias operations = ResourceOperations<NoClientRequestId & NoConditionalRequests & NoRepeatableRequests, Foundations.ErrorResponse>;

interface Snapshots {
  get is operations.ResourceRead<Snapshot>;

  @route("/snapshots/nullable")
  @put
  @pollingOperation(Snapshots.get)
  @createsOrReplacesResource(Snapshot)
  op nullableStatus is Foundations.LongRunningOperation<
    {},
    NullableInitialSnapshot,
    {},
    Foundations.ErrorResponse
  >;

  @route("/snapshots/optional")
  @put
  @pollingOperation(Snapshots.get)
  @createsOrReplacesResource(Snapshot)
  op optionalStatus is Foundations.LongRunningOperation<
    {},
    OptionalInitialSnapshot,
    {},
    Foundations.ErrorResponse
  >;

  @route("/snapshots/location")
  @put
  @pollingOperation(Snapshots.get)
  @createsOrReplacesResource(Snapshot)
  op locationStatus is Foundations.Operation<
    {},
    InitialSnapshot & {
      @pollingLocation
      @header("Location")
      location: ResourceLocation<Snapshot>;
    },
    {},
    Foundations.ErrorResponse
  >;

  @route("/snapshots/status-flow")
  @put
  @pollingOperation(Snapshots.get)
  @createsOrReplacesResource(Snapshot)
  op statusFlow is Foundations.LongRunningOperation<
    {},
    InitialSnapshot,
    {},
    Foundations.ErrorResponse
  >;

  @route("/snapshots")
  @post
  @pollingOperation(Snapshots.get)
  op begin is Foundations.LongRunningOperation<
    {},
    InitialSnapshot,
    {},
    Foundations.ErrorResponse
  >;
}
