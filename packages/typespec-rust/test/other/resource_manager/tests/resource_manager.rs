// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use azure_core::{
    cloud::{
        resource_manager::{Audience, CloudConfigurationExt as _},
        Audiences, CloudConfiguration, CustomConfiguration,
    },
    credentials::{AccessToken, TokenCredential, TokenRequestOptions},
    error::{ErrorKind, ErrorResponse},
    http::{
        headers::{HeaderName, Headers, ACCEPT, AUTHORIZATION},
        poller::resource_manager::PollerOptions,
        request::{options::ClientRequestId, Body},
        AsyncRawResponse, ClientOptions, Context, HttpClient, Method, Request, RetryOptions,
        StatusCode, Transport, Url,
    },
    time::{Duration, OffsetDateTime},
    Error, Result,
};
use azure_resourcemanager_test::{models::*, ResourceManagerClient, ResourceManagerClientOptions};
use futures::StreamExt as _;
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

const VAULT: &str =
    "/subscriptions/sub/resourceGroups/group/providers/ResourceManager/vaults/vault";
const HSM: &str =
    "/subscriptions/sub/resourceGroups/group/providers/ResourceManager/managedHsms/hsm";

#[derive(Debug)]
struct Credential;

#[async_trait::async_trait]
impl TokenCredential for Credential {
    async fn get_token(
        &self,
        scopes: &[&str],
        _: Option<TokenRequestOptions<'_>>,
    ) -> Result<AccessToken> {
        Ok(AccessToken::new(
            scopes.join(" "),
            OffsetDateTime::now_utc() + Duration::hours(1),
        ))
    }
}

struct Step {
    method: Method,
    path: String,
    response: Result<AsyncRawResponse>,
    body: Option<Value>,
}

fn step(method: Method, path: &str, status: StatusCode, body: &'static [u8]) -> Step {
    let mut headers = Headers::new();
    headers.insert("retry-after-ms", "0");
    headers.insert("test-header", "preserved");
    Step {
        method,
        path: path.into(),
        response: Ok(AsyncRawResponse::from_bytes(status, headers, body)),
        body: None,
    }
}

fn accepted(method: Method, path: &str, header: &'static str) -> Step {
    let mut headers = Headers::new();
    headers.insert("retry-after-ms", "0");
    headers.insert(header, "/operations/1?api-version=service-version");
    Step {
        response: Ok(AsyncRawResponse::from_bytes(
            StatusCode::Accepted,
            headers,
            b"".as_slice(),
        )),
        ..step(method, path, StatusCode::Accepted, b"")
    }
}

struct Script {
    steps: Mutex<VecDeque<Step>>,
    endpoint: Url,
    scope: String,
    request_id: Option<&'static str>,
    api_version: bool,
}

impl std::fmt::Debug for Script {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Script").finish_non_exhaustive()
    }
}

#[async_trait::async_trait]
impl HttpClient for Script {
    async fn execute_request(&self, request: &Request) -> Result<AsyncRawResponse> {
        let next = self
            .steps
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected request");
        assert_eq!(request.method(), next.method);
        assert_eq!(request.url().host_str(), self.endpoint.host_str());
        assert_eq!(request.url().path(), next.path);
        assert_eq!(
            request.headers().get_optional_str(&AUTHORIZATION),
            Some(format!("Bearer {}", self.scope).as_str())
        );
        if self.api_version {
            assert_eq!(
                request
                    .url()
                    .query_pairs()
                    .find(|(k, _)| k == "api-version")
                    .map(|(_, v)| v.into_owned()),
                Some("2026-05-15".into())
            );
        }
        if let Some(id) = self.request_id {
            assert_eq!(
                request
                    .headers()
                    .get_optional_str(&HeaderName::from_static("x-ms-client-request-id")),
                Some(id)
            );
            assert_eq!(
                request.headers().get_optional_str(&ACCEPT),
                Some("application/json")
            );
        }
        if request.method() == Method::Get {
            assert!(matches!(request.body(), Body::Bytes(bytes) if bytes.is_empty()));
        }
        if let Some(expected) = next.body {
            let Body::Bytes(bytes) = request.body() else {
                panic!("expected bytes")
            };
            assert_eq!(serde_json::from_slice::<Value>(bytes)?, expected);
        }
        next.response
    }
}

fn client(
    steps: Vec<Step>,
    cloud: Option<Arc<CloudConfiguration>>,
    request_id: Option<&'static str>,
) -> Result<(ResourceManagerClient, Arc<Script>)> {
    let configuration = cloud.as_deref().unwrap_or_default();
    let api_version = steps
        .first()
        .is_some_and(|step| step.path.contains("/subscriptions/"));
    let script = Arc::new(Script {
        steps: Mutex::new(steps.into()),
        endpoint: Url::parse(configuration.endpoint().unwrap())?,
        scope: configuration.default_scope()?.into_owned(),
        request_id,
        api_version,
    });
    let client = ResourceManagerClient::new(
        "sub".into(),
        Arc::new(Credential),
        Some(ResourceManagerClientOptions {
            client_options: ClientOptions {
                cloud,
                transport: Some(Transport::new(script.clone())),
                retry: RetryOptions::none(),
                ..Default::default()
            },
            ..Default::default()
        }),
    )?;
    Ok((client, script))
}

#[tokio::test]
async fn default_sovereign_and_custom_clouds_delegate_to_core() -> Result<()> {
    let mut custom = CustomConfiguration::default();
    custom.authority_host = "https://identity.example".into();
    custom.endpoint = Some("https://management.example".into());
    custom.audiences = Audiences::new().with::<Audience>("https://audience.example".into());
    for cloud in [
        None,
        Some(Arc::new(CloudConfiguration::AzurePublic)),
        Some(Arc::new(CloudConfiguration::AzureGovernment)),
        Some(Arc::new(CloudConfiguration::AzureChina)),
        Some(Arc::new(custom.into())),
    ] {
        let expected = cloud
            .as_deref()
            .unwrap_or_default()
            .endpoint()
            .unwrap()
            .to_string();
        let (client, script) = client(
            vec![step(
                Method::Get,
                "/original",
                StatusCode::Ok,
                br#"{"data":"ok"}"#,
            )],
            cloud,
            None,
        )?;
        assert_eq!(client.endpoint(), &Url::parse(&expected)?);
        assert_eq!(
            client
                .get_original(None)
                .await?
                .into_model()?
                .data
                .as_deref(),
            Some("ok")
        );
        assert!(script.steps.lock().unwrap().is_empty());
    }
    let default = ResourceManagerClient::new("sub".into(), Arc::new(Credential), None)?;
    assert_eq!(
        default.endpoint(),
        &Url::parse(CloudConfiguration::default().endpoint().unwrap())?
    );
    Ok(())
}

#[test]
fn custom_cloud_configuration_errors_propagate() {
    for (endpoint, audience, message) in [
        (
            None,
            Some("https://audience.example"),
            "missing Resource Manager endpoint",
        ),
        (
            Some("https://management.example"),
            None,
            "missing custom cloud configuration audience",
        ),
        (
            Some("not a URL"),
            Some("https://audience.example"),
            "relative URL",
        ),
    ] {
        let mut custom = CustomConfiguration::default();
        custom.endpoint = endpoint.map(Into::into);
        if let Some(audience) = audience {
            custom.audiences = Audiences::new().with::<Audience>(audience.into());
        }
        let error = ResourceManagerClient::new(
            "sub".into(),
            Arc::new(Credential),
            Some(ResourceManagerClientOptions {
                client_options: ClientOptions {
                    cloud: Some(Arc::new(custom.into())),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .err()
        .expect("configuration must fail");
        assert!(error.to_string().contains(message), "{error}");
    }
}

#[tokio::test]
async fn resource_methods_return_resources_and_delay_the_initial_send() -> Result<()> {
    for (method, path) in [
        (Method::Put, VAULT),
        (Method::Put, HSM),
        (Method::Patch, HSM),
    ] {
        let (client, script) = client(
            vec![
                accepted(method, path, "location"),
                step(Method::Get, "/operations/1", StatusCode::Accepted, b""),
                step(
                    Method::Get,
                    "/operations/1",
                    StatusCode::Ok,
                    br#"{"name":"resource"}"#,
                ),
            ],
            None,
            None,
        )?;
        match (method, path) {
            (Method::Put, VAULT) => {
                let poller = client
                    .get_resource_manager_vaults_client()
                    .begin_create_or_update("group", "vault", Vault::default().try_into()?, None)?;
                assert_eq!(script.steps.lock().unwrap().len(), 3);
                assert_eq!(
                    poller.await?.into_model()?.name.as_deref(),
                    Some("resource")
                );
            }
            (Method::Put, HSM) => {
                let poller = client
                    .get_resource_manager_managed_hsms_client()
                    .begin_create_or_update(
                        "group",
                        "hsm",
                        ManagedHsm::default().try_into()?,
                        None,
                    )?;
                assert_eq!(script.steps.lock().unwrap().len(), 3);
                assert_eq!(
                    poller.await?.into_model()?.name.as_deref(),
                    Some("resource")
                );
            }
            _ => {
                let poller = client
                    .get_resource_manager_managed_hsms_client()
                    .begin_update(
                        "group",
                        "hsm",
                        ManagedHsmTagsUpdate::default().try_into()?,
                        None,
                    )?;
                assert_eq!(script.steps.lock().unwrap().len(), 3);
                assert_eq!(
                    poller.await?.into_model()?.name.as_deref(),
                    Some("resource")
                );
            }
        }
        assert!(script.steps.lock().unwrap().is_empty());
    }
    Ok(())
}

#[tokio::test]
async fn deletes_and_purges_accept_empty_final_results() -> Result<()> {
    for (index, method, path) in [
        (0, Method::Delete, HSM.to_string()),
        (
            1,
            Method::Post,
            "/purge/subscriptions/sub/providers/ResourceManager/managedHsms/hsm/purge".into(),
        ),
        (2, Method::Post, format!("/purge{VAULT}/purge")),
        (3, Method::Delete, format!("/vault-connections{VAULT}")),
        (4, Method::Delete, format!("/hsm-connections{HSM}")),
    ] {
        let (client, script) = client(
            vec![
                accepted(method, &path, "location"),
                step(Method::Get, "/operations/1", StatusCode::NoContent, b""),
            ],
            None,
            None,
        )?;
        let response: azure_core::http::Response<(), azure_core::http::NoFormat> = match index {
            0 => {
                client
                    .get_resource_manager_managed_hsms_client()
                    .begin_delete("group", "hsm", None)?
                    .await?
            }
            1 => {
                client
                    .get_resource_manager_managed_hsms_client()
                    .begin_purge("hsm", None)?
                    .await?
            }
            2 => {
                client
                    .get_resource_manager_vaults_client()
                    .begin_purge("group", "vault", PurgeRequest::default().try_into()?, None)?
                    .await?
            }
            3 => {
                client
                    .get_resource_manager_vault_connections_client()
                    .begin_delete("group", "vault", None)?
                    .await?
            }
            _ => {
                client
                    .get_resource_manager_hsm_connections_client()
                    .begin_delete("group", "hsm", None)?
                    .await?
            }
        };
        assert_eq!(response.status(), StatusCode::NoContent);
        assert!(script.steps.lock().unwrap().is_empty());
    }
    Ok(())
}

#[tokio::test]
async fn borrowed_context_survives_streaming_then_awaiting_and_final_get() -> Result<()> {
    let (client, script) = client(
        vec![
            accepted(Method::Put, VAULT, "azure-asyncoperation"),
            step(
                Method::Get,
                "/operations/1",
                StatusCode::Ok,
                br#"{"status":"Succeeded"}"#,
            ),
            step(Method::Get, VAULT, StatusCode::Ok, br#"{"name":"vault"}"#),
        ],
        None,
        Some("caller-id"),
    )?;
    let context = Context::new().with_value(ClientRequestId::new("caller-id"));
    let mut poller = client
        .get_resource_manager_vaults_client()
        .begin_create_or_update(
            "group",
            "vault",
            Vault::default().try_into()?,
            Some(ResourceManagerVaultsClientBeginCreateOrUpdateOptions {
                method_options: PollerOptions {
                    context: context.to_borrowed(),
                    ..Default::default()
                },
            }),
        )?;
    drop(context);
    assert_eq!(script.steps.lock().unwrap().len(), 3);
    assert_eq!(poller.next().await.unwrap()?.status(), StatusCode::Accepted);
    assert_eq!(
        poller.next().await.unwrap()?.into_model()?.status,
        Some(ResourceProvisioningState::Succeeded)
    );
    assert_eq!(poller.await?.into_model()?.name.as_deref(), Some("vault"));
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn inline_results_preserve_bytes_headers_and_extraction_errors() -> Result<()> {
    for (body, expected) in [
        (
            br#"{"status":"Succeeded","result":{ "data":"a\u0062", "number":1.00 }}"#.as_slice(),
            Some(br#"{ "data":"a\u0062", "number":1.00 }"#.as_slice()),
        ),
        (br#"{"status":"Succeeded"}"#.as_slice(), None),
    ] {
        let (client, script) = client(
            vec![
                accepted(Method::Post, "/inline", "operation-location"),
                step(Method::Get, "/operations/1", StatusCode::Ok, body),
            ],
            None,
            None,
        )?;
        // This operation has no api-version parameter; the helper must not invent one.
        let result = client.begin_inline_result(None)?.await;
        if let Some(expected) = expected {
            let response = result?;
            assert_eq!(response.status(), StatusCode::Ok);
            assert_eq!(
                response
                    .headers()
                    .get_optional_str(&HeaderName::from_static("test-header")),
                Some("preserved")
            );
            assert_eq!(
                azure_core::Bytes::from(response.deconstruct().2).as_ref(),
                expected
            );
        } else {
            assert!(result.is_err());
        }
        assert!(script.steps.lock().unwrap().is_empty());
    }
    Ok(())
}

#[tokio::test]
async fn operation_failures_preserve_service_error_details() -> Result<()> {
    let (client, script) = client(vec![
        accepted(Method::Put, VAULT, "azure-asyncoperation"),
        step(Method::Get, "/operations/1", StatusCode::Ok, br#"{"status":"Failed","error":{"code":"QuotaExceeded","message":"capacity exhausted"}}"#),
    ], None, None)?;
    let error = client
        .get_resource_manager_vaults_client()
        .begin_create_or_update("group", "vault", Vault::default().try_into()?, None)?
        .await
        .expect_err("operation must fail");
    assert_eq!(error.http_status(), Some(StatusCode::Ok));
    let detail = ErrorResponse::try_from(error)?.error.unwrap();
    assert_eq!(detail.code.as_deref(), Some("QuotaExceeded"));
    assert_eq!(detail.message.as_deref(), Some("capacity exhausted"));
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn initial_request_errors_propagate() -> Result<()> {
    let mut failed = step(Method::Post, "/empty", StatusCode::Ok, b"");
    failed.response = Err(Error::new(ErrorKind::Other, "transport failed"));
    let (client, _) = client(vec![failed], None, None)?;
    let error = client
        .begin_empty_result(None)?
        .await
        .expect_err("request must fail");
    assert!(error.to_string().contains("transport failed"));
    Ok(())
}

#[tokio::test]
async fn omitted_and_explicit_empty_selectors_and_spread_bodies_work() -> Result<()> {
    for path in ["/empty", "/explicit-empty", "/spread"] {
        let mut initial = accepted(Method::Post, path, "azure-asyncoperation");
        if path == "/spread" {
            initial.body = Some(json!({"value":"input","optional":"included"}));
        }
        let (client, script) = client(
            vec![
                initial,
                step(
                    Method::Get,
                    "/operations/1",
                    StatusCode::Ok,
                    br#"{"status":"Succeeded"}"#,
                ),
            ],
            None,
            None,
        )?;
        let response = match path {
            "/empty" => client.begin_empty_result(None)?.await?,
            "/explicit-empty" => client.begin_explicit_empty_result(None)?.await?,
            _ => {
                let poller = client.begin_spread(
                    "input".into(),
                    Some(ResourceManagerClientBeginSpreadOptions {
                        optional: Some("included".into()),
                        ..Default::default()
                    }),
                )?;
                assert_eq!(script.steps.lock().unwrap().len(), 2);
                poller.await?
            }
        };
        assert_eq!(response.status(), StatusCode::Ok);
        assert!(script.steps.lock().unwrap().is_empty());
    }
    Ok(())
}

#[tokio::test]
async fn original_url_and_async_selectors_fetch_the_original_resource() -> Result<()> {
    let (client, script) = client(
        vec![
            accepted(Method::Post, "/original", "azure-asyncoperation"),
            step(
                Method::Get,
                "/operations/1",
                StatusCode::Ok,
                br#"{"status":"Succeeded"}"#,
            ),
            step(
                Method::Get,
                "/original",
                StatusCode::Ok,
                br#"{"data":"final"}"#,
            ),
        ],
        None,
        None,
    )?;
    assert_eq!(
        client
            .begin_original_result(None)?
            .await?
            .into_model()?
            .data
            .as_deref(),
        Some("final")
    );
    assert!(script.steps.lock().unwrap().is_empty());
    let path = format!("/async{VAULT}");
    let (client, script) = self::client(
        vec![
            accepted(Method::Put, &path, "azure-asyncoperation"),
            step(
                Method::Get,
                "/operations/1",
                StatusCode::Ok,
                br#"{"status":"Succeeded"}"#,
            ),
            step(Method::Get, &path, StatusCode::Ok, br#"{"name":"vault"}"#),
        ],
        None,
        None,
    )?;
    assert_eq!(
        client
            .begin_async_result("group", "vault", Vault::default().try_into()?, None)?
            .await?
            .into_model()?
            .name
            .as_deref(),
        Some("vault")
    );
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}

#[test]
fn one_audience_registration_is_shared_across_generated_crates() -> Result<()> {
    let mut custom = CustomConfiguration::default();
    custom.endpoint = Some("https://management.example".into());
    custom.audiences = Audiences::new().with::<Audience>("https://audience.example".into());
    let cloud = Arc::new(custom.into());
    let credential: Arc<dyn TokenCredential> = Arc::new(Credential);
    let first = ResourceManagerClient::new(
        "sub".into(),
        credential.clone(),
        Some(ResourceManagerClientOptions {
            client_options: ClientOptions {
                cloud: Some(Arc::clone(&cloud)),
                ..Default::default()
            },
            ..Default::default()
        }),
    )?;
    let second = spector_armresources::ResourcesClient::new(
        "sub".into(),
        credential,
        Some(spector_armresources::ResourcesClientOptions {
            client_options: ClientOptions {
                cloud: Some(cloud),
                ..Default::default()
            },
            ..Default::default()
        }),
    )?;
    assert_eq!(first.endpoint(), second.endpoint());
    Ok(())
}

#[tokio::test]
async fn explicit_secret_patch_and_action_wire_values_are_preserved() -> Result<()> {
    let mut request = step(Method::Patch, "/secret", StatusCode::Ok, b"{}");
    request.body = Some(json!({
        "tags":{"updated":"true"},
        "properties":{"value":"test-value","contentType":"text/plain","action":"notify"}
    }));
    let (client, _) = client(vec![request], None, None)?;
    client
        .patch_secret(
            SecretPatch {
                tags: Some([("updated".into(), "true".into())].into()),
                properties: Some(SecretProperties {
                    value: Some("test-value".into()),
                    content_type: Some("text/plain".into()),
                    action: Some(RotationAction::Notify),
                }),
            }
            .try_into()?,
            None,
        )
        .await?;
    assert_eq!(
        serde_json::to_value(RotationAction::Rotate)?,
        json!("Rotate")
    );
    assert_eq!(
        serde_json::from_value::<RotationAction>(json!("notify"))?,
        RotationAction::Notify
    );
    Ok(())
}
