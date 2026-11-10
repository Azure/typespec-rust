import "@azure-tools/typespec-azure-resource-manager";
import "@azure-tools/typespec-client-generator-core";
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
namespace ResourceManager;

@@clientName(Azure.ResourceManager.CommonTypes.ErrorDetail, "ResourceManagerErrorDetail", "rust");

model ServiceErrorDetail {
  code: string;
  message: string;
}

@error
model ServiceError {
  error: ServiceErrorDetail;
}

enum Versions {
  @armCommonTypesVersion(CommonTypes.Versions.v5)
  v1: "2026-05-15",
  v2: "2026-06-01",
}

@resource("vaults")
model Vault is TrackedResource<VaultProperties> {
  ...ResourceNameParameter<Vault>;
}

model VaultProperties {
  value?: string;
  @visibility(Lifecycle.Read)
  provisioningState?: string;
}

alias LocationResourceResponse<Resource extends Azure.ResourceManager.Foundations.SimpleResource> =
  | ArmResourceUpdatedResponse<Resource>
  | (ArmAcceptedLroResponse<
      LroHeaders = ArmLroLocationHeader<FinalResult = Resource> & Azure.Core.Foundations.RetryAfterHeader
    > & {
      @bodyRoot
      _: Resource;
    });

@resource("managedHsms")
model ManagedHsm is TrackedResource<VaultProperties> {
  ...ResourceNameParameter<ManagedHsm>;
}

@armResourceOperations
interface Vaults {
  createOrUpdate is ArmResourceCreateOrReplaceAsync<Vault, Response = LocationResourceResponse<Vault>, Error = ServiceError>;
  @route("/purge")
  @useFinalStateVia("location")
  purge is ArmResourceActionAsync<Vault, {}, void, Error = ServiceError>;
}

@armResourceOperations
interface ManagedHsms {
  createOrUpdate is ArmResourceCreateOrReplaceAsync<ManagedHsm, Response = LocationResourceResponse<ManagedHsm>, Error = ServiceError>;
  update is ArmCustomPatchAsync<ManagedHsm, Error = ServiceError>;
  delete is ArmResourceDeleteWithoutOkAsync<
    ManagedHsm,
    Response = ArmDeletedResponse | ArmDeleteAcceptedLroResponse | ArmDeletedNoContentResponse,
    Error = ServiceError
  >;
  @route("/purge")
  purge is ArmResourceActionAsyncBase<
    ManagedHsm,
    void,
    Response = ArmAcceptedLroResponse,
    BaseParameters = Azure.ResourceManager.Foundations.SubscriptionBaseParameters,
    Error = ServiceError
  >;
}

@armResourceOperations
interface VaultConnections {
  @route("/vault-connections")
  delete is ArmResourceDeleteWithoutOkAsync<Vault, Error = ServiceError>;
}

@armResourceOperations
interface HsmConnections {
  @route("/hsm-connections")
  delete is ArmResourceDeleteWithoutOkAsync<ManagedHsm, Error = ServiceError>;
}

model InlineResult {
  data: string;
}

model InlineMonitor is Azure.Core.Foundations.OperationStatus<InlineResult>;

@route("/original")
@get
op getOriginal(): InlineResult;

@route("/inline")
op inlineResult is LongRunningRpcOperation<{}, InlineMonitor, InlineResult>;

@route("/original")
@useFinalStateVia("original-uri")
op originalResult is LongRunningRpcOperation<{}, InlineMonitor, InlineResult>;

@route("/async")
@useFinalStateVia("azure-async-operation")
op asyncResult is ArmResourceCreateOrReplaceAsync<Vault, Error = ServiceError>;

model EmptyAccepted {
  @statusCode
  statusCode: 202;
  @header("azure-asyncoperation")
  @pollingLocation(StatusMonitorPollingOptions<ArmOperationStatus>)
  monitor: string;
}

@route("/empty")
@post
op emptyResult(): EmptyAccepted;

@route("/explicit-empty")
@post
@useFinalStateVia("azure-async-operation")
op explicitEmptyResult(): EmptyAccepted;

@route("/spread")
@post
op spread(value: string, optional?: string): EmptyAccepted;

enum RotationAction {
  notify: "notify",
  rotate: "Rotate",
}

model SecretProperties {
  value: string;
  contentType?: string;
  action?: RotationAction;
}

model SecretPatch {
  tags?: Record<string>;
  properties: SecretProperties;
}

@route("/secret")
@patch
op patchSecret(@body body: SecretPatch): SecretPatch;
