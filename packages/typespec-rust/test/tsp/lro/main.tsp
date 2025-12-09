import "@azure-tools/typespec-azure-core";
import "@typespec/rest";
import "@typespec/http";
import "@typespec/versioning";
import "@azure-tools/typespec-client-generator-core";

using TypeSpec.Rest;
using TypeSpec.Http;
using Azure.Core;
using Azure.Core.Traits;
using Azure.ClientGenerator.Core;
using TypeSpec.Versioning;

@useAuth(
  ApiKeyAuth<ApiKeyLocation.header, "Ocp-Apim-Subscription-Key"> | OAuth2Auth<[
    {
      type: OAuth2FlowType.authorizationCode,
      authorizationUrl: "https://login.microsoftonline.com/common/oauth2/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/token",
      scopes: ["https://cognitiveservices.azure.com/.default"],
    }
  ]>
)
@service(#{
  title: "Microsoft Cognitive Language Service - Analyze Text Authoring",
})
@versioned(Versions)
@server(
  "{Endpoint}/language",
  "The language service API is a suite of natural language processing (NLP) skills built with best-in-class Microsoft machine learning algorithms. The API can be used to analyze unstructured text for tasks such as sentiment analysis, key phrase extraction, language detection and question answering. Further documentation can be found in <a href=\"https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/overview\">https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/overview</a>.",
  {
    @format("url")
    Endpoint: string,
  }
)
namespace Language.Text.Authoring;


@lroStatus
union JobStatus {
  string,
  notStarted: "notStarted",
  running: "running",

  @lroSucceeded
  succeeded: "succeeded",

  @lroFailed
  failed: "failed",

  @lroCanceled
  cancelled: "cancelled",

  cancelling: "cancelling",
  partiallyCompleted: "partiallyCompleted",
}

model TextAnalysisAuthoringJobState {
  @key("jobId")
  @visibility(Lifecycle.Read)
  jobId: string;

  @clientName("createdOn", "csharp")
  createdDateTime: utcDateTime;

  @clientName("lastUpdatedOn", "csharp")
  lastUpdatedDateTime: utcDateTime;

  @clientName("expiresOn", "csharp")
  expirationDateTime?: utcDateTime;

  status: JobStatus;

  warnings?: Foundations.Error[];

  errors?: Foundations.Error[];
}

model TextAnalysisAuthoringSubTrainingJobState {
  percentComplete: int32;
  startDateTime?: utcDateTime;
  endDateTime?: utcDateTime;
  status: JobStatus;
}

model TextAnalysisAuthoringTrainingJobResult {
  modelLabel: string;
  trainingConfigVersion: string;
  trainingStatus: TextAnalysisAuthoringSubTrainingJobState;
  evaluationStatus?: TextAnalysisAuthoringSubTrainingJobState;
  estimatedEndDateTime?: utcDateTime;
}

enum Versions {
  v2023_04_01: "2023-04-01",
  v2024_11_15_preview: "2024-11-15-preview",
  v2025_05_15_preview: "2025-05-15-preview",
}

union ProjectKind {
  string,

  CustomSingleLabelClassification: "CustomSingleLabelClassification",
  CustomMultiLabelClassification: "CustomMultiLabelClassification",
  CustomEntityRecognition: "CustomEntityRecognition",

  @added(Versions.v2024_11_15_preview)
  CustomAbstractiveSummarization: "CustomAbstractiveSummarization",

  @added(Versions.v2024_11_15_preview)
  CustomHealthcare: "CustomHealthcare",

  @added(Versions.v2024_11_15_preview)
  CustomTextSentiment: "CustomTextSentiment",
}

model TextAnalysisAuthoringProjectSettings {
  confidenceThreshold?: float32;

  @added(Versions.v2024_11_15_preview)
  amlProjectPath?: string;

  @added(Versions.v2024_11_15_preview)
  isLabelingLocked?: boolean;

  @added(Versions.v2024_11_15_preview)
  runGptPredictions?: boolean;

  @added(Versions.v2024_11_15_preview)
  gptPredictiveLookahead?: int32;
}


@resource("authoring/analyze-text/projects")
model TextAnalysisAuthoringProjectMetadata {
  createdDateTime: utcDateTime;
  lastModifiedDateTime: utcDateTime;
  lastTrainedDateTime?: utcDateTime;
  lastDeployedDateTime?: utcDateTime;
  projectKind: ProjectKind;

  storageInputContainerName: string;
  settings?: TextAnalysisAuthoringProjectSettings;

  @key("projectName")
  @visibility(Lifecycle.Read)
  projectName: string;

  multilingual?: boolean;
  description?: string;
  language: string;
}

@resource("train/jobs")
@parentResource(TextAnalysisAuthoringProjectMetadata)
model TextAnalysisAuthoringTrainingJobState {
  ...TextAnalysisAuthoringJobState;
  result: TextAnalysisAuthoringTrainingJobResult;
}

alias ServiceTraits = NoRepeatableRequests &
  NoConditionalRequests &
  NoClientRequestId;

alias languageOperations = ResourceOperations<
  ServiceTraits,
  Foundations.ErrorResponse
>;

interface TextAuthoringProject {
  getTrainingStatus is languageOperations.ResourceRead<TextAnalysisAuthoringTrainingJobState>;

  @route("/authoring/analyze-text/projects/{projectName}/train/jobs/{jobId}/:cancel")
  @post
  @pollingOperation(TextAuthoringProject.getTrainingStatus)
  cancelTrainingJob is Foundations.LongRunningOperation<
    {
      @path
      projectName: string;

      @path
      jobId: string;
    },
    AcceptedResponse,
    {},
    Foundations.ErrorResponse
  >;
}
