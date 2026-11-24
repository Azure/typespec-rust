import "@azure-tools/typespec-azure-resource-manager";
import "@azure-tools/typespec-client-generator-core";
import "@typespec/http";
import "@typespec/rest";
import "@typespec/versioning";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.Versioning;
using Azure.Core;
using Azure.ResourceManager;
using Azure.ClientGenerator.Core;

@armProviderNamespace
@service
@versioned(Versions)
namespace LroStatusArm;

enum Versions {
  v1: "2026-11-23",
}

@error
model ServiceError {
  code: string;
  message: string;
}

@lroStatus
union ValidationStatus {
  running: "Running",
  @lroSucceeded
  succeeded: "Succeeded",
  @lroFailed
  needsReview: "NeedsReview",
}

model ValidationResultProperties {
  @visibility(Lifecycle.Read)
  @lroStatus
  status: ValidationStatus;
}

@resource("validationResults")
model ValidationResult is TrackedResource<ValidationResultProperties> {
  ...ResourceNameParameter<ValidationResult>;
}

alias LocationResourceResponse<Resource extends Azure.ResourceManager.Foundations.SimpleResource> =
  | ArmResourceUpdatedResponse<Resource>
  | (ArmAcceptedLroResponse<
      LroHeaders = ArmLroLocationHeader<FinalResult = Resource> & Azure.Core.Foundations.RetryAfterHeader
    > & {
      @bodyRoot
      _: Resource;
    });

@armResourceOperations
interface ValidationResults {
  createOrUpdate is ArmResourceCreateOrReplaceAsync<
    ValidationResult,
    Response = LocationResourceResponse<ValidationResult>,
    Error = ServiceError
  >;
}
